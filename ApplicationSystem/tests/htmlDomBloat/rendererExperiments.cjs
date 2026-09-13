// Nodevision/ApplicationSystem/tests/htmlDomBloat/rendererExperiments.cjs
// This module exports renderer-side enter, delete, and paste experiments for checking HTML editor blank-block stability in the DOM bloat benchmark.

const rendererExperiments = String.raw`
(() => {
  window.__nvDomBloatEnterExperiment = async (count = 1, typeAfter = "") => {
    window.__nvDomBloatSelectPosition("beginning");
    const wysiwyg = document.getElementById("wysiwyg");
    for (let i = 0; i < count; i += 1) {
      wysiwyg.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }));
      document.execCommand("insertParagraph");
      wysiwyg.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertParagraph" }));
      await new Promise((resolve) => setTimeout(resolve, 45));
    }
    if (typeAfter) {
      document.execCommand("insertText", false, typeAfter);
      wysiwyg.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: typeAfter }));
    }
    await new Promise((resolve) => setTimeout(resolve, 160));
    return wysiwyg.innerHTML;
  };

  window.__nvDomBloatDeleteExperiment = async (mode = "backspace") => {
    const wysiwyg = document.getElementById("wysiwyg");
    window.__nvDomBloatSelectPosition("beginning");
    for (let i = 0; i < 4; i += 1) {
      document.execCommand("insertParagraph");
      wysiwyg.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertParagraph" }));
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    for (let i = 0; i < 4; i += 1) {
      document.execCommand(mode === "delete" ? "forwardDelete" : "delete");
      wysiwyg.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: mode === "delete" ? "deleteContentForward" : "deleteContentBackward" }));
    }
    await new Promise((resolve) => setTimeout(resolve, 160));
    return wysiwyg.innerHTML;
  };

  window.__nvDomBloatPasteExperiment = async (plainText) => {
    window.__nvDomBloatSelectPosition("beginning");
    const wysiwyg = document.getElementById("wysiwyg");
    const escaped = String(plainText || "").split(/\n{2,}/).map((paragraph) =>
      "<p>" + paragraph.split(/\n/).map((line) => line.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]))).join("<br>") + "</p>"
    ).join("");
    document.execCommand("insertHTML", false, escaped);
    wysiwyg.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste", data: plainText }));
    await new Promise((resolve) => setTimeout(resolve, 160));
    return wysiwyg.innerHTML;
  };
})();
`;

module.exports = { rendererExperiments };
