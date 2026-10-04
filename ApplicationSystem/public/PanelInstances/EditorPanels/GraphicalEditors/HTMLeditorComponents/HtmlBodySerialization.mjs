// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlBodySerialization.mjs
// This module serializes a detached HTML body projection, preserving authored marker collisions and restoring explicitly tracked resources while removing proven editor presentation.
import { serializeInlineEquationsForSave } from "/Equation/HtmlInlineEquation.mjs";
import { syncImageTextPresentation } from "./HtmlImageText.mjs";

// Source provenance, rather than a class name alone, decides what belongs to the editor.
export function cloneHtmlBodyForSave(wysiwyg) {
  const clone = wysiwyg.cloneNode(true);
  const provenance = wysiwyg.__nvSourceProvenance;
  if (!provenance) throw new Error('HTML source provenance is unavailable.');
  syncImageTextPresentation(clone);
  serializeInlineEquationsForSave(clone, { preservePresentation: true });
  return provenance.clean(clone);
}
