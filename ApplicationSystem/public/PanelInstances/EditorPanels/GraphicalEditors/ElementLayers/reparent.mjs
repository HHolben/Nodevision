// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/ElementLayers/reparent.mjs
// This module validates SVG hierarchy moves and preserves the original node, inherited paint, and canvas transform while rejecting compositing or stylesheet changes that cannot be safely reproduced.
import { svgNodePath, svgNodeAtPath } from './nodeAddress.mjs';
const SVG = 'http://www.w3.org/2000/svg';
const inherited = 'color fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset paint-order font-family font-size font-style font-weight font-stretch font-variant letter-spacing word-spacing text-anchor dominant-baseline visibility color-interpolation color-interpolation-filters shape-rendering text-rendering image-rendering marker-start marker-mid marker-end'.split(' ');
const checked = [...inherited, ...'opacity filter clip-path mask mix-blend-mode isolation display transform transform-origin transform-box vector-effect x y width height cx cy r rx ry d stop-color stop-opacity'.split(' ')];
const styleOf = node => node.ownerDocument.defaultView.getComputedStyle(node);
const tag = node => node?.localName?.toLowerCase();
function locked(node, root) {
  for (let p=node; p && p!==root; p=p.parentElement) if (p.getAttribute('data-nv-locked')==='true' || p.hasAttribute('data-nv-editor-ui')) return true;
  return false;
}
export function svgDropRejection(root, element, target, before = null) {
  if (!root || !element || !target || element===root || !root.contains(element) || !root.contains(target)) return 'The source and destination must belong to this SVG.';
  if (element===target || element.contains(target)) return 'An object cannot move into itself or its descendants.';
  if (target.namespaceURI!==SVG || !['g','svg'].includes(tag(target)) || (tag(target)==='svg' && target!==root)) return 'Drop onto a layer, group, or the document root.';
  if (!['g','a','rect','circle','ellipse','path','polygon','polyline','line','text','image','use','foreignobject'].includes(tag(element))) return 'This SVG resource cannot be moved as a drawable object.';
  if (before && (before.parentNode!==target || before===element)) return 'Invalid insertion position.';
  if (locked(element,root) || locked(target,root)) return 'Unlock the source and destination first.';
  for (const node of [element.parentElement,target]) for(let p=node;p && p!==root;p=p.parentElement) if(tag(p)!=='g') return 'Moves through resource, link, or nested viewport containers are not supported.';
  return '';
}
function matrixValues(matrix) { return matrix && ['a','b','c','d','e','f'].map(key=>matrix[key]); }
function sameMatrix(a,b) { const x=matrixValues(a), y=matrixValues(b); return Boolean(x && y && x.every((v,i)=>Number.isFinite(v) && Math.abs(v-y[i])<1e-5)); }
function branchEffects(parent, common) {
  for(let p=parent;p && p!==common;p=p.parentElement) {
    const style=styleOf(p);
    if(Number(style.opacity)!==1 || ['filter','clip-path','mask','mask-image'].some(k=>!['none',''].includes(style.getPropertyValue(k))) || style.mixBlendMode!=='normal' || style.isolation==='isolate' || style.display==='none' || style.visibility!=='visible') return true;
  }
  return false;
}
function capture(element) {
  const nodes=[element];
  for(let i=0;i<nodes.length;i++) nodes.push(...nodes[i].children);
  return nodes.map(node=>{
    if (['animate','animatetransform','animatemotion','set','script','style','svg'].includes(tag(node))) throw new Error('Animated, scripted, styled, or nested-viewport subtrees require a separate editing operation.');
    const style=styleOf(node);
    if(style.animationName!=='none' || style.transitionDuration.split(',').some(value=>parseFloat(value)!==0)) throw new Error('Animated styles cannot be safely reparented.');
    return {node, values:checked.map(k=>style.getPropertyValue(k)), matrix:node.getScreenCTM?.()};
  });
}
export function reparentSvgElement(root, element, target, before = null) {
  const reason=svgDropRejection(root,element,target,before);
  if(reason) throw new Error(reason);
  let parent=element.parentNode, next=element.nextSibling;
  const sourcePath=svgNodePath(root,element), parentPath=svgNodePath(root,parent), targetPath=svgNodePath(root,target);
  let nextPath=null;
  const beforePath=before ? svgNodePath(root,before) : null;
  if(parent===target && next===before) return null;
  let common=parent;
  while(common && !common.contains(target)) common=common.parentElement;
  if(branchEffects(parent,common) || branchEffects(target,common)) throw new Error('Group opacity, clipping, masks, filters, hiding, or blending prevent an appearance-preserving move.');
  // Structural selectors can restyle siblings or ancestors outside the moved subtree.
  for (const sheet of root.querySelectorAll('style')) {
    const rules = sheet.sheet?.cssRules;
    if (!rules || Array.from(rules).some(rule => !rule.selectorText || !rule.selectorText.split(',').every(selector => /^[\w.#*-]+$/.test(selector.trim())))) throw new Error('Structural or conditional SVG stylesheets require a separate editing operation.');
  }
  if (root.querySelector('animate, animateTransform, animateMotion, set, script')) throw new Error('Animated or scripted SVG documents cannot be safely reparented.');
  if (parent.baseURI !== target.baseURI) throw new Error('Moving across different XML reference bases is not supported.');
  const xmlValue = (node, name) => { for(let p=node;p;p=p.parentElement) if(p.hasAttributeNS('http://www.w3.org/XML/1998/namespace',name)) return p.getAttributeNS('http://www.w3.org/XML/1998/namespace',name); return null; };
  if (['space','lang'].some(name => xmlValue(parent,name) !== xmlValue(target,name))) throw new Error('Moving across different XML text inheritance is not supported.');
  const sourceMatrix=parent.getScreenCTM(), targetMatrix=target.getScreenCTM();
  if(!sourceMatrix || !targetMatrix || Math.abs(targetMatrix.a*targetMatrix.d-targetMatrix.b*targetMatrix.c)<1e-12) throw new Error('The destination transform is not invertible.');
  const delta=targetMatrix.inverse().multiply(sourceMatrix);
  if(!matrixValues(delta).every(Number.isFinite)) throw new Error('The destination transform is invalid.');
  const oldStyle=styleOf(parent), newStyle=styleOf(target);
  const differences=inherited.filter(k=>oldStyle.getPropertyValue(k)!==newStyle.getPropertyValue(k));
  const snapshots=capture(element);
  let carrier=element;
  if(!sameMatrix(sourceMatrix,targetMatrix) || differences.length) {
    carrier=root.ownerDocument.createElementNS(SVG,'g');
    if(!sameMatrix(sourceMatrix,targetMatrix)) carrier.setAttribute('transform',`matrix(${matrixValues(delta).join(' ')})`);
    differences.forEach(k=>carrier.style.setProperty(k,oldStyle.getPropertyValue(k)));
  }
  const wrapped=carrier!==element, carrierTemplate=wrapped ? carrier.cloneNode(false) : null;
  let movedPath=null;
  const restore=()=>{
    if (!root.contains(element) && movedPath) {
      element=svgNodeAtPath(root,movedPath); parent=svgNodeAtPath(root,parentPath);
      next=nextPath && svgNodeAtPath(root,nextPath); carrier=wrapped ? element?.parentNode : element;
    }
    if (!element || !parent) throw new Error('The moved object is no longer available for undo.');
    parent.insertBefore(element,next?.parentNode===parent ? next : null); if(wrapped) carrier.remove();
  };
  const apply=()=>{
    if (!root.contains(element)) {
      element=svgNodeAtPath(root,sourcePath); target=svgNodeAtPath(root,targetPath);
      parent=element?.parentNode; next=element?.nextSibling;
      before=beforePath && svgNodeAtPath(root,beforePath); carrier=wrapped ? carrierTemplate.cloneNode(false) : element;
    }
    if (!root.contains(target)) target=svgNodeAtPath(root,targetPath);
    if (before && !root.contains(before)) before=beforePath && svgNodeAtPath(root,beforePath);
    if (!element || !target) throw new Error('The moved object is no longer available for redo.');
    target.insertBefore(carrier,before?.parentNode===target ? before : null); if(wrapped) carrier.appendChild(element);
    movedPath=svgNodePath(root,element);
    nextPath=next?.nodeType===1 && root.contains(next) && !next.hasAttribute("data-nv-editor-ui") ? svgNodePath(root,next) : null;
  };
  try {
    apply();
    if (wrapped && branchEffects(carrier, target)) throw new Error("Stylesheet effects on the compensation group prevent a safe move.");
    for(const entry of snapshots) {
      const style=styleOf(entry.node);
      if(checked.some((key,i)=>style.getPropertyValue(key)!==entry.values[i]) || (entry.matrix && !sameMatrix(entry.matrix,entry.node.getScreenCTM()))) throw new Error('Reparenting changes stylesheet-dependent appearance or geometry; the move was cancelled.');
    }
  } catch(error) { restore(); throw error; }
  return { element, undo(){restore();return {element};}, redo(){apply();return {element};} };
}
