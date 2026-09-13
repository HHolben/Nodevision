// Nodevision/ApplicationSystem/tests/htmlDomBloat/rendererSelectionTyping.cjs
// This module exports renderer-side selection, typing, and deletion helpers for deterministic DOM bloat benchmark passes.

const rendererSelectionTyping = String.raw`
(() => {
  window.__nvDomBloatSelectPosition = (position = "end") => {
    const wysiwyg = document.getElementById("wysiwyg");
    const targets = Array.from(wysiwyg?.querySelectorAll?.("p,div,li,blockquote,h1,h2,h3") || [])
      .filter((el) => (el.textContent || "").trim().length > 20);
    const target = targets.length
      ? targets[position === "beginning" ? 0 : position === "middle" ? Math.floor(targets.length / 2) : targets.length - 1]
      : wysiwyg;
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    wysiwyg.focus();
    window.__nvDomBloatTypingTarget = target;
    window.__nvDomBloatExpectedText = "";
    return { tagName: target?.tagName || "", textLength: Number(target?.textContent?.length || 0), index: targets.indexOf(target), count: targets.length };
  };

  window.__nvDomBloatTypeChars = async (chars, options = {}) => {
    const target = window.__nvDomBloatTypingTarget || document.querySelector("#wysiwyg p") || document.getElementById("wysiwyg");
    if (!target) throw new Error("No typing target");
    let textNode = target.lastChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) textNode = target.appendChild(document.createTextNode(""));
    const delayMs = Number(options.delayMs ?? 16);
    for (const ch of String(chars || "")) {
      const started = performance.now();
      target.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: ch }));
      textNode.nodeValue = String(textNode.nodeValue || "") + ch;
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: ch }));
      const elapsed = Math.round((performance.now() - started) * 10) / 10;
      const metrics = window.__nvDomBloatMetricPatch.metrics;
      metrics.inputDispatchCount += 1;
      metrics.inputDispatchTotalMs = Math.round((metrics.inputDispatchTotalMs + elapsed) * 10) / 10;
      metrics.inputDispatchMaxMs = Math.max(metrics.inputDispatchMaxMs, elapsed);
      window.__nvDomBloatExpectedText += ch;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
    return true;
  };

  window.__nvDomBloatBackspace = async (count = 20) => {
    const target = window.__nvDomBloatTypingTarget || document.querySelector("#wysiwyg p") || document.getElementById("wysiwyg");
    const textNode = target?.lastChild?.nodeType === Node.TEXT_NODE ? target.lastChild : null;
    for (let i = 0; i < count; i += 1) {
      target.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "deleteContentBackward" }));
      if (textNode) textNode.nodeValue = String(textNode.nodeValue || "").slice(0, -1);
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
      await new Promise((resolve) => setTimeout(resolve, 18));
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
  };

  window.__nvDomBloatTextNodes = () => {
    const wysiwyg = document.getElementById("wysiwyg");
    const nodes = [];
    if (!wysiwyg) return nodes;
    const walker = document.createTreeWalker(wysiwyg, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || parent.closest?.("script,style,[contenteditable=\"false\"]")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  };

  window.__nvDomBloatSelectTextNodeRange = (nodeIndex = 0, startOffset = 0, length = 24) => {
    const nodes = window.__nvDomBloatTextNodes();
    if (!nodes.length) return false;
    const node = nodes[Math.abs(Number(nodeIndex) || 0) % nodes.length];
    const textLength = String(node.nodeValue || "").length;
    const start = Math.max(0, Math.min(Math.max(0, textLength - 1), Number(startOffset) || 0));
    const end = Math.max(start, Math.min(textLength, start + Math.max(1, Number(length) || 1)));
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.getElementById("wysiwyg")?.focus?.();
    window.__nvDomBloatTypingTarget = node.parentElement || document.getElementById("wysiwyg");
    return { nodeIndex: nodes.indexOf(node), start, end, text: String(node.nodeValue || "").slice(start, end) };
  };

  window.__nvDomBloatSelectDeterministicRange = (iteration = 0, length = 24) => {
    const nodes = window.__nvDomBloatTextNodes();
    if (!nodes.length) return false;
    const nodeIndex = (Number(iteration) * 17 + 5) % nodes.length;
    const node = nodes[nodeIndex];
    const maxStart = Math.max(0, String(node.nodeValue || "").length - Math.max(1, Number(length) || 1));
    const start = maxStart ? ((Number(iteration) * 31 + 7) % maxStart) : 0;
    return window.__nvDomBloatSelectTextNodeRange(nodeIndex, start, length);
  };

  window.__nvDomBloatDispatchInput = (inputType = "format") => {
    document.getElementById("wysiwyg")?.dispatchEvent?.(new InputEvent("input", { bubbles: true, inputType }));
  };
})();
`;

module.exports = { rendererSelectionTyping };
