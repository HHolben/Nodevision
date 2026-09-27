// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/ElementLayers/nodeAddress.mjs
// This module addresses authored SVG nodes by their child positions, ignoring runtime overlays so viewer promotion and history restoration can find the same objects after snapshot replacement.
export const authoredSvgChildren = node => Array.from(node.children).filter(child => !child.hasAttribute('data-nv-editor-ui'));
export function svgNodePath(root,node) {
  const path=[];
  for(let current=node;current!==root;current=current.parentElement) {
    if(!current?.parentElement) throw new Error('The SVG node is no longer in this document.');
    path.unshift(authoredSvgChildren(current.parentElement).indexOf(current));
  }
  return path;
}
export function svgNodeAtPath(root,path) {
  let node=root;for(const index of path) node=node && authoredSvgChildren(node)[index];return node || null;
}
