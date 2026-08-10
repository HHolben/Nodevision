// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/MarkdownRenderedEditorSerialization.mjs
// This module serializes the rendered Markdown graphical editor DOM back into readable Markdown source for saving.

function cleanText(value = "") {
  return String(value || "").replace(/\u00a0/g, " ");
}

function escapeMarkdownText(value = "") {
  return cleanText(value).replace(/([\\`*_{}\[\]()#+\-.!>~|])/g, "\\$1");
}

function trimBlock(value = "") {
  return String(value || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function textFromChildren(node, inlineSerializer = inlineMarkdown) {
  return Array.from(node?.childNodes || []).map((child) => inlineSerializer(child)).join("");
}

function inlineCode(text = "") {
  const value = cleanText(text);
  const ticks = value.includes("`") ? "``" : "`";
  const padding = ticks === "``" ? " " : "";
  return `${ticks}${padding}${value}${padding}${ticks}`;
}

export function inlineMarkdown(node) {
  if (!node) return "";
  if (node.nodeType === Node.TEXT_NODE) return escapeMarkdownText(node.nodeValue || "");
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const tag = node.tagName.toLowerCase();
  if (tag === "br") return "  \n";
  if (tag === "img") {
    const alt = escapeMarkdownText(node.getAttribute("alt") || "");
    const src = node.getAttribute("src") || "";
    return src ? `![${alt}](${src})` : "";
  }

  const body = textFromChildren(node);
  if (!body.trim()) return "";
  if (tag === "strong" || tag === "b") return `**${body}**`;
  if (tag === "em" || tag === "i") return `*${body}*`;
  if (tag === "del" || tag === "s" || tag === "strike") return `~~${body}~~`;
  if (tag === "code" && node.closest?.("pre")) return cleanText(node.textContent || "");
  if (tag === "code") return inlineCode(node.textContent || "");
  if (tag === "a") {
    const href = node.getAttribute("href") || "";
    return href ? `[${body}](${href})` : body;
  }
  if (tag === "u") return `<u>${body}</u>`;
  return body;
}

function listItemMarkdown(item, marker) {
  const body = trimBlock(textFromChildren(item));
  const lines = body ? body.split("\n") : [""];
  return lines.map((line, index) => index === 0 ? `${marker} ${line}` : `  ${line}`).join("\n");
}

function listMarkdown(list) {
  const ordered = list.tagName.toLowerCase() === "ol";
  return Array.from(list.children || [])
    .filter((child) => child.tagName?.toLowerCase() === "li")
    .map((item, index) => listItemMarkdown(item, ordered ? `${index + 1}.` : "-"))
    .join("\n");
}

function blockquoteMarkdown(node) {
  const body = serializeMarkdownFromRenderedElement(node).trim();
  return body.split("\n").map((line) => line ? `> ${line}` : ">").join("\n");
}

function blockMarkdown(node) {
  if (!node) return "";
  if (node.nodeType === Node.TEXT_NODE) return trimBlock(escapeMarkdownText(node.nodeValue || ""));
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const tag = node.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) return `${"#".repeat(Number(tag.slice(1)))} ${trimBlock(textFromChildren(node))}`;
  if (tag === "p" || tag === "div") return trimBlock(textFromChildren(node));
  if (tag === "pre") return "```\n" + cleanText(node.textContent || "").replace(/\n+$/, "") + "\n```";
  if (tag === "blockquote") return blockquoteMarkdown(node);
  if (tag === "ul" || tag === "ol") return listMarkdown(node);
  if (tag === "hr") return "---";
  if (tag === "br") return "";
  return trimBlock(textFromChildren(node));
}

export function serializeMarkdownFromRenderedElement(root) {
  return Array.from(root?.childNodes || [])
    .map((child) => blockMarkdown(child))
    .map(trimBlock)
    .filter(Boolean)
    .join("\n\n");
}
