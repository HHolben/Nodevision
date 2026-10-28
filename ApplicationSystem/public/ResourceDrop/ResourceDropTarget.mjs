// One drag lifecycle for all editors. Adapters capture coordinates and own the actual document transaction.
import { isResourceTransfer, resourceFromTransfer, readResourcePayload, clearResourceDrag } from './ResourceTransfer.mjs';
const targets = new Map();
let marker, caret;
function show(point, message, accepted) {
  marker ||= Object.assign(document.createElement('div'), { className: 'nv-resource-drop-indicator' });
  marker.setAttribute('role','status'); marker.style.cssText = `position:fixed;pointer-events:none;z-index:30000;padding:5px;border:2px solid ${accepted?'#16834a':'#b3261e'};background:white;color:#222;font:12px sans-serif;left:${point.clientX+8}px;top:${point.clientY+8}px`;
  marker.textContent = message; if (!marker.isConnected) document.body.append(marker);
}
export function clearResourcePreview() { marker?.remove(); caret?.remove(); for (const target of targets.values()) target.clearPreview?.(); }
export function registerResourceDropTarget(root, adapter) {
  targets.get(root)?.dispose();
  let busy = false, disposed = false;
  function capture(resource, point) {
    if (!root.isConnected || root.closest('[hidden],[aria-hidden="true"]')) throw Error('The destination editor is unavailable.');
    return adapter.capture(resource, point);
  }
  function preview(resource, point) {
    caret?.remove();
    try { const operation = capture(resource, point); adapter.preview?.(operation, point);
      caret?.remove();
      if (operation.rect?.height) { caret ||= document.createElement('div'); caret.style.cssText = `position:fixed;pointer-events:none;z-index:30000;border-left:2px solid #16834a;left:${operation.rect.left}px;top:${operation.rect.top}px;height:${operation.rect.height}px`;document.body.append(caret); }
      show(point, operation.label || 'Link resource here', true); return true; }
    catch (error) { adapter.clearPreview?.(); show(point,error.message,false); return false; }
  }
  async function commit(resource, point) {
    clearResourcePreview(); if (busy || disposed) return false; busy = true;
    try {
      const operation = capture(resource, point); operation.validate?.();
      const response = await fetch(resource.url, { method:'HEAD', cache:'no-store' });
      if (!response.ok) throw Error('The resource is missing or inaccessible.');
      if (disposed || !root.isConnected) throw Error('The destination editor was closed.');
      operation.validate?.();
      const result = await operation.insert(); if (result === false || result === null) throw Error('The editor rejected this resource.');
      root.dispatchEvent(new CustomEvent('nodevision-resource-inserted',{bubbles:true,detail:{resource, result}}));
      return true;
    } catch(error) { show(point,error.message,false); root.dispatchEvent(new CustomEvent('nodevision-resource-drop-error',{bubbles:true,detail:{message:error.message}})); return false; }
    finally { busy = false; }
  }
  function dragover(event) {
    if (!isResourceTransfer(event.dataTransfer)) return;
    event.preventDefault(); event.stopPropagation();
    try { event.dataTransfer.dropEffect = preview(resourceFromTransfer(event.dataTransfer,{hover:true}),event) ? 'link' : 'none'; }
    catch(error) { event.dataTransfer.dropEffect='none';show(event,error.message,false); }
  }
  function drop(event) {
    if (!isResourceTransfer(event.dataTransfer)) return;
    event.preventDefault(); event.stopPropagation();
    try { void commit(resourceFromTransfer(event.dataTransfer),{clientX:event.clientX,clientY:event.clientY,target:event.target}); }
    catch(error) { show(event,error.message,false); }
    clearResourceDrag();
  }
  const leave = event => { if (!root.contains(event.relatedTarget)) clearResourcePreview(); };
  const end = () => { clearResourcePreview(); clearResourceDrag(); };
  root.addEventListener('dragover',dragover);root.addEventListener('drop',drop);root.addEventListener('dragleave',leave);window.addEventListener('dragend',end);
  const api = { preview, commit, clearPreview:adapter.clearPreview, dispose() { disposed=true;root.removeEventListener('dragover',dragover);root.removeEventListener('drop',drop);root.removeEventListener('dragleave',leave);window.removeEventListener('dragend',end);adapter.clearPreview?.();targets.delete(root); } };
  targets.set(root,api);return api.dispose;
}
export function resourceTargetAt(point) {
  const element = document.elementFromPoint(point.clientX, point.clientY);
  const entries = [...targets].filter(([root]) => { if (!root.isConnected) { targets.get(root)?.dispose();return false; } return root === element || root.contains(element); });
  return entries.find(([root]) => !entries.some(([other])=>other!==root&&root.contains(other)))?.[1] || null;
}
export function previewResourceAtPoint(payload, point) { const target=resourceTargetAt(point);clearResourcePreview();return target?.preview(readResourcePayload(payload),point) || false; }
export function dropResourceAtPoint(payload, point) { const target=resourceTargetAt(point);clearResourcePreview();return target?.commit(readResourcePayload(payload),point) || Promise.resolve(false); }
