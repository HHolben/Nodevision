// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/ConstructAbilities/FunctionMeshAbility.mjs
// This file defines math-function mesh construction for Game View worlds. It normalizes user-provided equation configuration and builds a renderable tube mesh for placement.

import { installMovementApi } from "../movementContext.mjs";

export function installFunctionMeshAbility(ctx) {
  const { THREE } = ctx;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeFunctionConfig(rawConfig) {
    const cfg = rawConfig || {};
    const equation = typeof cfg.equation === "string" && cfg.equation.trim() ? cfg.equation.trim() : "Math.sin(x)";
    const rawResolution = Number.parseInt(cfg.resolution, 10);
    const resolution = Number.isFinite(rawResolution) ? clamp(rawResolution, 16, 192) : 96;
    const rawLimits = Array.isArray(cfg.limits) ? cfg.limits : [-8, 8];
    let xMin = Number.parseFloat(rawLimits[0]);
    let xMax = Number.parseFloat(rawLimits[1]);
    if (!Number.isFinite(xMin)) xMin = -8;
    if (!Number.isFinite(xMax)) xMax = 8;
    if (xMin > xMax) [xMin, xMax] = [xMax, xMin];
    xMax = xMin + clamp(xMax - xMin, 0.5, 80);
    return {
      equation,
      resolution,
      limits: [xMin, xMax],
      collider: cfg.collider !== false,
      color: typeof cfg.color === "string" && cfg.color ? cfg.color : "#44bbff"
    };
  }

  function evaluateFunctionY(equation, x) {
    try {
      const fn = new Function("x", "Math", "\"use strict\"; return (" + equation + ");");
      const y = fn(x, Math);
      if (!Number.isFinite(y)) return null;
      return clamp(y, -100, 100);
    } catch (_) {
      return clamp(Math.sin(x), -100, 100);
    }
  }

  function buildMathFunctionMesh(rawProps) {
    const props = normalizeFunctionConfig(rawProps);
    const [xMin, xMax] = props.limits;
    const points = [];
    for (let i = 0; i <= props.resolution; i += 1) {
      const x = xMin + (xMax - xMin) * (i / props.resolution);
      const y = evaluateFunctionY(props.equation, x);
      if (y !== null) points.push(new THREE.Vector3(x, y, 0));
    }
    if (points.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, Math.max(16, props.resolution), 0.035, 8, false);
    const material = new THREE.MeshStandardMaterial({ color: props.color, emissive: props.color, emissiveIntensity: 0.18 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.mathFunctionProperties = props;
    return mesh;
  }

  return installMovementApi(ctx, {
    clamp,
    normalizeFunctionConfig,
    evaluateFunctionY,
    buildMathFunctionMesh
  });
}
