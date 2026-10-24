// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/Placement.mjs
// This module retains the previous geographic anchor during explicit crop regeneration so changing the cropped minimum does not move unchanged terrain away from authored world-space paths and objects.
export function geographicRegenerationPosition(current,next) {
  if(current.terrainSource!=='geographic'||next.geographic?.version!==2)return current.position;
  const a=current.geographic.origin,b=next.geographic.origin,scale=next.geographic.horizontalScale;
  return [current.position[0]+(b[0]-a[0])*scale,current.position[1],current.position[2]+(a[1]-b[1])*scale];
}
