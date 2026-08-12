// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/XML/XmlStructureView.mjs
// This file renders a readable tree representation of parsed XML documents. It uses DOM construction and textContent only, preserving a safe generic fallback for any XML vocabulary the semantic registry does not recognize.

export function createXmlStructureView(xmlDocument) {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "padding:1rem;font:13px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;overflow:auto;";
  if (!xmlDocument?.documentElement) {
    wrapper.appendChild(message("No parsed XML structure is available."));
    return wrapper;
  }
  wrapper.appendChild(renderElement(xmlDocument.documentElement, 0));
  return wrapper;
}

function renderElement(element, depth) {
  const details = document.createElement("details");
  details.open = depth < 2;
  details.style.marginLeft = depth ? "1rem" : "0";
  const summary = document.createElement("summary");
  summary.textContent = describeElement(element);
  summary.style.cssText = "cursor:pointer;color:#1f2937;";
  details.appendChild(summary);

  for (const child of Array.from(element.childNodes || [])) {
    if (child.nodeType === 1) details.appendChild(renderElement(child, depth + 1));
    else if (child.nodeType === 3 && child.textContent.trim()) details.appendChild(renderTextNode(child.textContent));
    else if (child.nodeType === 8) details.appendChild(renderCommentNode(child.textContent));
  }
  return details;
}

function describeElement(element) {
  const attrs = Array.from(element.attributes || []).map((attr) => `${attr.name}="${attr.value}"`).join(" ");
  const name = element.tagName || element.nodeName || "element";
  return attrs ? `<${name} ${attrs}>` : `<${name}>`;
}

function renderTextNode(text) {
  const div = document.createElement("div");
  div.style.cssText = "margin-left:1.4rem;color:#374151;white-space:pre-wrap;";
  div.textContent = text.replace(/\s+/g, " ").trim();
  return div;
}

function renderCommentNode(text) {
  const div = document.createElement("div");
  div.style.cssText = "margin-left:1.4rem;color:#6b7280;font-style:italic;white-space:pre-wrap;";
  div.textContent = `<!-- ${String(text || "").trim()} -->`;
  return div;
}

function message(text) {
  const div = document.createElement("div");
  div.style.cssText = "color:#6b7280;";
  div.textContent = text;
  return div;
}
