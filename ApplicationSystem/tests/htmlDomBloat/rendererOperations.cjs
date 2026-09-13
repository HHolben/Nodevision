// Nodevision/ApplicationSystem/tests/htmlDomBloat/rendererOperations.cjs
// This module exports renderer-side editing operation batches for the DOM bloat benchmark so repeated formatting scenarios stay separate from setup code.

const rendererOperations = String.raw`
(() => {
  window.__nvDomBloatApplyOperation = async (operation, iteration = 0) => {
    const wysiwyg = document.getElementById("wysiwyg");
    if (!wysiwyg) throw new Error("No WYSIWYG mounted");
    const op = String(operation || "");
    const selected = window.__nvDomBloatSelectDeterministicRange(iteration, op.includes("link") ? 18 : 26);
    if (!selected) return false;
    const before = wysiwyg.innerHTML;
    try {
      if (op === "plain-type") {
        document.execCommand("insertText", false, "xy");
      } else if (op === "enter-delete") {
        document.execCommand("insertParagraph");
        document.execCommand("delete");
      } else if (op === "bold-toggle") {
        document.execCommand("bold");
        document.execCommand("bold");
      } else if (op === "bold-apply") {
        document.execCommand("bold");
      } else if (op === "italic-toggle") {
        document.execCommand("italic");
        document.execCommand("italic");
      } else if (op === "italic-apply") {
        document.execCommand("italic");
      } else if (op === "nodevision-style-toggle") {
        window.HTMLWysiwygTools?.applyTextStylesToSelection?.({ color: iteration % 2 ? "rgb(80, 40, 120)" : "rgb(20, 80, 120)" });
        window.HTMLWysiwygTools?.removeTextStylesFromSelection?.();
      } else if (op === "nodevision-style-apply") {
        window.HTMLWysiwygTools?.applyTextStylesToSelection?.({ color: iteration % 2 ? "rgb(80, 40, 120)" : "rgb(20, 80, 120)" });
      } else if (op === "nodevision-font-toggle") {
        window.HTMLWysiwygTools?.applyFontFamilyToSelection?.(iteration % 2 ? "Georgia" : "Arial", "serif");
        window.HTMLWysiwygTools?.removeFontFamilyFromSelection?.();
      } else if (op === "nodevision-font-apply") {
        window.HTMLWysiwygTools?.applyFontFamilyToSelection?.(iteration % 2 ? "Georgia" : "Arial", "serif");
      } else if (op === "link-toggle") {
        document.execCommand("createLink", false, "https://example.com/synthetic-" + iteration);
        document.execCommand("unlink");
      } else if (op === "link-apply") {
        document.execCommand("createLink", false, "https://example.com/synthetic-" + iteration);
      } else if (op === "paste-plain") {
        document.execCommand("insertText", false, " pasted plain text ");
      } else if (op === "copy-paste-html") {
        const text = window.getSelection()?.toString?.() || "copied text";
        document.execCommand("insertHTML", false, "<span>" + text.replace(/[&<>]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch])) + "</span>");
      } else if (op === "undo-redo") {
        document.execCommand("insertText", false, "u");
        document.execCommand("undo");
        document.execCommand("redo");
      } else if (op === "selection-only") {
      } else {
        throw new Error("Unknown operation " + op);
      }
    } catch (err) {
      console.warn("DOM bloat operation failed", op, err);
    }
    if (wysiwyg.innerHTML !== before || op === "selection-only") window.__nvDomBloatDispatchInput("formatSetBlockTextDirection");
    await new Promise((resolve) => setTimeout(resolve, 18));
    return true;
  };

  window.__nvDomBloatRunOperationBatch = async ({ operation = "plain-type", iterations = 20, start = 0 } = {}) => {
    for (let i = 0; i < Number(iterations || 0); i += 1) {
      await window.__nvDomBloatApplyOperation(operation, Number(start || 0) + i);
    }
    await new Promise((resolve) => setTimeout(resolve, 160));
    return document.getElementById("wysiwyg")?.innerHTML || "";
  };
})();
`;

module.exports = { rendererOperations };
