// Nodevision/ApplicationSystem/public/MetaWorld/Paths/PathDefinition.mjs
// This module validates persistent physical paths independently of generated meshes, terrain chunks, portals, and navigation graphs.
export function validatePath(source) {
  const d = structuredClone(source), number = (v, fallback, min, max) => {
    const n = v ?? fallback;
    if (!Number.isFinite(n) || n < min || n > max) throw Error(`Path value must be between ${min} and ${max}.`);
    return n;
  };
  const vector = p => {
    if (!Array.isArray(p) || p.length !== 3 || p.some(v => !Number.isFinite(v) || Math.abs(v) > 1e6)) throw Error('Path points must contain finite XYZ coordinates.');
    return p;
  };
  if (!d.id || typeof d.id !== 'string') throw Error('Path requires an identifier.');
  if (d.rotation?.some(v=>v!==0) || d.scale?.some(v=>v!==1)) throw Error('Edit path control points and width instead of rotating or scaling its mesh.');
  if (!Array.isArray(d.controlPoints) || d.controlPoints.length < 2 || d.controlPoints.length > 1024) throw Error('Path requires 2 to 1024 control points.');
  d.controlPoints.forEach(vector);
  for (let i = 1; i < d.controlPoints.length; i++) {
    const a = d.controlPoints[i - 1], b = d.controlPoints[i];
    if (Math.hypot(a[0] - b[0], a[2] - b[2]) < .05) throw Error('Path points must be at least 5 cm apart horizontally.');
  }
  for (const [key, choices] of Object.entries({interpolation:['smooth','straight'], elevationMode:['authored','follow-terrain'], terrainInteraction:['grade','none']})) {
    d[key] ??= choices[0];
    if (!choices.includes(d[key])) throw Error(`Unsupported path ${key}.`);
  }
  return {type:'physical-path', id:d.id, name:String(d.name || 'Path'), position:vector(d.position || [0,0,0]),
    controlPoints:d.controlPoints, width:number(d.width,2,.1,50), interpolation:d.interpolation,
    elevationMode:d.elevationMode, terrainInteraction:d.terrainInteraction, crossSlope:0,
    transitionWidth:number(d.transitionWidth,1,0,50), surfaceMaterial:String(d.surfaceMaterial || 'gravel'),
    visible:d.visible !== false && !d.hidden, collision:d.collision !== false, proceduralExclusion:d.proceduralExclusion !== false};
}
