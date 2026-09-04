// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/editHyperlink.mjs
// This callback edits the currently selected HTML hyperlink in place through the existing editor state and dirty-marking hooks.

import {
  findHyperlinkFromSelection,
  refreshHyperlinkSelectionState,
} from "./hyperlinkSelection.mjs";
import {
  applySourceHyperlinkEdit,
  findSourceHyperlinkContext,
} from "./sourceHyperlinkTools.mjs";
import { normalizeNotebookFilePath } from "../../utils/notebookPath.mjs";
import {
  applyFallbackReferencesToElement,
  normalizeFallbackReferencesForSource,
  normalizeReferenceForSource,
  readFallbackReferencesFromElement
} from "../../utils/referenceFallbacks.mjs";
import { showReferenceDetailsDialog } from "../../ToolbarJSONfiles/referenceDetailsDialog.mjs";

function storedHyperlinkContext() {
  const context = window.NodevisionState?.activeHtmlHyperlinkContext;
  if (context?.element instanceof HTMLAnchorElement && context.element.isConnected) return context;
  if (context?.range && context.kind) return context;
  return null;
}

function currentEditorSourcePath(context = {}) {
  const candidates = [
    context.filePath,
    window.NodevisionState?.activeEditorFilePath,
    window.__nvWysiwygActivePath,
    window.__nvHtmlEditorActivePath,
    window.__nvCodeEditorActivePath,
    window.currentActiveFilePath,
    window.selectedFilePath,
    window.NodevisionState?.selectedFile,
  ];
  for (const value of candidates) {
    const normalized = normalizeNotebookFilePath(value || "");
    if (normalized) return normalized;
  }
  return "";
}

function selectedHyperlinkContext() {
  const live = findHyperlinkFromSelection();
  if (live instanceof HTMLAnchorElement) {
    return {
      kind: "dom",
      element: live,
      href: live.getAttribute("href") || "",
      text: live.textContent || "",
      fallbacks: readFallbackReferencesFromElement(live),
    };
  }
  return findSourceHyperlinkContext() || storedHyperlinkContext();
}

function updateExternalLinkAttributes(link, href) {
  const external = /^https?:\/\//i.test(href);
  link.dataset.nvLinkType = external ? "external" : "notebook";
  if (external) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return;
  }
  link.removeAttribute("target");
  link.removeAttribute("rel");
}

function selectEditedLink(link) {
  const selection = window.getSelection?.();
  if (!selection || !link?.isConnected) return;
  const range = document.createRange();
  range.selectNodeContents(link);
  selection.removeAllRanges();
  selection.addRange(range);
}

function notifyHtmlChanged() {
  const editor = window.HTMLWysiwygTools?.getEditorElement?.();
  window.HTMLWysiwygTools?.markDirty?.();
  editor?.dispatchEvent?.(new Event("input", { bubbles: true }));
}

export default async function editHyperlink() {
  const context = selectedHyperlinkContext();
  if (!context) {
    alert("Place the caret inside a hyperlink or select a hyperlink first.");
    refreshHyperlinkSelectionState({ force: true });
    return;
  }

  const details = await showReferenceDetailsDialog({
    title: "Edit Link",
    primaryLabel: "Destination",
    primaryValue: context.href || "",
    textLabel: "Link text",
    textValue: context.text || context.href || "",
    requireText: false,
    fallbacks: context.fallbacks || []
  });
  if (!details) return;

  const sourcePath = currentEditorSourcePath(context);
  const href = normalizeReferenceForSource(details.primary, { sourcePath });
  if (!href) {
    alert("Hyperlink destination cannot be empty or unsafe.");
    return;
  }
  const fallbacks = normalizeFallbackReferencesForSource(details.fallbacks, {
    sourcePath,
    primary: href
  });
  const nextText = details.text;

  if (context.kind !== "dom") {
    if (!applySourceHyperlinkEdit(context, { href, text: nextText, fallbacks })) {
      alert("Nodevision could not update the selected hyperlink source.");
    }
    refreshHyperlinkSelectionState({ force: true });
    return;
  }

  const link = context.element;
  link.setAttribute("href", href);
  updateExternalLinkAttributes(link, href);
  applyFallbackReferencesToElement(link, fallbacks, { primary: href });
  if (nextText !== null) link.textContent = nextText;

  selectEditedLink(link);
  notifyHtmlChanged();
  refreshHyperlinkSelectionState({ force: true });
}
