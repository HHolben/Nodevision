// Nodevision/ApplicationSystem/public/ImageStitching/ImageStitchingCore.mjs
// Dependency-free landmark-based 2D image stitching primitives.

const DEFAULT_NEIGHBOR_CONFIDENCE_THRESHOLD = 0.42;
const IDENTITY_AFFINE = Object.freeze([1, 0, 0, 1, 0, 0]);

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function inferGrid(count) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  if (total <= 1) return { rows: 1, cols: Math.max(1, total) };
  let cols = Math.ceil(Math.sqrt(total));
  while (cols > 1 && total % cols !== 0) cols -= 1;
  if (cols === 1) cols = Math.ceil(Math.sqrt(total));
  return { rows: Math.ceil(total / cols), cols };
}

export function mapItemsToGrid(items, rows, cols) {
  const height = Math.max(1, Math.floor(Number(rows) || 1));
  const width = Math.max(1, Math.floor(Number(cols) || 1));
  const grid = Array.from({ length: height }, () => Array(width).fill(null));
  for (let index = 0; index < items.length && index < height * width; index += 1) {
    const row = Math.floor(index / width);
    const col = index % width;
    grid[row][col] = items[index];
  }
  return grid;
}

export function getGridNeighborPairs(grid) {
  const pairs = [];
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < (grid[row]?.length || 0); col += 1) {
      const item = grid[row][col];
      if (!item) continue;
      const right = grid[row]?.[col + 1] || null;
      const down = grid[row + 1]?.[col] || null;
      if (right) pairs.push({ from: item.index, to: right.index, fromCell: { row, col }, toCell: { row, col: col + 1 }, direction: "right" });
      if (down) pairs.push({ from: item.index, to: down.index, fromCell: { row, col }, toCell: { row: row + 1, col }, direction: "down" });
    }
  }
  return pairs;
}

export function makeGrayImageFromRgba(width, height, rgba) {
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; p < gray.length; i += 4, p += 1) {
    gray[p] = (rgba[i] * 0.2126 + rgba[i + 1] * 0.7152 + rgba[i + 2] * 0.0722) / 255;
  }
  return { width, height, gray };
}

export function detectHarrisKeypoints(image, options = {}) {
  const width = image.width;
  const height = image.height;
  const gray = image.gray;
  const maxKeypoints = Math.max(24, Math.floor(options.maxKeypoints || 520));
  const minDistance = Math.max(4, Math.floor(options.minDistance || 9));
  const responseRadius = Math.max(1, Math.floor(options.responseRadius || 2));
  if (!width || !height || width < minDistance * 2 || height < minDistance * 2) return [];

  const ix = new Float32Array(width * height);
  const iy = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const p = y * width + x;
      ix[p] =
        -gray[p - width - 1] - 2 * gray[p - 1] - gray[p + width - 1] +
        gray[p - width + 1] + 2 * gray[p + 1] + gray[p + width + 1];
      iy[p] =
        -gray[p - width - 1] - 2 * gray[p - width] - gray[p - width + 1] +
        gray[p + width - 1] + 2 * gray[p + width] + gray[p + width + 1];
    }
  }

  const candidates = [];
  const margin = Math.max(minDistance, responseRadius + 1, Math.floor(options.patchRadius || 5) + 1);
  for (let y = margin; y < height - margin; y += 1) {
    for (let x = margin; x < width - margin; x += 1) {
      let sxx = 0;
      let syy = 0;
      let sxy = 0;
      for (let yy = y - responseRadius; yy <= y + responseRadius; yy += 1) {
        const base = yy * width;
        for (let xx = x - responseRadius; xx <= x + responseRadius; xx += 1) {
          const gx = ix[base + xx];
          const gy = iy[base + xx];
          sxx += gx * gx;
          syy += gy * gy;
          sxy += gx * gy;
        }
      }
      const det = sxx * syy - sxy * sxy;
      const trace = sxx + syy;
      const response = det - 0.04 * trace * trace;
      if (response > 0.00002) candidates.push({ x, y, response });
    }
  }

  candidates.sort((a, b) => b.response - a.response);
  const selected = [];
  const minDistanceSq = minDistance * minDistance;
  for (const candidate of candidates) {
    let tooClose = false;
    for (const kept of selected) {
      const dx = candidate.x - kept.x;
      const dy = candidate.y - kept.y;
      if (dx * dx + dy * dy < minDistanceSq) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) selected.push(candidate);
    if (selected.length >= maxKeypoints) break;
  }
  return selected;
}

export function describeKeypoints(image, keypoints, options = {}) {
  const radius = Math.max(3, Math.floor(options.patchRadius || 5));
  const width = image.width;
  const height = image.height;
  const descriptors = [];
  for (const point of keypoints) {
    if (point.x < radius || point.y < radius || point.x >= width - radius || point.y >= height - radius) continue;
    const values = [];
    let sum = 0;
    for (let y = point.y - radius; y <= point.y + radius; y += 1) {
      for (let x = point.x - radius; x <= point.x + radius; x += 1) {
        const value = image.gray[y * width + x];
        values.push(value);
        sum += value;
      }
    }
    const mean = sum / values.length;
    let norm = 0;
    for (let i = 0; i < values.length; i += 1) {
      values[i] -= mean;
      norm += values[i] * values[i];
    }
    norm = Math.sqrt(norm);
    if (norm < 1e-5) continue;
    const descriptor = new Float32Array(values.length);
    for (let i = 0; i < values.length; i += 1) descriptor[i] = values[i] / norm;
    descriptors.push({
      x: point.x,
      y: point.y,
      response: point.response,
      descriptor,
    });
  }
  return descriptors;
}

export function extractFeatures(image, options = {}) {
  const keypoints = detectHarrisKeypoints(image, options);
  return describeKeypoints(image, keypoints, options);
}

function descriptorDistanceSq(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return sum;
}

function bestDescriptorMatches(source, target, ratio) {
  const matches = [];
  for (let i = 0; i < source.length; i += 1) {
    let bestIndex = -1;
    let best = Infinity;
    let second = Infinity;
    for (let j = 0; j < target.length; j += 1) {
      const distance = descriptorDistanceSq(source[i].descriptor, target[j].descriptor);
      if (distance < best) {
        second = best;
        best = distance;
        bestIndex = j;
      } else if (distance < second) {
        second = distance;
      }
    }
    if (bestIndex >= 0 && best < second * ratio * ratio) {
      matches.push({ sourceIndex: i, targetIndex: bestIndex, distance: best });
    }
  }
  return matches;
}

export function matchFeatureDescriptors(featuresA, featuresB, options = {}) {
  const ratio = clamp(Number(options.ratio) || 0.78, 0.55, 0.98);
  const forward = bestDescriptorMatches(featuresA, featuresB, ratio);
  const backward = bestDescriptorMatches(featuresB, featuresA, ratio);
  const reverse = new Map(backward.map((match) => [`${match.sourceIndex}:${match.targetIndex}`, match]));
  const matches = [];
  for (const match of forward) {
    if (!reverse.has(`${match.targetIndex}:${match.sourceIndex}`)) continue;
    const a = featuresA[match.sourceIndex];
    const b = featuresB[match.targetIndex];
    matches.push({
      a: { x: a.x, y: a.y },
      b: { x: b.x, y: b.y },
      distance: match.distance,
    });
  }
  matches.sort((a, b) => a.distance - b.distance);
  return matches.slice(0, Math.max(24, Math.floor(options.maxMatches || 260)));
}

export function applyAffine(matrix, point) {
  return {
    x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
    y: matrix[1] * point.x + matrix[3] * point.y + matrix[5],
  };
}

export function multiplyAffine(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export function invertAffine(matrix) {
  const det = matrix[0] * matrix[3] - matrix[1] * matrix[2];
  if (Math.abs(det) < 1e-9) return null;
  const invA = matrix[3] / det;
  const invB = -matrix[1] / det;
  const invC = -matrix[2] / det;
  const invD = matrix[0] / det;
  return [
    invA,
    invB,
    invC,
    invD,
    -(invA * matrix[4] + invC * matrix[5]),
    -(invB * matrix[4] + invD * matrix[5]),
  ];
}

export function scaleAffineTranslation(matrix, scaleX, scaleY) {
  return [matrix[0], matrix[1], matrix[2], matrix[3], matrix[4] * scaleX, matrix[5] * scaleY];
}

export function solveLinearSystem(matrix, vector) {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const divisor = a[col][col];
    for (let j = col; j <= n; j += 1) a[col][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      if (Math.abs(factor) < 1e-12) continue;
      for (let j = col; j <= n; j += 1) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row[n]);
}

export function estimateAffineLeastSquares(matches) {
  if (!matches || matches.length < 3) return null;
  const normal = Array.from({ length: 6 }, () => Array(6).fill(0));
  const rhs = Array(6).fill(0);
  for (const match of matches) {
    const x = match.b.x;
    const y = match.b.y;
    const tx = match.a.x;
    const ty = match.a.y;
    const rowX = [x, 0, y, 0, 1, 0];
    const rowY = [0, x, 0, y, 0, 1];
    for (let r = 0; r < 6; r += 1) {
      rhs[r] += rowX[r] * tx + rowY[r] * ty;
      for (let c = 0; c < 6; c += 1) {
        normal[r][c] += rowX[r] * rowX[c] + rowY[r] * rowY[c];
      }
    }
  }
  return solveLinearSystem(normal, rhs);
}

function seededRandom(seedValue) {
  let seed = seedValue >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function sampleThree(count, random) {
  const a = Math.floor(random() * count);
  let b = Math.floor(random() * count);
  let c = Math.floor(random() * count);
  if (b === a) b = (b + 1) % count;
  while (c === a || c === b) c = (c + 1) % count;
  return [a, b, c];
}

function reprojectionError(matrix, match) {
  const p = applyAffine(matrix, match.b);
  const dx = p.x - match.a.x;
  const dy = p.y - match.a.y;
  return Math.hypot(dx, dy);
}

export function estimateAffineRansac(matches, options = {}) {
  const minimumMatches = Math.max(3, Math.floor(options.minimumMatches || 8));
  if (!matches || matches.length < minimumMatches) {
    return { ok: false, reason: "not_enough_matches", matrix: null, inliers: [], confidence: 0 };
  }
  const iterations = Math.max(50, Math.floor(options.iterations || 360));
  const threshold = Math.max(1, Number(options.threshold) || 4);
  const random = seededRandom(options.seed ?? 0x51f15e);
  let bestMatrix = null;
  let bestInliers = [];
  let bestError = Infinity;

  for (let i = 0; i < iterations; i += 1) {
    const sample = sampleThree(matches.length, random).map((index) => matches[index]);
    const matrix = estimateAffineLeastSquares(sample);
    if (!matrix) continue;
    const inliers = [];
    let errorSum = 0;
    for (const match of matches) {
      const error = reprojectionError(matrix, match);
      if (error <= threshold) {
        inliers.push(match);
        errorSum += error;
      }
    }
    const meanError = inliers.length ? errorSum / inliers.length : Infinity;
    if (inliers.length > bestInliers.length || (inliers.length === bestInliers.length && meanError < bestError)) {
      bestMatrix = matrix;
      bestInliers = inliers;
      bestError = meanError;
    }
  }

  if (bestInliers.length < minimumMatches) {
    return { ok: false, reason: "ransac_rejected", matrix: null, inliers: bestInliers, confidence: 0 };
  }

  const refined = estimateAffineLeastSquares(bestInliers) || bestMatrix;
  let refinedError = 0;
  for (const match of bestInliers) refinedError += reprojectionError(refined, match);
  refinedError /= Math.max(1, bestInliers.length);
  const inlierRatio = bestInliers.length / matches.length;
  const support = clamp(bestInliers.length / Math.max(minimumMatches * 2, 1), 0, 1);
  const errorScore = clamp(1 - refinedError / (threshold * 2.5), 0, 1);
  const confidence = clamp(0.5 * inlierRatio + 0.3 * support + 0.2 * errorScore, 0, 1);
  return {
    ok: confidence >= (options.confidenceThreshold ?? DEFAULT_NEIGHBOR_CONFIDENCE_THRESHOLD),
    reason: confidence >= (options.confidenceThreshold ?? DEFAULT_NEIGHBOR_CONFIDENCE_THRESHOLD) ? "ok" : "low_confidence",
    matrix: refined,
    inliers: bestInliers,
    confidence,
    inlierRatio,
    meanError: refinedError,
  };
}

function transformMatchScale(match, scaleA, scaleB) {
  return {
    ...match,
    a: { x: match.a.x / scaleA.x, y: match.a.y / scaleA.y },
    b: { x: match.b.x / scaleB.x, y: match.b.y / scaleB.y },
  };
}

export function estimatePairRegistration(imageA, imageB, options = {}) {
  const featuresA = imageA.features || extractFeatures(imageA.work || imageA, options.features);
  const featuresB = imageB.features || extractFeatures(imageB.work || imageB, options.features);
  const descriptorMatches = matchFeatureDescriptors(featuresA, featuresB, options.matching);
  const manualMatches = (options.manualMatches || []).map((match) => ({ ...match, manual: true, distance: 0 }));
  const allMatches = [...manualMatches, ...descriptorMatches];
  const ransac = estimateAffineRansac(allMatches, options.ransac);
  if (!ransac.ok || !ransac.matrix) {
    return {
      ok: false,
      reason: ransac.reason,
      matrix: null,
      confidence: ransac.confidence,
      matches: descriptorMatches,
      inliers: ransac.inliers || [],
      featuresA: featuresA.length,
      featuresB: featuresB.length,
    };
  }

  const scaleA = imageA.workScale || { x: 1, y: 1 };
  const scaleB = imageB.workScale || { x: 1, y: 1 };
  const fullMatches = allMatches.map((match) => transformMatchScale(match, scaleA, scaleB));
  const fullRansac = estimateAffineRansac(fullMatches, {
    ...(options.ransac || {}),
    threshold: Math.max(2, (options.ransac?.threshold || 4) / Math.min(scaleA.x || 1, scaleA.y || 1, scaleB.x || 1, scaleB.y || 1)),
  });
  const fullMatrix = fullRansac.matrix || [
    ransac.matrix[0] * (scaleB.x / scaleA.x),
    ransac.matrix[1] * (scaleB.x / scaleA.y),
    ransac.matrix[2] * (scaleB.y / scaleA.x),
    ransac.matrix[3] * (scaleB.y / scaleA.y),
    ransac.matrix[4] / scaleA.x,
    ransac.matrix[5] / scaleA.y,
  ];
  return {
    ok: fullRansac.ok,
    reason: fullRansac.reason,
    matrix: fullMatrix,
    workMatrix: ransac.matrix,
    confidence: fullRansac.confidence || ransac.confidence,
    matches: descriptorMatches,
    inliers: fullRansac.inliers || [],
    workInliers: ransac.inliers || [],
    featuresA: featuresA.length,
    featuresB: featuresB.length,
    meanError: fullRansac.meanError,
  };
}

export function solveTransformsFromEdges(images, edges, options = {}) {
  const n = images.length;
  if (!n) return [];
  const referenceIndex = options.referenceIndex ?? Math.floor(n / 2);
  const transforms = Array(n).fill(null);
  const bestCost = Array(n).fill(Infinity);
  transforms[referenceIndex] = [...IDENTITY_AFFINE];
  bestCost[referenceIndex] = 0;

  const adjacency = Array.from({ length: n }, () => []);
  for (const edge of edges) {
    if (!edge.ok || !edge.matrix) continue;
    const inverse = invertAffine(edge.matrix);
    if (!inverse) continue;
    const cost = 1 / Math.max(0.02, edge.confidence || 0.02);
    adjacency[edge.from].push({ to: edge.to, matrix: edge.matrix, cost });
    adjacency[edge.to].push({ to: edge.from, matrix: inverse, cost });
  }

  const pending = new Set([referenceIndex]);
  while (pending.size) {
    let current = null;
    for (const candidate of pending) {
      if (current === null || bestCost[candidate] < bestCost[current]) current = candidate;
    }
    pending.delete(current);
    for (const link of adjacency[current]) {
      const nextCost = bestCost[current] + link.cost;
      if (nextCost >= bestCost[link.to]) continue;
      transforms[link.to] = multiplyAffine(transforms[current], link.matrix);
      bestCost[link.to] = nextCost;
      pending.add(link.to);
    }
  }

  return transforms.map((matrix, index) => ({
    index,
    matrix,
    resolved: Boolean(matrix),
    confidencePathCost: bestCost[index],
  }));
}

export function transformedCorners(image, matrix) {
  const width = image.width || image.decoded?.width || 1;
  const height = image.height || image.decoded?.height || 1;
  return [
    applyAffine(matrix, { x: 0, y: 0 }),
    applyAffine(matrix, { x: width, y: 0 }),
    applyAffine(matrix, { x: width, y: height }),
    applyAffine(matrix, { x: 0, y: height }),
  ];
}

export function computeMosaicBounds(images, transforms) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const entry of transforms) {
    if (!entry?.matrix) continue;
    const image = images[entry.index];
    for (const point of transformedCorners(image, entry.matrix)) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1 };
  }
  const pad = 2;
  minX = Math.floor(minX) - pad;
  minY = Math.floor(minY) - pad;
  maxX = Math.ceil(maxX) + pad;
  maxY = Math.ceil(maxY) + pad;
  return { minX, minY, maxX, maxY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

export function offsetTransformsToBounds(transforms, bounds) {
  const offset = [1, 0, 0, 1, -bounds.minX, -bounds.minY];
  return transforms.map((entry) => ({
    ...entry,
    matrix: entry.matrix ? multiplyAffine(offset, entry.matrix) : null,
  }));
}

export function buildStitchManifest({ images, grid, edges, transforms, bounds, algorithm = "harris-patch-affine-ransac" }) {
  return {
    format: "NodevisionImageMosaicLayout",
    version: 2,
    createdAt: new Date().toISOString(),
    model: "landmark-affine",
    algorithm,
    bounds,
    grid: grid.map((row) => row.map((image) => image ? image.index : null)),
    images: images.map((image) => {
      const transform = transforms.find((entry) => entry.index === image.index);
      return {
        index: image.index,
        fileName: image.fileName || image.file?.name || `Image ${image.index + 1}`,
        width: image.width || image.decoded?.width,
        height: image.height || image.decoded?.height,
        resolved: Boolean(transform?.matrix),
        affine: transform?.matrix || null,
      };
    }),
    alignments: edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      direction: edge.direction,
      ok: Boolean(edge.ok),
      reason: edge.reason,
      confidence: edge.confidence || 0,
      matchedLandmarks: edge.matches?.length || 0,
      inlierLandmarks: edge.inliers?.length || edge.workInliers?.length || 0,
      affine: edge.matrix || null,
      fromName: edge.fromName,
      toName: edge.toName,
    })),
  };
}

export const __imageStitchingCoreTest = Object.freeze({
  DEFAULT_NEIGHBOR_CONFIDENCE_THRESHOLD,
  descriptorDistanceSq,
  bestDescriptorMatches,
  reprojectionError,
});
