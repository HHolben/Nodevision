// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/directoryContents/DirectoryContentsSnippet.mjs
// This module builds self-contained directory contents snippets for HTML and PHP Notebook documents.

const ORDERED_STYLES = new Set(["decimal", "lower-alpha", "upper-alpha", "lower-roman", "upper-roman"]);
const UNORDERED_STYLES = new Set(["disc", "circle", "square", "none"]);
const TABLE_STYLES = new Set(["plain", "bordered", "compact"]);

export function normalizeNotebookPath(value = "") {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "")
    .replace(/^Notebook\//i, "");
}

export function dirname(notebookPath = "") {
  const clean = normalizeNotebookPath(notebookPath);
  const idx = clean.lastIndexOf("/");
  return idx >= 0 ? clean.slice(0, idx) : "";
}

function cleanEntryName(entry = {}) {
  return String(entry.name || entry.filename || entry.path || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop() || "";
}

function isDirectoryEntry(entry = {}) {
  return Boolean(entry.isDirectory || entry.fileType === "directory" || entry.type === "directory");
}

function encodePathSegment(segment = "") {
  return String(segment).split("/").map(encodeURIComponent).join("/");
}

function scriptJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function escapeAttribute(value = "") {
  return String(value).replace(/[&"]/g, (ch) => ({
    "&": "&amp;",
    "\"": "&quot;",
  }[ch]));
}

function normalizedListStyle(layout, style) {
  if (layout === "ordered") return ORDERED_STYLES.has(style) ? style : "decimal";
  if (layout === "unordered") return UNORDERED_STYLES.has(style) ? style : "disc";
  return "";
}

function normalizedTableStyle(style) {
  return TABLE_STYLES.has(style) ? style : "plain";
}

function makeSnippetId() {
  return `nv-directory-contents-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildDirectoryEntries(entries = []) {
  return entries
    .map((entry) => {
      const name = cleanEntryName(entry);
      if (!name || name.startsWith(".")) return null;
      const isDirectory = isDirectoryEntry(entry);
      return {
        name,
        isDirectory,
        href: encodePathSegment(name) + (isDirectory ? "/" : ""),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });
}

export function buildDirectoryContentsSnippet(options = {}) {
  const layout = options.layout === "table" || options.layout === "ordered" ? options.layout : "unordered";
  const snippetOptions = {
    layout,
    listStyle: normalizedListStyle(layout, options.listStyle),
    tableStyle: normalizedTableStyle(options.tableStyle),
    hyperlinks: Boolean(options.hyperlinks),
  };
  const mountId = makeSnippetId();
  const entries = buildDirectoryEntries(options.entries || []);
  const directoryPath = normalizeNotebookPath(options.directoryPath || "");
  const dataJson = scriptJson(entries);
  const optionsJson = scriptJson(snippetOptions);

  return [
    `<div id="${mountId}" class="nv-directory-contents" data-nv-directory-path="${escapeAttribute(directoryPath)}"></div>`,
    "<script>",
    "(() => {",
    `  const mount = document.getElementById(${JSON.stringify(mountId)});`,
    "  if (!mount) return;",
    `  const entries = ${dataJson};`,
    `  const options = ${optionsJson};`,
    "  const labelFor = (entry) => entry.name + (entry.isDirectory ? '/' : '');",
    "  const addContent = (node, entry) => {",
    "    if (!options.hyperlinks) { node.textContent = labelFor(entry); return; }",
    "    const link = document.createElement('a');",
    "    link.href = entry.href;",
    "    link.textContent = labelFor(entry);",
    "    node.appendChild(link);",
    "  };",
    "  const styleCells = (cells) => cells.forEach((cell) => {",
    "    cell.style.padding = options.tableStyle === 'compact' ? '2px 6px' : '4px 8px';",
    "    if (options.tableStyle === 'bordered') cell.style.border = '1px solid currentColor';",
    "  });",
    "  mount.replaceChildren();",
    "  if (options.layout === 'table') {",
    "    const table = document.createElement('table');",
    "    table.className = 'nv-directory-contents-table';",
    "    if (options.tableStyle !== 'plain') table.style.borderCollapse = 'collapse';",
    "    const body = document.createElement('tbody');",
    "    entries.forEach((entry) => {",
    "      const row = document.createElement('tr');",
    "      const nameCell = document.createElement('td');",
    "      const typeCell = document.createElement('td');",
    "      addContent(nameCell, entry);",
    "      typeCell.textContent = entry.isDirectory ? 'Directory' : 'File';",
    "      styleCells([nameCell, typeCell]);",
    "      row.append(nameCell, typeCell);",
    "      body.appendChild(row);",
    "    });",
    "    table.appendChild(body);",
    "    mount.appendChild(table);",
    "    return;",
    "  }",
    "  const list = document.createElement(options.layout === 'ordered' ? 'ol' : 'ul');",
    "  if (options.listStyle) list.style.listStyleType = options.listStyle;",
    "  entries.forEach((entry) => {",
    "    const item = document.createElement('li');",
    "    addContent(item, entry);",
    "    list.appendChild(item);",
    "  });",
    "  mount.appendChild(list);",
    "})();",
    "</script>"
  ].join("\n");
}
