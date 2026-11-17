// Existing movement gizmos, scoped to their GameView movement state.
const controls=new WeakMap();
export function registerAnatomyGizmos(state,api){controls.set(state,api);}
export function anatomyGizmos(state){return controls.get(state);}
// Sprite geometry and arrow textures belong to Three/the movement context; handle materials
// and mesh-handle geometries belong to the gizmo. Never traverse its selected model.
export function disposeGizmoHandles(handles=[]){const geometry=new Set();for(const h of handles){h.removeFromParent();h.material?.dispose();if(!h.isSprite&&h.geometry)geometry.add(h.geometry);}for(const g of geometry)g.dispose();}
