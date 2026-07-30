// Nodevision/ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/StrokeResampler.mjs
// Point filtering, simplification, and resampling for experimental stroke glyphs.

import { clamp, finiteNumber } from "./StrokeGlyphModel.mjs";

export function pointDistance(a, b) {
  const dx = finiteNumber(a?.x) - finiteNumber(b?.x);
  const dy = finiteNumber(a?.y) - finiteNumber(b?.y);
  return Math.sqrt(dx * dx + dy * dy);
}

export function pathLength(points = []) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const d = pointDistance(points[index - 1], points[index]);
    if (Number.isFinite(d)) total += d;
  }
  return total;
}

export function filterNearDuplicatePoints(points = [], minDistance = 0.002) {
  const clean = (Array.isArray(points) ? points : []).filter((point) => (
    Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y))
  ));
  if (clean.length <= 2) return clean.map((point) => ({ ...point }));

  const output = [{ ...clean[0] }];
  for (let index = 1; index < clean.length - 1; index += 1) {
    const point = clean[index];
    if (pointDistance(output[output.length - 1], point) >= minDistance) output.push({ ...point });
  }
  const last = clean[clean.length - 1];
  if (pointDistance(output[output.length - 1], last) > 0 || output.length === 1) output.push({ ...last });
  return output;
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-12) return pointDistance(point, lineStart);
  const t = clamp(((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared, 0, 1);
  return pointDistance(point, { x: lineStart.x + dx * t, y: lineStart.y + dy * t });
}

function simplifyDouglasPeucker(points, epsilon, start, end, keep) {
  if (end <= start + 1) return;
  let maxDistance = -1;
  let maxIndex = -1;
  for (let index = start + 1; index < end; index += 1) {
    const d = perpendicularDistance(points[index], points[start], points[end]);
    if (d > maxDistance) {
      maxDistance = d;
      maxIndex = index;
    }
  }
  if (maxDistance > epsilon && maxIndex > start) {
    keep.add(maxIndex);
    simplifyDouglasPeucker(points, epsilon, start, maxIndex, keep);
    simplifyDouglasPeucker(points, epsilon, maxIndex, end, keep);
  }
}

export function simplifyStrokePoints(points = [], epsilon = 0.004) {
  const clean = filterNearDuplicatePoints(points, Math.max(0, epsilon * 0.5));
  if (clean.length <= 3) return clean;
  const keep = new Set([0, clean.length - 1]);
  simplifyDouglasPeucker(clean, Math.max(0, epsilon), 0, clean.length - 1, keep);
  return clean.filter((_, index) => keep.has(index)).map((point) => ({ ...point }));
}

function interpolatePoint(a, b, ratio) {
  const t = clamp(ratio, 0, 1);
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    t: finiteNumber(a.t, 0) + (finiteNumber(b.t, 0) - finiteNumber(a.t, 0)) * t,
    pressure: clamp(finiteNumber(a.pressure, 0.5) + (finiteNumber(b.pressure, 0.5) - finiteNumber(a.pressure, 0.5)) * t, 0, 1),
    tiltX: finiteNumber(a.tiltX, 0) + (finiteNumber(b.tiltX, 0) - finiteNumber(a.tiltX, 0)) * t,
    tiltY: finiteNumber(a.tiltY, 0) + (finiteNumber(b.tiltY, 0) - finiteNumber(a.tiltY, 0)) * t,
  };
}

export function resampleStrokePoints(points = [], targetCount = 24) {
  const count = Math.max(0, Math.round(finiteNumber(targetCount, 24)));
  if (!count) return [];
  const clean = filterNearDuplicatePoints(points, 0);
  if (!clean.length) return [];
  if (count === 1) return [{ ...clean[0] }];
  if (clean.length === 1) return Array.from({ length: count }, () => ({ ...clean[0] }));

  const cumulative = [0];
  let total = 0;
  for (let index = 1; index < clean.length; index += 1) {
    total += pointDistance(clean[index - 1], clean[index]);
    cumulative.push(total);
  }

  if (total <= 1e-12) {
    const repeated = Array.from({ length: count }, () => ({ ...clean[0] }));
    repeated[count - 1] = { ...clean[clean.length - 1] };
    return repeated;
  }

  const output = [];
  let segmentIndex = 1;
  for (let outputIndex = 0; outputIndex < count; outputIndex += 1) {
    if (outputIndex === 0) {
      output.push({ ...clean[0] });
      continue;
    }
    if (outputIndex === count - 1) {
      output.push({ ...clean[clean.length - 1] });
      continue;
    }
    const targetLength = (total * outputIndex) / (count - 1);
    while (segmentIndex < cumulative.length - 1 && cumulative[segmentIndex] < targetLength) segmentIndex += 1;
    const previousLength = cumulative[segmentIndex - 1];
    const nextLength = cumulative[segmentIndex];
    const ratio = (targetLength - previousLength) / Math.max(1e-12, nextLength - previousLength);
    output.push(interpolatePoint(clean[segmentIndex - 1], clean[segmentIndex], ratio));
  }
  return output;
}

export function reverseStrokePoints(points = []) {
  return [...points].reverse().map((point, index) => ({ ...point, t: index * 16 }));
}
