// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/PencilSketchIrregularShapeFit.mjs
// Radial silhouette prediction for Pencil Sketch "Irregular Shape" mode.

const TAU = Math.PI * 2;
const EPSILON = 1e-6;

export const IRREGULAR_SHAPE_DEFAULTS = {
  radialBinCount: 96,
  angularSmoothingBins: 3,
  minCoverageForPreview: 0.2,
  combineMode: "averaging",
  mirrorX: false,
  mirrorY: false,
  outlierTrimPercent: 0.15,
  previewSmoothness: 0.65,
  maxPreviewPoints: 64,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle) {
  const next = Number(angle) % TAU;
  return next < 0 ? next + TAU : next;
}

function finitePoint(raw) {
  const x = Number(raw?.x);
  const y = Number(raw?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function mirroredPoints(point, focalPoint, mirrorX = false, mirrorY = false) {
  const base = finitePoint(point);
  const focal = finitePoint(focalPoint);
  if (!base || !focal) return [];
  const variants = [{ ...base, mirror: "none" }];
  if (mirrorY) variants.push({ x: (2 * focal.x) - base.x, y: base.y, mirror: "mirror-y" });
  if (mirrorX) variants.push({ x: base.x, y: (2 * focal.y) - base.y, mirror: "mirror-x" });
  if (mirrorX && mirrorY) variants.push({ x: (2 * focal.x) - base.x, y: (2 * focal.y) - base.y, mirror: "mirror-x-y" });
  const seen = new Set();
  return variants.filter((variant) => {
    const key = Math.round(variant.x * 1000) + ":" + Math.round(variant.y * 1000);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function latestOverrideSample(samples = []) {
  return samples
    .filter((sample) => Number.isFinite(sample?.radius))
    .sort((a, b) => {
      const strokeDelta = (Number(b.strokeIndex) || 0) - (Number(a.strokeIndex) || 0);
      if (strokeDelta) return strokeDelta;
      const sourceDelta = (Number(b.sourceIndex) || 0) - (Number(a.sourceIndex) || 0);
      if (sourceDelta) return sourceDelta;
      const pointDelta = (Number(b.pointIndex) || 0) - (Number(a.pointIndex) || 0);
      if (pointDelta) return pointDelta;
      const directDelta = (b.direct ? 1 : 0) - (a.direct ? 1 : 0);
      if (directDelta) return directDelta;
      return (Number(b.weight) || 0) - (Number(a.weight) || 0);
    })[0] || null;
}

function binIndexForAngle(angle, binCount) {
  return clamp(Math.floor((normalizeAngle(angle) / TAU) * binCount), 0, binCount - 1);
}

function orderedOverrideBins(bins = []) {
  const ordered = bins
    .filter((bin) => bin.overwritten && bin.overridePoint)
    .sort((a, b) => a.index - b.index);
  if (ordered.length <= 2) return ordered;
  const binCount = bins.length;
  let startIndex = 0;
  let largestGap = -1;
  ordered.forEach((bin, index) => {
    const next = ordered[(index + 1) % ordered.length];
    const gap = (next.index - bin.index + binCount) % binCount;
    if (gap > largestGap) {
      largestGap = gap;
      startIndex = (index + 1) % ordered.length;
    }
  });
  return [...ordered.slice(startIndex), ...ordered.slice(0, startIndex)];
}

function weightedTrimmedMean(samples = [], trimPercent = 0.15) {
  if (!samples.length) return { radius: null, ignored: 0 };
  const sorted = [...samples]
    .filter((sample) => Number.isFinite(sample.radius) && Number.isFinite(sample.weight) && sample.weight > 0)
    .sort((a, b) => a.radius - b.radius);
  if (!sorted.length) return { radius: null, ignored: 0 };

  const trimCount = sorted.length >= 5
    ? Math.floor(sorted.length * clamp(trimPercent, 0, 0.4))
    : 0;
  const kept = sorted.slice(trimCount, sorted.length - trimCount);
  const active = kept.length ? kept : sorted;
  let weighted = 0;
  let totalWeight = 0;
  active.forEach((sample) => {
    weighted += sample.radius * sample.weight;
    totalWeight += sample.weight;
  });
  return {
    radius: totalWeight > EPSILON ? weighted / totalWeight : active[Math.floor(active.length / 2)].radius,
    ignored: sorted.length - active.length,
  };
}

function interpolateMissingRadii(radii = []) {
  const count = radii.length;
  const valid = radii
    .map((radius, index) => (Number.isFinite(radius) ? index : -1))
    .filter((index) => index >= 0);
  if (!valid.length) return { radii: [], interpolated: new Set() };
  if (valid.length === count) return { radii: radii.map((radius) => Number(radius)), interpolated: new Set() };

  const out = radii.map((radius) => (Number.isFinite(radius) ? Number(radius) : null));
  const interpolated = new Set();
  for (let i = 0; i < count; i += 1) {
    if (out[i] !== null) continue;
    let prev = null;
    let next = null;
    for (let d = 1; d <= count; d += 1) {
      const index = (i - d + count) % count;
      if (out[index] !== null) {
        prev = { index, distance: d, radius: out[index] };
        break;
      }
    }
    for (let d = 1; d <= count; d += 1) {
      const index = (i + d) % count;
      if (out[index] !== null) {
        next = { index, distance: d, radius: out[index] };
        break;
      }
    }
    if (prev && next) {
      const t = prev.distance / Math.max(EPSILON, prev.distance + next.distance);
      out[i] = prev.radius + ((next.radius - prev.radius) * t);
    } else {
      out[i] = prev?.radius ?? next?.radius ?? 0;
    }
    interpolated.add(i);
  }
  return { radii: out, interpolated };
}

function smoothCircularRadii(radii = [], windowBins = 3, smoothness = 0.65) {
  const count = radii.length;
  if (count < 3) return radii;
  const window = Math.max(1, Math.min(Math.floor(count / 4), Math.floor(Number(windowBins) || 1)));
  const blend = clamp(Number(smoothness), 0, 1);
  const passes = 2;
  let current = radii.map((radius) => Number(radius) || 0);
  for (let pass = 0; pass < passes; pass += 1) {
    const next = current.map((radius, index) => {
      let weighted = radius;
      let totalWeight = 1;
      for (let offset = 1; offset <= window; offset += 1) {
        const weight = (window + 1 - offset) / (window + 1);
        const left = current[(index - offset + count) % count];
        const right = current[(index + offset) % count];
        weighted += (left + right) * weight;
        totalWeight += weight * 2;
      }
      const average = weighted / totalWeight;
      return radius + ((average - radius) * blend);
    });
    current = next;
  }
  return current;
}

function thinClosedPoints(points = [], maxCount = 64) {
  const limit = Math.max(8, Number.parseInt(maxCount, 10) || 64);
  if (points.length <= limit) return points;
  const out = [];
  for (let i = 0; i < limit; i += 1) {
    const sourceIndex = Math.round((i * points.length) / limit) % points.length;
    out.push({ ...points[sourceIndex] });
  }
  return out;
}

export function simplifyClosedPolylineByDistance(points = [], minDistance = 0, maxCount = 64) {
  const clean = points.map(finitePoint).filter(Boolean);
  if (clean.length < 4) return clean;
  const threshold = Math.max(0, Number(minDistance) || 0);
  if (threshold <= 0) return thinClosedPoints(clean, maxCount);

  const simplified = [];
  clean.forEach((pt) => {
    const prev = simplified[simplified.length - 1];
    if (!prev || Math.hypot(pt.x - prev.x, pt.y - prev.y) >= threshold) {
      simplified.push(pt);
    }
  });
  if (
    simplified.length > 2 &&
    Math.hypot(
      simplified[0].x - simplified[simplified.length - 1].x,
      simplified[0].y - simplified[simplified.length - 1].y,
    ) < threshold
  ) {
    simplified.pop();
  }
  return thinClosedPoints(simplified.length >= 4 ? simplified : clean, maxCount);
}

export function closedBezierPathDFromPoints(points = [], smoothness = 0.65) {
  const pts = points.map(finitePoint).filter(Boolean);
  if (pts.length < 3) return "";
  const tension = clamp(Number(smoothness), 0.05, 1.25);
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length; i += 1) {
    const p0 = pts[(i - 1 + pts.length) % pts.length];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    const p3 = pts[(i + 2) % pts.length];
    const c1 = {
      x: p1.x + ((p2.x - p0.x) / 6) * tension,
      y: p1.y + ((p2.y - p0.y) / 6) * tension,
    };
    const c2 = {
      x: p2.x - ((p3.x - p1.x) / 6) * tension,
      y: p2.y - ((p3.y - p1.y) / 6) * tension,
    };
    d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
  }
  return `${d} Z`;
}

export function fitIrregularShapeRadialPrediction(strokes = [], focalPoint, options = {}) {
  const focal = finitePoint(focalPoint);
  if (!focal) {
    return { ok: false, reason: "missing-focal-point", confidence: 0, points: [] };
  }

  const binCount = Math.max(24, Math.min(240, Number.parseInt(options.radialBinCount, 10) || IRREGULAR_SHAPE_DEFAULTS.radialBinCount));
  const angularWindow = Math.max(0, Math.min(12, Number.parseInt(options.angularSmoothingBins, 10) || IRREGULAR_SHAPE_DEFAULTS.angularSmoothingBins));
  const minCoverage = clamp(
    Number(options.minCoverageForPreview) || IRREGULAR_SHAPE_DEFAULTS.minCoverageForPreview,
    0,
    0.95,
  );
  const combineMode = String(options.combineMode || IRREGULAR_SHAPE_DEFAULTS.combineMode).trim().toLowerCase() === "overriding"
    ? "overriding"
    : "averaging";
  const mirrorX = Boolean(options.mirrorX ?? IRREGULAR_SHAPE_DEFAULTS.mirrorX);
  const mirrorY = Boolean(options.mirrorY ?? IRREGULAR_SHAPE_DEFAULTS.mirrorY);
  const trimPercent = Number.isFinite(Number(options.outlierTrimPercent))
    ? Number(options.outlierTrimPercent)
    : IRREGULAR_SHAPE_DEFAULTS.outlierTrimPercent;
  const smoothness = Number.isFinite(Number(options.previewSmoothness))
    ? Number(options.previewSmoothness)
    : IRREGULAR_SHAPE_DEFAULTS.previewSmoothness;
  const directEvidence = Array(binCount).fill(0);
  const bins = Array.from({ length: binCount }, (_, index) => ({
    index,
    samples: [],
    directSampleCount: 0,
    radius: null,
    interpolated: false,
    ignoredOutlierCount: 0,
  }));
  const radialSamples = [];
  const drawableStrokes = (Array.isArray(strokes) ? strokes : [])
    .map((stroke, strokeIndex) => ({
      strokeIndex,
      points: Array.isArray(stroke?.points) ? stroke.points : [],
    }))
    .filter((entry) => entry.points.length >= 2);
  const sourceStrokes = drawableStrokes;

  sourceStrokes.forEach(({ points, strokeIndex }, sourceIndex) => {
    points.forEach((rawPoint, pointIndex) => {
      mirroredPoints(rawPoint, focal, mirrorX, mirrorY).forEach((point) => {
        const dx = point.x - focal.x;
        const dy = point.y - focal.y;
        const radius = Math.hypot(dx, dy);
        if (!Number.isFinite(radius) || radius <= EPSILON) return;
        const theta = normalizeAngle(Math.atan2(dy, dx));
        const centerBin = binIndexForAngle(theta, binCount);
        const sample = { theta, radius, bin: centerBin, strokeIndex, sourceIndex, pointIndex, mirror: point.mirror, x: point.x, y: point.y, weight: 1 };
        radialSamples.push(sample);
        directEvidence[centerBin] += 1;
        bins[centerBin].directSampleCount += 1;
        if (combineMode === "overriding") {
          bins[centerBin].samples.push({ ...sample, direct: true });
        } else {
          for (let offset = -angularWindow; offset <= angularWindow; offset += 1) {
            const distanceBins = Math.abs(offset);
            const falloff = angularWindow <= 0
              ? 1
              : (angularWindow + 1 - distanceBins) / (angularWindow + 1);
            if (falloff <= 0) continue;
            const index = (centerBin + offset + binCount) % binCount;
            bins[index].samples.push({
              ...sample,
              weight: falloff,
              direct: offset === 0,
            });
          }
        }
      });
    });
  });

  const evidenceBinCount = directEvidence.filter((count) => count > 0).length;
  const coverage = evidenceBinCount / binCount;
  if (!radialSamples.length) {
    return {
      ok: false,
      reason: "not-enough-radial-samples",
      confidence: 0,
      coverage,
      combineMode,
      mirrorX,
      mirrorY,
      sourceStrokeCount: sourceStrokes.length,
      points: [],
      radialSamples,
      radialBins: bins,
    };
  }

  const rawRadii = bins.map((bin) => {
    if (combineMode === "overriding") {
      const overrideSample = latestOverrideSample(bin.samples);
      if (overrideSample) {
        bin.radius = overrideSample.radius;
        bin.overwritten = true;
        bin.overwritingStrokeIndex = overrideSample.strokeIndex;
        bin.overridePoint = { x: overrideSample.x, y: overrideSample.y };
      }
      bin.ignoredOutlierCount = 0;
      return bin.radius;
    }
    const estimate = weightedTrimmedMean(bin.samples, trimPercent);
    bin.radius = estimate.radius;
    bin.ignoredOutlierCount = estimate.ignored;
    return estimate.radius;
  });
  const validRadiusCount = rawRadii.filter((radius) => Number.isFinite(radius)).length;
  if (combineMode !== "overriding" && validRadiusCount < Math.max(3, Math.ceil(binCount * minCoverage))) {
    return {
      ok: false,
      reason: coverage < minCoverage ? "coverage-too-low" : "not-enough-populated-bins",
      confidence: clamp(coverage / Math.max(EPSILON, minCoverage), 0, 0.35),
      coverage,
      combineMode,
      mirrorX,
      mirrorY,
      sourceStrokeCount: sourceStrokes.length,
      evidenceBinCount,
      binCount,
      points: [],
      radialSamples,
      radialBins: bins,
      outlierSamplesIgnored: bins.reduce((sum, bin) => sum + bin.ignoredOutlierCount, 0),
    };
  }

  const interpolation = combineMode === "overriding"
    ? { radii: rawRadii, interpolated: new Set() }
    : interpolateMissingRadii(rawRadii);
  interpolation.interpolated.forEach((index) => {
    bins[index].interpolated = true;
    bins[index].radius = interpolation.radii[index];
  });
  const smoothedRadii = combineMode === "overriding"
    ? interpolation.radii
    : smoothCircularRadii(interpolation.radii, angularWindow, smoothness);
  const points = combineMode === "overriding"
    ? orderedOverrideBins(bins).map((bin) => {
      const radius = Number(bin.radius);
      const theta = ((bin.index + 0.5) / binCount) * TAU;
      bin.smoothedRadius = radius;
      return {
        x: bin.overridePoint.x,
        y: bin.overridePoint.y,
        theta,
        radius,
      };
    })
    : smoothedRadii.map((radius, index) => {
      const theta = ((index + 0.5) / binCount) * TAU;
      bins[index].smoothedRadius = radius;
      return {
        x: focal.x + Math.cos(theta) * radius,
        y: focal.y + Math.sin(theta) * radius,
        theta,
        radius,
      };
    });

  let confidence = 0;
  if (coverage >= 0.8) confidence = 0.92;
  else if (coverage >= 0.6) confidence = 0.74 + ((coverage - 0.6) / 0.2) * 0.14;
  else if (coverage >= 0.2) confidence = 0.35 + ((coverage - 0.2) / 0.4) * 0.32;
  else confidence = clamp(coverage / Math.max(EPSILON, minCoverage), 0, 0.3);

  return {
    ok: combineMode === "overriding" ? points.length > 0 : coverage >= minCoverage,
    reason: combineMode === "overriding" ? (points.length > 0 ? "accepted" : "not-enough-radial-samples") : (coverage >= minCoverage ? "accepted" : "coverage-too-low"),
    confidence: combineMode === "overriding" ? clamp(coverage, 0, 1) : clamp(confidence, 0, 1),
    coverage,
    combineMode,
    mirrorX,
    mirrorY,
    sourceStrokeCount: sourceStrokes.length,
    binsOverwritten: combineMode === "overriding" ? bins.filter((bin) => bin.overwritten).length : evidenceBinCount,
    evidenceBinCount,
    binCount,
    points,
    radialSamples,
    radialBins: bins.map((bin) => ({
      index: bin.index,
      directSampleCount: bin.directSampleCount,
      sampleCount: bin.samples.length,
      radius: bin.radius,
      smoothedRadius: bin.smoothedRadius,
      interpolated: bin.interpolated,
      ignoredOutlierCount: bin.ignoredOutlierCount,
    })),
    interpolatedBinCount: interpolation.interpolated.size,
    outlierSamplesIgnored: bins.reduce((sum, bin) => sum + bin.ignoredOutlierCount, 0),
  };
}
