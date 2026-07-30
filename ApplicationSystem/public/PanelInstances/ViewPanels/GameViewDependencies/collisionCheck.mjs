// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/collisionCheck.mjs
// This file provides collision checks between the player and world colliders.

function pointWithinPlaneConstraints(eq, point, padding = 0) {
  if (!eq || !point) return false;
  if (eq.boundX === true && (point.x < Math.min(eq.xmin ?? -15, eq.xmax ?? 15) - padding || point.x > Math.max(eq.xmin ?? -15, eq.xmax ?? 15) + padding)) return false;
  if (eq.boundY === true && (point.y < Math.min(eq.ymin ?? -15, eq.ymax ?? 15) - padding || point.y > Math.max(eq.ymin ?? -15, eq.ymax ?? 15) + padding)) return false;
  if (eq.boundZ === true && (point.z < Math.min(eq.zmin ?? -15, eq.zmax ?? 15) - padding || point.z > Math.max(eq.zmin ?? -15, eq.zmax ?? 15) + padding)) return false;
  return true;
}

function signedPlaneDistance(collider, point) {
  const eq = collider?.equation || {};
  const a = Number.isFinite(eq.a) ? eq.a : 0;
  const b = Number.isFinite(eq.b) ? eq.b : 1;
  const c = Number.isFinite(eq.c) ? eq.c : 0;
  const d = Number.isFinite(eq.d) ? eq.d : 0;
  const len = Math.hypot(a, b, c) || 1;
  return ((a * point.x) + (b * point.y) + (c * point.z) + d) / len;
}

function expressionHeightfieldCutsPlayer(collider, nextPosition, movementState, playerRadius, playerMinY, playerMaxY) {
  if (collider.target?.visible === false || typeof collider.sampleGroundY !== "function") return false;

  const colliderId = collider.layerId || collider.target?.uuid || "expression-heightfield";
  const activeSurface = movementState?.isGrounded === true
    && movementState?.activeExpressionTerrainColliderId
    && movementState.activeExpressionTerrainColliderId === colliderId;
  if (activeSurface) return false;

  const stepAllowance = Number.isFinite(movementState?.groundSnapDistance)
    ? Math.max(0.12, movementState.groundSnapDistance)
    : 0.55;
  const headPadding = 0.04;
  const sampleRadius = Math.max(0, playerRadius * 0.65);
  const offsets = [
    [0, 0],
    [sampleRadius, 0],
    [-sampleRadius, 0],
    [0, sampleRadius],
    [0, -sampleRadius]
  ];

  for (const [dx, dz] of offsets) {
    const surfaceY = collider.sampleGroundY(nextPosition.x + dx, nextPosition.z + dz);
    if (!Number.isFinite(surfaceY)) continue;
    if (surfaceY <= playerMinY + stepAllowance) continue;
    if (surfaceY < playerMaxY - headPadding) return true;
  }
  return false;
}

function boxCutsPlayer(box, nextPosition, playerRadius, playerMinY, playerMaxY) {
  if (!box) return false;
  const minX = box.min.x - playerRadius;
  const maxX = box.max.x + playerRadius;
  const minZ = box.min.z - playerRadius;
  const maxZ = box.max.z + playerRadius;
  const overlapsY = playerMaxY >= box.min.y && playerMinY <= box.max.y;
  return nextPosition.x >= minX && nextPosition.x <= maxX && nextPosition.z >= minZ && nextPosition.z <= maxZ && overlapsY;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function vecSub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vecDot(a, b) {
  return (a.x * b.x) + (a.y * b.y) + (a.z * b.z);
}

function vecCross(a, b) {
  return {
    x: (a.y * b.z) - (a.z * b.y),
    y: (a.z * b.x) - (a.x * b.z),
    z: (a.x * b.y) - (a.y * b.x)
  };
}

function pointDistanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return (dx * dx) + (dy * dy) + (dz * dz);
}

function closestPointOnTriangle(point, a, b, c) {
  const ab = vecSub(b, a);
  const ac = vecSub(c, a);
  const ap = vecSub(point, a);
  const d1 = vecDot(ab, ap);
  const d2 = vecDot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;

  const bp = vecSub(point, b);
  const d3 = vecDot(ab, bp);
  const d4 = vecDot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;

  const vc = (d1 * d4) - (d3 * d2);
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return { x: a.x + (ab.x * v), y: a.y + (ab.y * v), z: a.z + (ab.z * v) };
  }

  const cp = vecSub(point, c);
  const d5 = vecDot(ab, cp);
  const d6 = vecDot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;

  const vb = (d5 * d2) - (d1 * d6);
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return { x: a.x + (ac.x * w), y: a.y + (ac.y * w), z: a.z + (ac.z * w) };
  }

  const va = (d3 * d6) - (d5 * d4);
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
    const bc = vecSub(c, b);
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    return { x: b.x + (bc.x * w), y: b.y + (bc.y * w), z: b.z + (bc.z * w) };
  }

  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  return {
    x: a.x + (ab.x * v) + (ac.x * w),
    y: a.y + (ab.y * v) + (ac.y * w),
    z: a.z + (ab.z * v) + (ac.z * w)
  };
}

function segmentSegmentDistanceSq(p1, q1, p2, q2) {
  const epsilon = 1e-9;
  const d1 = vecSub(q1, p1);
  const d2 = vecSub(q2, p2);
  const r = vecSub(p1, p2);
  const a = vecDot(d1, d1);
  const e = vecDot(d2, d2);
  const f = vecDot(d2, r);
  let s = 0;
  let t = 0;

  if (a <= epsilon && e <= epsilon) return pointDistanceSq(p1, p2);
  if (a <= epsilon) {
    t = e > epsilon ? clamp01(f / e) : 0;
  } else {
    const c = vecDot(d1, r);
    if (e <= epsilon) {
      s = clamp01(-c / a);
    } else {
      const b = vecDot(d1, d2);
      const denom = (a * e) - (b * b);
      s = denom !== 0 ? clamp01(((b * f) - (c * e)) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }

  const c1 = { x: p1.x + (d1.x * s), y: p1.y + (d1.y * s), z: p1.z + (d1.z * s) };
  const c2 = { x: p2.x + (d2.x * t), y: p2.y + (d2.y * t), z: p2.z + (d2.z * t) };
  return pointDistanceSq(c1, c2);
}

function segmentIntersectsTriangle(p0, p1, a, b, c) {
  const epsilon = 1e-9;
  const dir = vecSub(p1, p0);
  const edge1 = vecSub(b, a);
  const edge2 = vecSub(c, a);
  const pvec = vecCross(dir, edge2);
  const det = vecDot(edge1, pvec);
  if (Math.abs(det) < epsilon) return false;
  const invDet = 1 / det;
  const tvec = vecSub(p0, a);
  const u = vecDot(tvec, pvec) * invDet;
  if (u < 0 || u > 1) return false;
  const qvec = vecCross(tvec, edge1);
  const v = vecDot(dir, qvec) * invDet;
  if (v < 0 || u + v > 1) return false;
  const distance = vecDot(edge2, qvec) * invDet;
  return distance >= 0 && distance <= 1;
}

function triangleCutsPlayer(triangle, nextPosition, playerRadius, playerMinY, playerMaxY) {
  if (!Array.isArray(triangle) || triangle.length < 3) return false;
  const [a, b, c] = triangle;
  if (!a || !b || !c) return false;
  const minX = Math.min(a.x, b.x, c.x) - playerRadius;
  const maxX = Math.max(a.x, b.x, c.x) + playerRadius;
  const minY = Math.min(a.y, b.y, c.y) - playerRadius;
  const maxY = Math.max(a.y, b.y, c.y) + playerRadius;
  const minZ = Math.min(a.z, b.z, c.z) - playerRadius;
  const maxZ = Math.max(a.z, b.z, c.z) + playerRadius;
  if (nextPosition.x < minX || nextPosition.x > maxX || nextPosition.z < minZ || nextPosition.z > maxZ) return false;
  if (playerMaxY < minY || playerMinY > maxY) return false;

  const segmentBottom = { x: nextPosition.x, y: playerMinY, z: nextPosition.z };
  const segmentTop = { x: nextPosition.x, y: playerMaxY, z: nextPosition.z };
  if (segmentIntersectsTriangle(segmentBottom, segmentTop, a, b, c)) return true;

  const radiusSq = playerRadius * playerRadius;
  let minDistanceSq = pointDistanceSq(segmentBottom, closestPointOnTriangle(segmentBottom, a, b, c));
  minDistanceSq = Math.min(minDistanceSq, pointDistanceSq(segmentTop, closestPointOnTriangle(segmentTop, a, b, c)));
  minDistanceSq = Math.min(minDistanceSq, segmentSegmentDistanceSq(segmentBottom, segmentTop, a, b));
  minDistanceSq = Math.min(minDistanceSq, segmentSegmentDistanceSq(segmentBottom, segmentTop, b, c));
  minDistanceSq = Math.min(minDistanceSq, segmentSegmentDistanceSq(segmentBottom, segmentTop, c, a));
  return minDistanceSq <= radiusSq;
}

function compoundCutsPlayer(collider, nextPosition, playerRadius, playerMinY, playerMaxY) {
  if (collider.target?.visible === false) return false;
  if (typeof collider.update === "function") collider.update();
  const triangles = Array.isArray(collider.worldTriangles) ? collider.worldTriangles : [];
  if (triangles.length) {
    for (const triangle of triangles) {
      if (triangleCutsPlayer(triangle, nextPosition, playerRadius, playerMinY, playerMaxY)) return true;
    }
    return false;
  }

  const boxes = Array.isArray(collider.boxes) ? collider.boxes : [];
  for (const part of boxes) {
    if (boxCutsPlayer(part?.box, nextPosition, playerRadius, playerMinY, playerMaxY)) return true;
  }
  return false;
}

export function createCollisionChecker({ colliders, movementState, playerRadius }) {
  return function wouldCollide(nextPosition) {
    if (movementState) movementState.lastCollisionCollider = null;
    if (movementState?.phaseThroughObjects === true) return false;
    const hit = (collider) => {
      if (movementState) movementState.lastCollisionCollider = collider || null;
      return true;
    };
    const playerMinY = nextPosition.y - movementState.playerHeight;
    const playerMaxY = nextPosition.y;
    for (const collider of colliders) {
      if (collider.type === "box") {
        if (boxCutsPlayer(collider.box, nextPosition, playerRadius, playerMinY, playerMaxY)) return hit(collider);
      } else if (collider.type === "compound") {
        if (compoundCutsPlayer(collider, nextPosition, playerRadius, playerMinY, playerMaxY)) return hit(collider);
      } else if (collider.type === "equation-plane") {
        if (collider.target?.visible === false) continue;
        const threshold = playerRadius + Math.max(0.02, Number(collider.thickness) || 0.2) / 2;
        const samples = [
          nextPosition,
          { x: nextPosition.x, y: playerMinY, z: nextPosition.z },
          { x: nextPosition.x, y: (playerMinY + playerMaxY) / 2, z: nextPosition.z }
        ];
        if (samples.some((point) => pointWithinPlaneConstraints(collider.equation || {}, point, threshold) && Math.abs(signedPlaneDistance(collider, point)) <= threshold)) return hit(collider);
      } else if (collider.type === "sphere") {
        const dx = nextPosition.x - collider.center.x;
        const dz = nextPosition.z - collider.center.z;
        const totalRadius = collider.radius + playerRadius;
        let dy = 0;
        if (collider.center.y < playerMinY) dy = playerMinY - collider.center.y;
        else if (collider.center.y > playerMaxY) dy = collider.center.y - playerMaxY;
        if (dx * dx + dy * dy + dz * dz <= totalRadius * totalRadius) return hit(collider);
      } else if (collider.type === "expression-heightfield") {
        if (expressionHeightfieldCutsPlayer(collider, nextPosition, movementState, playerRadius, playerMinY, playerMaxY)) return hit(collider);
      }
    }
    return false;
  };
}
