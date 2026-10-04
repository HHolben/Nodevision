// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs
// This module records explicit HTML presentation writes at their owning editor so serialization can reverse runtime changes without guessing from class names or attribute spellings.

export function htmlSourceProvenanceFor(element) {
  for (let parent = element; parent; parent = parent.parentElement) {
    if (parent.__nvSourceProvenance) return parent.__nvSourceProvenance;
  }
  return null;
}
export function presentHtmlClass(element, name, enabled) {
  if (!element) return;
  const owner = htmlSourceProvenanceFor(element);
  if (owner) owner.presentClass(element, name, enabled);
  else element.classList.toggle(name, enabled);
}
export function presentHtmlAttribute(element, name, value) {
  if (!element) return;
  const owner = htmlSourceProvenanceFor(element);
  if (owner) owner.resolveAttribute(element, name, value === null ? null : String(value));
  else if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}
