// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/playerJump.mjs
// This module bounds ground-jump impulses by a metre-based apex limit using the existing gravity-before-position integration order.
export const MAX_PLAYER_JUMP_HEIGHT = .6;
export function cappedJumpImpulse(requested,gravity){
  if(!Number.isFinite(gravity)||gravity<=0)return 0;
  // The continuous maximum of n*v - g*n*(n+1)/2 bounds every discrete frame apex.
  const limit=Math.sqrt(2*gravity*MAX_PLAYER_JUMP_HEIGHT)+gravity/2;
  return Math.max(0,Math.min(Number(requested)||0,limit));
}
