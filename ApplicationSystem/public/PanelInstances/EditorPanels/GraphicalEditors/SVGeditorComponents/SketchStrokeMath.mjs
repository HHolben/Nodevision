// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SketchStrokeMath.mjs
// Geometry helpers for SVG sketch mode. These utilities resample rough input strokes, align direction, and average points into a cleaner preview path.

const EPSILON = 1e-6;

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function toFinitePoint(raw) {
  const x = Number(raw?.x);
  const y = Number(raw?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function lerpPoint(a, b, t) {
  return {
    x: a.x + ((b.x - a.x) * t),
    y: a.y + ((b.y - a.y) * t),
  };
}

function normalizePointList(points = []) {
  const out = [];
  points.forEach((pt) => {
    const next = toFinitePoint(pt);
    if (!next) return;
    if (out.length === 0 || distance(out[out.length - 1], next) > EPSILON) {
      out.push(next);
    }
  });
  return out;
}

export function distance(a, b) {
  const dx = (Number(a?.x) || 0) - (Number(b?.x) || 0);
  const dy = (Number(a?.y) || 0) - (Number(b?.y) || 0);
  return Math.hypot(dx, dy);
}

function normalizeVector(x = 0, y = 0) {
  const len = Math.hypot(Number(x) || 0, Number(y) || 0);
  if (!Number.isFinite(len) || len <= EPSILON) return null;
  return { x: x / len, y: y / len };
}

function directionFromPoints(points = []) {
  const list = normalizePointList(points);
  if (list.length < 2) return null;
  const start = list[0];
  const end = list[list.length - 1];
  return normalizeVector(end.x - start.x, end.y - start.y);
}

function directionReliability(points = []) {
  const list = normalizePointList(points);
  if (list.length < 2) return 0;
  const len = strokeLength(list);
  if (!Number.isFinite(len) || len <= EPSILON) return 0;
  const chord = distance(list[0], list[list.length - 1]);
  return clamp01(chord / len);
}

function directionDot(a, b) {
  if (!a || !b) return 0;
  return (a.x * b.x) + (a.y * b.y);
}

export function strokeLength(points = []) {
  const list = normalizePointList(points);
  if (list.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < list.length; i += 1) {
    total += distance(list[i - 1], list[i]);
  }
  return total;
}

export function resampleStroke(points = [], sampleCount = 40) {
  const count = Math.max(2, Number.parseInt(sampleCount, 10) || 2);
  const list = normalizePointList(points);
  if (!list.length) return [];
  if (list.length === 1) {
    return Array.from({ length: count }, () => ({ ...list[0] }));
  }

  const total = strokeLength(list);
  if (!Number.isFinite(total) || total <= EPSILON) {
    return Array.from({ length: count }, () => ({ ...list[0] }));
  }

  const targetStep = total / (count - 1);
  const result = [{ ...list[0] }];

  let segIndex = 1;
  let prev = { ...list[0] };
  let carry = 0;
  let guard = 0;

  while (result.length < count - 1 && guard < count * list.length * 8) {
    guard += 1;
    const next = list[segIndex];
    if (!next) break;

    const segLen = distance(prev, next);
    if (segLen <= EPSILON) {
      prev = { ...next };
      segIndex += 1;
      continue;
    }

    if (carry + segLen >= targetStep) {
      const t = (targetStep - carry) / segLen;
      const mid = lerpPoint(prev, next, t);
      result.push(mid);
      prev = mid;
      carry = 0;
      continue;
    }

    carry += segLen;
    prev = { ...next };
    segIndex += 1;
  }

  while (result.length < count - 1) {
    result.push({ ...list[list.length - 1] });
  }

  result.push({ ...list[list.length - 1] });
  return result;
}

export function smoothPolyline(points = [], windowRadius = 2, passes = 1) {
  const list = normalizePointList(points);
  if (list.length < 3) return list;
  const radius = Math.max(1, Number.parseInt(windowRadius, 10) || 1);
  const totalPasses = Math.max(1, Number.parseInt(passes, 10) || 1);

  let current = list;
  for (let pass = 0; pass < totalPasses; pass += 1) {
    const next = current.map((pt, idx) => {
      if (idx === 0 || idx === current.length - 1) return { ...pt };
      const from = Math.max(0, idx - radius);
      const to = Math.min(current.length - 1, idx + radius);
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (let i = from; i <= to; i += 1) {
        sx += current[i].x;
        sy += current[i].y;
        n += 1;
      }
      return { x: sx / n, y: sy / n };
    });
    current = next;
  }
  return current;
}

export function pointsToPathD(points = []) {
  const list = normalizePointList(points);
  if (!list.length) return "";
  if (list.length === 1) return `M ${list[0].x} ${list[0].y}`;

  let d = `M ${list[0].x} ${list[0].y}`;
  for (let i = 1; i < list.length; i += 1) {
    d += ` L ${list[i].x} ${list[i].y}`;
  }
  return d;
}

export function simplifyByMinDistance(points = [], minDistance = 0) {
  const list = normalizePointList(points);
  const threshold = Math.max(0, Number(minDistance) || 0);
  if (list.length < 3 || threshold <= 0) return list;

  const simplified = [list[0]];
  for (let i = 1; i < list.length - 1; i += 1) {
    if (distance(simplified[simplified.length - 1], list[i]) >= threshold) {
      simplified.push(list[i]);
    }
  }
  simplified.push(list[list.length - 1]);
  return simplified;
}

export function orientStrokeLike(referencePoints = [], candidatePoints = []) {
  const ref = normalizePointList(referencePoints);
  const cand = normalizePointList(candidatePoints);
  if (ref.length < 2 || cand.length < 2) return cand;

  const refStart = ref[0];
  const refEnd = ref[ref.length - 1];
  const candStart = cand[0];
  const candEnd = cand[cand.length - 1];

  const sameDir = distance(refStart, candStart) + distance(refEnd, candEnd);
  const reversed = distance(refStart, candEnd) + distance(refEnd, candStart);

  return reversed + EPSILON < sameDir ? [...cand].reverse() : cand;
}

function averagePointSets(pointSets = []) {
  if (!pointSets.length) return [];
  const count = pointSets[0]?.length || 0;
  if (count < 2) return [];

  const out = [];
  for (let i = 0; i < count; i += 1) {
    let sx = 0;
    let sy = 0;
    let n = 0;
    pointSets.forEach((set) => {
      const pt = set[i];
      if (!pt) return;
      sx += pt.x;
      sy += pt.y;
      n += 1;
    });
    if (n > 0) out.push({ x: sx / n, y: sy / n });
  }
  return out;
}

function centroidOfPoints(points = []) {
  if (!points.length) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  points.forEach((pt) => {
    sx += pt.x;
    sy += pt.y;
  });
  return { x: sx / points.length, y: sy / points.length };
}

function pointToSegmentDistance(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const abLenSq = (abx * abx) + (aby * aby);
  if (abLenSq <= EPSILON) return distance(point, a);
  const t = Math.max(0, Math.min(1, ((apx * abx) + (apy * aby)) / abLenSq));
  const cx = a.x + (abx * t);
  const cy = a.y + (aby * t);
  return Math.hypot(point.x - cx, point.y - cy);
}

function pointToPolylineDistance(point, polyline = []) {
  if (!polyline.length) return Infinity;
  if (polyline.length === 1) return distance(point, polyline[0]);
  let best = Infinity;
  for (let i = 1; i < polyline.length; i += 1) {
    const d = pointToSegmentDistance(point, polyline[i - 1], polyline[i]);
    if (d < best) best = d;
  }
  return best;
}

function averageDistanceToPolyline(points = [], polyline = []) {
  if (!points.length || polyline.length < 2) return Infinity;
  let total = 0;
  points.forEach((pt) => {
    total += pointToPolylineDistance(pt, polyline);
  });
  return total / points.length;
}

function appendPointIfFar(points, point, threshold = EPSILON) {
  if (!Array.isArray(points) || !point) return;
  if (!points.length) {
    points.push({ x: point.x, y: point.y });
    return;
  }
  const prev = points[points.length - 1];
  if (distance(prev, point) <= threshold) return;
  points.push({ x: point.x, y: point.y });
}

function mean(values = []) {
  if (!values.length) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function projectionStats(points = [], axis = null) {
  if (!axis) {
    return { minProj: 0, maxProj: 0, meanNormal: 0 };
  }
  const list = normalizePointList(points);
  if (!list.length) {
    return { minProj: 0, maxProj: 0, meanNormal: 0 };
  }
  const normal = { x: -axis.y, y: axis.x };
  let minProj = Infinity;
  let maxProj = -Infinity;
  let normalSum = 0;
  list.forEach((pt) => {
    const proj = (pt.x * axis.x) + (pt.y * axis.y);
    const n = (pt.x * normal.x) + (pt.y * normal.y);
    if (proj < minProj) minProj = proj;
    if (proj > maxProj) maxProj = proj;
    normalSum += n;
  });
  return {
    minProj,
    maxProj,
    meanNormal: normalSum / list.length,
  };
}

function parallelSeparation(aPoints = [], bPoints = [], axis = null) {
  const a = projectionStats(aPoints, axis);
  const b = projectionStats(bPoints, axis);
  const overlap = Math.min(a.maxProj, b.maxProj) -
    Math.max(a.minProj, b.minProj);
  const alongGap = overlap >= 0 ? 0 : Math.min(
    Math.abs(a.minProj - b.maxProj),
    Math.abs(b.minProj - a.maxProj),
  );
  const normalOffset = Math.abs(a.meanNormal - b.meanNormal);
  return { alongGap, normalOffset };
}

function straightLineCandidate(points = []) {
  const list = normalizePointList(points);
  if (list.length < 2) return [];
  const axis = directionFromPoints(list);
  if (!axis) return [list[0], list[list.length - 1]];

  let minProjection = Infinity;
  let maxProjection = -Infinity;
  let minPoint = list[0];
  let maxPoint = list[list.length - 1];
  list.forEach((pt) => {
    const projection = (pt.x * axis.x) + (pt.y * axis.y);
    if (projection < minProjection) {
      minProjection = projection;
      minPoint = pt;
    }
    if (projection > maxProjection) {
      maxProjection = projection;
      maxPoint = pt;
    }
  });

  const oriented = orientStrokeLike(list, [minPoint, maxPoint]);
  if (oriented.length >= 2) return oriented;
  return [minPoint, maxPoint];
}

function inferStraightIntent(entries = [], averagedTrack = [], options = {}) {
  const track = normalizePointList(averagedTrack);
  if (track.length < 2) {
    return { straight: false, linePoints: track, score: 0 };
  }

  const chord = distance(track[0], track[track.length - 1]);
  const length = strokeLength(track);
  if (!Number.isFinite(length) || length <= EPSILON || chord <= EPSILON) {
    return { straight: false, linePoints: track, score: 0 };
  }

  const linePoints = straightLineCandidate(track);
  const lineError = averageDistanceToPolyline(track, linePoints);
  const linearity = clamp01(chord / length);
  const errorScale = Math.max(
    Number(options.lineErrorFloor) || 0,
    chord * (Number(options.lineErrorScale) || 0.08),
  );
  const fitScore = clamp01(
    1 - (lineError / Math.max(EPSILON, errorScale)),
  );

  const axis = directionFromPoints(linePoints);
  let directionCount = 0;
  let alignedCount = 0;
  let forwardCount = 0;
  let reverseCount = 0;
  entries.forEach((entry) => {
    if (!entry?.direction || !axis) return;
    const dot = directionDot(entry.direction, axis);
    directionCount += 1;
    if (Math.abs(dot) >= options.lineDirectionMinDot) alignedCount += 1;
    if (dot >= 0) forwardCount += 1;
    else reverseCount += 1;
  });

  const alignmentScore = directionCount > 0
    ? alignedCount / directionCount
    : linearity;
  const hasBackAndForth = forwardCount > 0 && reverseCount > 0;
  const shadingBoost = hasBackAndForth ? options.lineBackAndForthBoost : 0;

  const score = (linearity * 0.5) + (fitScore * 0.35) +
    (alignmentScore * 0.15) + shadingBoost;
  const straight = entries.length >= options.lineMinStrokeCount &&
    linearity >= options.linearityThreshold &&
    fitScore >= options.lineFitThreshold &&
    score >= options.lineIntentThreshold;

  return {
    straight,
    linePoints,
    score,
  };
}

function minEndpointContinuityGap(points = [], polyline = []) {
  if (points.length < 2 || polyline.length < 2) return Infinity;
  const strokeStart = points[0];
  const strokeEnd = points[points.length - 1];
  const trackStart = polyline[0];
  const trackEnd = polyline[polyline.length - 1];

  const toTrack = Math.min(
    pointToPolylineDistance(strokeStart, polyline),
    pointToPolylineDistance(strokeEnd, polyline),
  );
  const toEndpoints = Math.min(
    distance(strokeStart, trackStart),
    distance(strokeStart, trackEnd),
    distance(strokeEnd, trackStart),
    distance(strokeEnd, trackEnd),
  );
  return Math.min(toTrack, toEndpoints);
}

function orientForStitch(previousPoints = [], nextPoints = []) {
  const prev = normalizePointList(previousPoints);
  const next = normalizePointList(nextPoints);
  if (prev.length < 2 || next.length < 2) return next;

  const prevEnd = prev[prev.length - 1];
  const same = distance(prevEnd, next[0]);
  const reversed = distance(prevEnd, next[next.length - 1]);
  if (reversed + EPSILON < same) return [...next].reverse();
  return next;
}

function buildStitchedTrackFromEntries(entries = [], options = {}) {
  if (!entries.length) return [];
  const ordered = [...entries].sort((a, b) => a.index - b.index);
  const stitched = [];
  let prevSegment = [];

  ordered.forEach((entry, idx) => {
    const segment = idx === 0
      ? normalizePointList(entry.resampled)
      : orientForStitch(prevSegment, entry.resampled);
    if (segment.length < 2) return;

    if (!stitched.length) {
      segment.forEach((pt) => appendPointIfFar(stitched, pt));
    } else {
      const startIdx = distance(stitched[stitched.length - 1], segment[0]) <=
          options.stitchJoinTolerance
        ? 1
        : 0;
      for (let i = startIdx; i < segment.length; i += 1) {
        appendPointIfFar(stitched, segment[i], options.stitchJoinTolerance);
      }
    }
    prevSegment = segment;
  });

  if (stitched.length < 2) return stitched;
  const smooth = smoothPolyline(
    stitched,
    options.smoothingRadius,
    options.smoothingPasses,
  );
  return simplifyByMinDistance(smooth, options.simplifyDistance);
}

function shouldUseProgressiveStitch(entries = [], options = {}) {
  if (entries.length < options.progressiveMinStrokeCount) return false;
  const ordered = [...entries].sort((a, b) => a.index - b.index);
  if (ordered.length < 2) return false;

  const travel = [];
  const overlap = [];
  const continuity = [];
  for (let i = 1; i < ordered.length; i += 1) {
    const prev = ordered[i - 1];
    const next = ordered[i];
    travel.push(distance(prev.centroid, next.centroid));
    overlap.push(averageDistanceToPolyline(next.resampled, prev.resampled));
    const oriented = orientForStitch(prev.resampled, next.resampled);
    continuity.push(minEndpointContinuityGap(oriented, prev.resampled));
  }

  const meanTravel = mean(travel);
  const meanOverlap = mean(overlap);
  const meanContinuity = mean(continuity);

  const isProgressiveMotion =
    meanTravel >= options.progressiveTravelThreshold &&
    meanOverlap >= options.progressiveOverlapThreshold;
  const hasContinuity =
    meanContinuity <= options.progressiveContinuityThreshold;
  return isProgressiveMotion && hasContinuity;
}

function firstDirectionOfTrack(points = []) {
  const list = normalizePointList(points);
  if (list.length < 2) return null;
  for (let i = 1; i < list.length; i += 1) {
    const dir = normalizeVector(
      list[i].x - list[i - 1].x,
      list[i].y - list[i - 1].y,
    );
    if (dir) return dir;
  }
  return null;
}

function lastDirectionOfTrack(points = []) {
  const list = normalizePointList(points);
  if (list.length < 2) return null;
  for (let i = list.length - 1; i > 0; i -= 1) {
    const dir = normalizeVector(
      list[i].x - list[i - 1].x,
      list[i].y - list[i - 1].y,
    );
    if (dir) return dir;
  }
  return null;
}

function orientTrackForJoin(leftPoints = [], rightPoints = []) {
  const left = normalizePointList(leftPoints);
  const right = normalizePointList(rightPoints);
  if (left.length < 2 || right.length < 2) return right;
  const leftEnd = left[left.length - 1];
  const same = distance(leftEnd, right[0]);
  const reversed = distance(leftEnd, right[right.length - 1]);
  return reversed + EPSILON < same ? [...right].reverse() : right;
}

function mergeAdjacentClusters(clusters = [], options = {}) {
  const ordered = [...clusters].sort((a, b) => a.firstIndex - b.firstIndex);
  if (ordered.length < 2) return ordered;

  const merged = [];
  ordered.forEach((cluster) => {
    const current = {
      ...cluster,
      trackPoints: normalizePointList(cluster.trackPoints || []),
    };
    const prev = merged[merged.length - 1];
    if (
      !prev || prev.trackPoints.length < 2 || current.trackPoints.length < 2
    ) {
      merged.push(current);
      return;
    }

    const indexGap = Math.max(0, current.firstIndex - prev.lastIndex);
    if (indexGap > options.mergeTrackIndexGap) {
      merged.push(current);
      return;
    }

    const orientedRight = orientTrackForJoin(
      prev.trackPoints,
      current.trackPoints,
    );
    const joinGap = distance(
      prev.trackPoints[prev.trackPoints.length - 1],
      orientedRight[0],
    );
    if (joinGap > options.mergeTrackGapThreshold + EPSILON) {
      merged.push(current);
      return;
    }

    const leftDir = lastDirectionOfTrack(prev.trackPoints);
    const rightDir = firstDirectionOfTrack(orientedRight);
    const turnAxial = leftDir && rightDir
      ? Math.abs(directionDot(leftDir, rightDir))
      : 1;
    if (turnAxial + EPSILON < options.mergeTrackTurnMinAxial) {
      merged.push(current);
      return;
    }

    const stitched = [...prev.trackPoints];
    const startIdx = joinGap <= options.stitchJoinTolerance ? 1 : 0;
    for (let i = startIdx; i < orientedRight.length; i += 1) {
      appendPointIfFar(stitched, orientedRight[i], options.stitchJoinTolerance);
    }

    prev.trackPoints = simplifyByMinDistance(
      smoothPolyline(
        stitched,
        options.smoothingRadius,
        options.smoothingPasses,
      ),
      options.simplifyDistance,
    );
    prev.members = [...(prev.members || []), ...(current.members || [])];
    prev.lastIndex = Math.max(prev.lastIndex, current.lastIndex);
    prev.meanLength = mean([prev.meanLength, current.meanLength]);
    prev.spread = mean([prev.spread, current.spread]);
  });

  return merged;
}

function buildAveragedTrackFromEntries(entries = [], options = {}) {
  if (!entries.length) return [];
  const ordered = [...entries].sort((a, b) => a.index - b.index);
  const reference = ordered[0]?.resampled || [];
  if (reference.length < 2) return [];

  if (shouldUseProgressiveStitch(ordered, options)) {
    const stitched = buildStitchedTrackFromEntries(ordered, options);
    if (stitched.length >= 2) return stitched;
  }

  // Direction normalization keeps user strokes that were drawn in opposite directions
  // from canceling each other out during averaging.
  const aligned = ordered.map((entry, idx) =>
    idx === 0 ? entry.resampled : orientStrokeLike(reference, entry.resampled)
  );

  const averaged = averagePointSets(aligned);
  if (averaged.length < 2) return [];

  const smooth = smoothPolyline(
    averaged,
    options.smoothingRadius,
    options.smoothingPasses,
  );
  const simplified = simplifyByMinDistance(smooth, options.simplifyDistance);
  const straightIntent = inferStraightIntent(entries, simplified, options);
  if (straightIntent.straight && straightIntent.linePoints?.length >= 2) {
    return straightIntent.linePoints.map((pt) => ({ x: pt.x, y: pt.y }));
  }
  return simplified;
}

function normalizeStrokeEntries(strokePointLists = [], options = {}) {
  const out = [];
  strokePointLists.forEach((points, index) => {
    const cleaned = normalizePointList(points);
    if (cleaned.length < 2) return;
    const len = strokeLength(cleaned);
    if (len < options.minLength) return;
    const resampled = resampleStroke(cleaned, options.sampleCount);
    if (resampled.length < 2) return;
    out.push({
      index,
      points: cleaned,
      resampled,
      length: len,
      centroid: centroidOfPoints(resampled),
      direction: directionFromPoints(resampled),
      directionReliability: directionReliability(resampled),
    });
  });
  return out;
}

function recomputeCluster(cluster, options = {}) {
  const members = cluster.members || [];
  if (!members.length) {
    cluster.centroid = { x: 0, y: 0 };
    cluster.spread = 0;
    cluster.meanLength = 0;
    cluster.trackPoints = [];
    cluster.lastIndex = -1;
    return cluster;
  }

  cluster.centroid = centroidOfPoints(members.map((entry) => entry.centroid));
  cluster.spread = members.reduce(
    (acc, entry) => acc + distance(entry.centroid, cluster.centroid),
    0,
  ) / members.length;
  cluster.meanLength = members.reduce((acc, entry) => acc + entry.length, 0) /
    members.length;
  cluster.firstIndex = Math.min(...members.map((entry) => entry.index));
  cluster.lastIndex = Math.max(...members.map((entry) => entry.index));
  const lastMember = [...members].sort((a, b) => b.index - a.index)[0] || null;
  cluster.trackPoints = buildAveragedTrackFromEntries(members, options);
  cluster.direction = directionFromPoints(cluster.trackPoints) ||
    members[0]?.direction || null;
  cluster.tailDirection = lastMember?.direction || cluster.direction || null;
  cluster.directionCoherence = cluster.direction
    ? mean(
      members
        .map((entry) =>
          entry.direction
            ? Math.abs(directionDot(entry.direction, cluster.direction))
            : null
        )
        .filter((value) => Number.isFinite(value)),
    )
    : 0;
  const memberDirectionReliability = members.reduce(
    (acc, entry) => acc + (Number(entry.directionReliability) || 0),
    0,
  ) / members.length;
  cluster.directionReliability = Math.max(
    directionReliability(cluster.trackPoints),
    memberDirectionReliability * cluster.directionCoherence,
  );
  return cluster;
}

function directionFit(entry, cluster, options = {}, indexGap = Infinity) {
  const entryReliability = Number(entry.directionReliability) || 0;
  const clusterReliability = Number(cluster.directionReliability) || 0;
  const coherence = Number(cluster.directionCoherence) || 0;
  const canUseTail = indexGap <= options.tailDirectionWindow &&
    entryReliability >= options.minDirectionReliability &&
    entry.direction &&
    cluster.tailDirection;
  if (canUseTail) {
    const signed = directionDot(entry.direction, cluster.tailDirection);
    return {
      usable: true,
      signed,
      axial: Math.abs(signed),
      axis: cluster.tailDirection,
    };
  }

  const referenceDirection = cluster.direction;
  const reliable = entryReliability >= options.minDirectionReliability &&
    clusterReliability >= options.minDirectionReliability &&
    coherence >= options.minDirectionCoherence;
  if (!reliable || !entry.direction || !referenceDirection) {
    return { usable: false, signed: 1, axial: 1, axis: null };
  }
  const signed = directionDot(entry.direction, referenceDirection);
  return {
    usable: true,
    signed,
    axial: Math.abs(signed),
    axis: referenceDirection,
  };
}

function temporalFit(
  entry,
  cluster,
  direction,
  continuityGap,
  trackDist,
  options = {},
) {
  const lastIndex = Number(cluster?.lastIndex);
  const gap = Math.max(
    0,
    entry.index - (Number.isFinite(lastIndex) ? lastIndex : entry.index),
  );
  const nearInTime = gap <= options.recentStrokeWindow;
  const nearby = Math.min(continuityGap, trackDist) <=
    options.recentDistanceThreshold;
  const sameDirection = direction.usable &&
    direction.signed >= options.sameDirectionThreshold;
  const shadingLike = direction.usable &&
    direction.axial >= options.directionSimilarityThreshold &&
    direction.signed <= -options.shadingReverseMinDot &&
    nearInTime &&
    nearby;

  let multiplier = 1;
  if (nearInTime && nearby && sameDirection) {
    multiplier *= options.recentSameDirectionBonus;
  }
  if (shadingLike) {
    // Back-and-forth sketching over the same area usually means "reinforce this line."
    multiplier *= options.shadingBonus;
  }
  if (
    gap > options.farStrokeWindow &&
    continuityGap > options.continuityGapThreshold
  ) {
    const extraGap = gap - options.farStrokeWindow;
    const scaled = extraGap / Math.max(1, options.farStrokeWindow);
    multiplier *= 1 + Math.min(3, scaled) * options.oldStrokePenalty;
  }

  return { multiplier, shadingLike };
}

function pickClusterForEntry(entry, clusters = [], options = {}) {
  let best = null;

  clusters.forEach((cluster) => {
    const indexGap = Math.max(
      0,
      entry.index - (Number(cluster?.lastIndex) || entry.index),
    );
    const centroidDist = distance(entry.centroid, cluster.centroid);
    const trackDist = averageDistanceToPolyline(
      entry.resampled,
      cluster.trackPoints,
    );
    const continuityGap = minEndpointContinuityGap(
      entry.resampled,
      cluster.trackPoints,
    );
    const allowedSpatial = Math.max(
      options.trackDistanceThreshold,
      cluster.spread * options.clusterSpreadFactor,
      cluster.meanLength * options.lengthThresholdFactor,
    );
    const allowedContinuity = Math.max(
      options.continuityGapThreshold,
      cluster.spread * options.continuitySpreadFactor,
      cluster.meanLength * options.continuityLengthFactor,
    );

    const direction = directionFit(entry, cluster, options, indexGap);
    const turnContinuation = direction.usable &&
      direction.axial >= options.turnMinAxial &&
      continuityGap <= options.turnContinuityThreshold &&
      indexGap <= options.turnRecentWindow;
    // Strong direction mismatch usually implies a new intended section,
    // unless this looks like a recent connected gradual turn.
    if (
      direction.usable &&
      direction.axial + EPSILON < options.directionSimilarityThreshold &&
      !turnContinuation
    ) {
      return;
    }

    const withinSpatial = centroidDist <= allowedSpatial + EPSILON ||
      trackDist <= allowedSpatial + EPSILON;
    const withinContinuity = continuityGap <= allowedContinuity + EPSILON;
    if (!withinSpatial || !withinContinuity) return;

    if (direction.usable && direction.axial >= options.parallelCheckMinAxial) {
      const separation = parallelSeparation(
        entry.resampled,
        cluster.trackPoints,
        direction.axis,
      );
      const allowedOffset = Math.max(
        options.parallelOffsetThreshold,
        cluster.spread * options.parallelOffsetSpreadFactor,
      );
      const allowedAlongGap = Math.max(
        options.parallelAlongGapThreshold,
        cluster.meanLength * options.parallelAlongGapLengthFactor,
      );
      if (separation.normalOffset > allowedOffset + EPSILON) return;
      if (
        separation.alongGap > allowedAlongGap + EPSILON &&
        continuityGap > options.continuityGapThreshold * 0.7
      ) {
        return;
      }
    }

    const temporal = temporalFit(
      entry,
      cluster,
      direction,
      continuityGap,
      trackDist,
      options,
    );

    let score = Math.min(centroidDist, trackDist, continuityGap);
    if (direction.usable) {
      const alignmentPenalty = (1 - direction.axial) *
        options.directionPenaltyFactor;
      const reversePenalty =
        direction.signed < options.sameDirectionThreshold &&
          !temporal.shadingLike
          ? options.reverseDirectionPenalty
          : 0;
      score *= 1 + alignmentPenalty + reversePenalty;
    }
    score *= temporal.multiplier;

    if (!best || score < best.score) best = { cluster, score };
  });

  return best?.cluster || null;
}

export function inferStrokeTracks(strokePointLists = [], options = {}) {
  const sampleCount = Math.max(
    8,
    Number.parseInt(options.sampleCount, 10) || 40,
  );
  const minLength = Math.max(0.001, Number(options.minLength) || 0.001);
  const smoothingRadius = Math.max(
    1,
    Number.parseInt(options.smoothingRadius, 10) || 1,
  );
  const smoothingPasses = Math.max(
    1,
    Number.parseInt(options.smoothingPasses, 10) || 1,
  );
  const simplifyDistance = Math.max(0, Number(options.simplifyDistance) || 0);
  const trackDistanceThreshold = Math.max(
    minLength * 3.5,
    Number(options.trackDistanceThreshold) || 0,
  );
  const clusterSpreadFactor = Math.max(
    1.4,
    Number(options.clusterSpreadFactor) || 2.8,
  );
  const lengthThresholdFactor = Math.max(
    0.1,
    Number(options.lengthThresholdFactor) || 0.3,
  );
  const continuityGapThreshold = Math.max(
    minLength * 2.5,
    Number(options.continuityGapThreshold) || (trackDistanceThreshold * 0.85),
  );
  const continuitySpreadFactor = Math.max(
    1.1,
    Number(options.continuitySpreadFactor) || 1.8,
  );
  const continuityLengthFactor = Math.max(
    0.05,
    Number(options.continuityLengthFactor) || 0.15,
  );
  const directionSimilarityThreshold = Math.max(
    0,
    Math.min(0.99, Number(options.directionSimilarityThreshold) || 0.45),
  );
  const minDirectionReliability = Math.max(
    0,
    Math.min(1, Number(options.minDirectionReliability) || 0.18),
  );
  const minDirectionCoherence = Math.max(
    0,
    Math.min(1, Number(options.minDirectionCoherence) || 0.62),
  );
  const directionPenaltyFactor = Math.max(
    0,
    Number(options.directionPenaltyFactor) || 0.9,
  );
  const reverseDirectionPenalty = Math.max(
    0,
    Number(options.reverseDirectionPenalty) || 0.45,
  );
  const sameDirectionThreshold = Math.max(
    -1,
    Math.min(1, Number(options.sameDirectionThreshold) || 0.15),
  );
  const recentStrokeWindow = Math.max(
    1,
    Number.parseInt(options.recentStrokeWindow, 10) || 4,
  );
  const farStrokeWindow = Math.max(
    recentStrokeWindow + 1,
    Number.parseInt(options.farStrokeWindow, 10) || 9,
  );
  const recentDistanceThreshold = Math.max(
    minLength * 1.5,
    Number(options.recentDistanceThreshold) || (trackDistanceThreshold * 0.7),
  );
  const recentSameDirectionBonus = Math.max(
    0.3,
    Math.min(1, Number(options.recentSameDirectionBonus) || 0.72),
  );
  const shadingReverseMinDot = Math.max(
    0,
    Math.min(1, Number(options.shadingReverseMinDot) || 0.5),
  );
  const shadingBonus = Math.max(
    0.3,
    Math.min(1, Number(options.shadingBonus) || 0.66),
  );
  const oldStrokePenalty = Math.max(
    0,
    Number(options.oldStrokePenalty) || 0.18,
  );
  const lineIntentThreshold = Math.max(
    0.2,
    Math.min(1.5, Number(options.lineIntentThreshold) || 0.78),
  );
  const linearityThreshold = Math.max(
    0.4,
    Math.min(1, Number(options.linearityThreshold) || 0.9),
  );
  const lineFitThreshold = Math.max(
    0.2,
    Math.min(1, Number(options.lineFitThreshold) || 0.65),
  );
  const lineErrorScale = Math.max(
    0.005,
    Number(options.lineErrorScale) || 0.08,
  );
  const lineErrorFloor = Math.max(
    minLength * 0.2,
    Number(options.lineErrorFloor) || (minLength * 0.5),
  );
  const lineDirectionMinDot = Math.max(
    0,
    Math.min(1, Number(options.lineDirectionMinDot) || 0.88),
  );
  const lineBackAndForthBoost = Math.max(
    0,
    Number(options.lineBackAndForthBoost) || 0.1,
  );
  const lineMinStrokeCount = Math.max(
    1,
    Number.parseInt(options.lineMinStrokeCount, 10) || 2,
  );
  const progressiveMinStrokeCount = Math.max(
    2,
    Number.parseInt(options.progressiveMinStrokeCount, 10) || 3,
  );
  const progressiveTravelThreshold = Math.max(
    minLength * 0.5,
    Number(options.progressiveTravelThreshold) ||
      (trackDistanceThreshold * 0.22),
  );
  const progressiveOverlapThreshold = Math.max(
    minLength * 0.35,
    Number(options.progressiveOverlapThreshold) ||
      (trackDistanceThreshold * 0.13),
  );
  const progressiveContinuityThreshold = Math.max(
    minLength,
    Number(options.progressiveContinuityThreshold) ||
      (continuityGapThreshold * 0.82),
  );
  const stitchJoinTolerance = Math.max(
    minLength * 0.04,
    Number(options.stitchJoinTolerance) || (minLength * 0.22),
  );
  const turnMinAxial = Math.max(
    0,
    Math.min(1, Number(options.turnMinAxial) || 0.7),
  );
  const turnContinuityThreshold = Math.max(
    minLength,
    Number(options.turnContinuityThreshold) || (continuityGapThreshold * 0.58),
  );
  const turnRecentWindow = Math.max(
    1,
    Number.parseInt(options.turnRecentWindow, 10) ||
      Math.max(3, recentStrokeWindow + 1),
  );
  const tailDirectionWindow = Math.max(
    1,
    Number.parseInt(options.tailDirectionWindow, 10) ||
      Math.max(3, recentStrokeWindow + 1),
  );
  const mergeTrackGapThreshold = Math.max(
    minLength * 0.8,
    Number(options.mergeTrackGapThreshold) ||
      (Math.min(trackDistanceThreshold, continuityGapThreshold) * 0.42),
  );
  const mergeTrackTurnMinAxial = Math.max(
    0,
    Math.min(1, Number(options.mergeTrackTurnMinAxial) || 0.76),
  );
  const mergeTrackIndexGap = Math.max(
    0,
    Number.parseInt(options.mergeTrackIndexGap, 10) ||
      2,
  );
  const parallelCheckMinAxial = Math.max(
    0,
    Math.min(1, Number(options.parallelCheckMinAxial) || 0.9),
  );
  const parallelOffsetThreshold = Math.max(
    minLength * 0.5,
    Number(options.parallelOffsetThreshold) || (trackDistanceThreshold * 0.45),
  );
  const parallelOffsetSpreadFactor = Math.max(
    1,
    Number(options.parallelOffsetSpreadFactor) || 1.8,
  );
  const parallelAlongGapThreshold = Math.max(
    minLength * 0.8,
    Number(options.parallelAlongGapThreshold) ||
      (continuityGapThreshold * 0.62),
  );
  const parallelAlongGapLengthFactor = Math.max(
    0.1,
    Number(options.parallelAlongGapLengthFactor) || 0.42,
  );

  const settings = {
    sampleCount,
    minLength,
    smoothingRadius,
    smoothingPasses,
    simplifyDistance,
    trackDistanceThreshold,
    clusterSpreadFactor,
    lengthThresholdFactor,
    continuityGapThreshold,
    continuitySpreadFactor,
    continuityLengthFactor,
    directionSimilarityThreshold,
    minDirectionReliability,
    minDirectionCoherence,
    directionPenaltyFactor,
    reverseDirectionPenalty,
    sameDirectionThreshold,
    recentStrokeWindow,
    farStrokeWindow,
    recentDistanceThreshold,
    recentSameDirectionBonus,
    shadingReverseMinDot,
    shadingBonus,
    oldStrokePenalty,
    lineIntentThreshold,
    linearityThreshold,
    lineFitThreshold,
    lineErrorScale,
    lineErrorFloor,
    lineDirectionMinDot,
    lineBackAndForthBoost,
    lineMinStrokeCount,
    progressiveMinStrokeCount,
    progressiveTravelThreshold,
    progressiveOverlapThreshold,
    progressiveContinuityThreshold,
    stitchJoinTolerance,
    turnMinAxial,
    turnContinuityThreshold,
    turnRecentWindow,
    tailDirectionWindow,
    mergeTrackGapThreshold,
    mergeTrackTurnMinAxial,
    mergeTrackIndexGap,
    parallelCheckMinAxial,
    parallelOffsetThreshold,
    parallelOffsetSpreadFactor,
    parallelAlongGapThreshold,
    parallelAlongGapLengthFactor,
  };

  const entries = normalizeStrokeEntries(strokePointLists, settings);
  if (!entries.length) return [];

  const clusters = [];
  entries.forEach((entry) => {
    const cluster = pickClusterForEntry(entry, clusters, settings);
    if (!cluster) {
      const next = recomputeCluster({
        members: [entry],
        trackPoints: entry.resampled,
        centroid: entry.centroid,
        spread: 0,
        meanLength: entry.length,
        firstIndex: entry.index,
      }, settings);
      clusters.push(next);
      return;
    }
    cluster.members.push(entry);
    recomputeCluster(cluster, settings);
  });

  const mergedClusters = mergeAdjacentClusters(clusters, settings);

  return mergedClusters
    .filter((cluster) =>
      Array.isArray(cluster.trackPoints) && cluster.trackPoints.length >= 2
    )
    .sort((a, b) => a.firstIndex - b.firstIndex)
    .map((cluster) => ({
      points: cluster.trackPoints,
      strokeCount: cluster.members.length,
    }));
}

export function averageStrokes(strokePointLists = [], options = {}) {
  const tracks = inferStrokeTracks(strokePointLists, options);
  if (!tracks.length) return [];

  // Backward-compatible helper: when multiple sections exist, choose the section
  // supported by the most rough strokes (then by longest inferred curve).
  const sorted = [...tracks].sort((a, b) => {
    if (b.strokeCount !== a.strokeCount) return b.strokeCount - a.strokeCount;
    return strokeLength(b.points) - strokeLength(a.points);
  });
  return sorted[0]?.points || [];
}
