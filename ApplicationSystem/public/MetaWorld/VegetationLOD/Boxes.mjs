// Nodevision/ApplicationSystem/public/MetaWorld/VegetationLOD/Boxes.mjs
// This bounded greedy pass merges adjacent opaque proxy cells without changing their occupied volume, material, feature identity, or detailed-chunk ownership. Transparent, textured, and wireframe materials keep their original cell surfaces and appearance.
export function mergeProxyBoxes(cells, step, materials) {
  const groups = new Map(), boxes = [];
  for (const cell of cells) {
    const material = materials[cell.material - 1];
    if (!material || material.transparent || material.opacity < 1 || material.wireframe || Object.values(material).some(value => value?.isTexture)) { boxes.push(cell); continue; }
    const key = `${cell.material}:${cell.id}:${cell.chunk}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(cell);
  }
  const key = (x,y,z) => `${x},${y},${z}`;
  for (const group of groups.values()) {
    const remaining = new Map(group.map(c => [c.p.join(','), c]));
    for (const cell of group) {
      const [x,y,z] = cell.p;
      if (!remaining.has(key(x,y,z))) continue;
      let width = 1, depth = 1, height = 1;
      while (remaining.has(key(x+width*step,y,z))) width++;
      const row = (yy,zz) => {
        for (let xx=0; xx<width; xx++) if (!remaining.has(key(x+xx*step,yy,zz))) return false;
        return true;
      };
      while (row(y,z+depth*step)) depth++;
      const plane = yy => {
        for (let zz=0; zz<depth; zz++) if (!row(yy,z+zz*step)) return false;
        return true;
      };
      while (plane(y+height*step)) height++;
      for (let yy=0; yy<height; yy++) for (let zz=0; zz<depth; zz++) for (let xx=0; xx<width; xx++) {
        remaining.delete(key(x+xx*step,y+yy*step,z+zz*step));
      }
      boxes.push({...cell, size: [width*step,height*step,depth*step], sourceCount: width*height*depth});
    }
  }
  return boxes;
}
