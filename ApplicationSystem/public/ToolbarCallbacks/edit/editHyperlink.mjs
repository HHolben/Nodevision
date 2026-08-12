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

function storedHyperlinkContext() {
  const context = window.NodevisionState?.activeHtmlHyperlinkContext;
  if (context?.element instanceof HTMLAnchorElement && context.element.isConnected) return context;
  if (context?.range && context.kind) return context;
  return null;
}

function selectedHyperlinkContext() {
  const live = findHyperlinkFromSelection();
  if (live instanceof HTMLAnchorElement) {
    return {
      kind: "dom",
      element: live,
      href: live.getAttribute("href") || "",
      text: live.textContent || "",
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

  const nextHref = prompt("Hyperlink URL:", context.href || "");
  if (nextHref === null) return;

  const href = nextHref.trim();
  if (!href) {
    alert("Hyperlink URL cannot be empty.");
    return;
  }

  const nextText = prompt("Hyperlink text:", context.text || context.href || "");
  if (context.kind !== "dom") {
    if (!applySourceHyperlinkEdit(context, { href, text: nextText })) {
      alert("Nodevision could not update the selected hyperlink source.");
    }
    refreshHyperlinkSelectionState({ force: true });
    return;
  }

  const link = context.element;
  link.setAttribute("href", href);
  updateExternalLinkAttributes(link, href);
  if (nextText !== null) link.textContent = nextText;

  selectEditedLink(link);
  notifyHtmlChanged();
  refreshHyperlinkSelectionState({ force: true });
}
