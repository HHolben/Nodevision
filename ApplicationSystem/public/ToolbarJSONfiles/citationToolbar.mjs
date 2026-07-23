import { escapeHtml, insertHtmlAtCaret } from "./insertMediaCommon.mjs";

const FORMAT_OPTIONS = [
  ["mla", "MLA 9"],
  ["chicago-notes", "Chicago Notes"],
  ["chicago-author-date", "Chicago Author-Date"],
  ["apa", "APA 7"],
  ["ieee", "IEEE"],
];

function ensureCitationStyles() {
  if (document.getElementById("nv-citation-toolbar-styles")) return;
  const style = document.createElement("style");
  style.id = "nv-citation-toolbar-styles";
  style.textContent = `
    #sub-toolbar .nv-subtoolbar-widget.nv-citation-toolbar-host {
      height: auto;
      min-height: 30px;
      align-items: center;
      padding: 4px 6px;
    }
    #sub-toolbar .nv-citation-toolbar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
    }
    #sub-toolbar .nv-citation-toolbar label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      font-weight: 600;
    }
    #sub-toolbar .nv-citation-toolbar input,
    #sub-toolbar .nv-citation-toolbar select {
      height: 24px;
      box-sizing: border-box;
      border: 1px solid #888;
      border-radius: 4px;
      padding: 2px 6px;
      background: #fff;
      color: #111827;
      font: inherit;
      font-size: 12px;
    }
    #sub-toolbar .nv-citation-toolbar select {
      max-width: 150px;
    }
    #sub-toolbar .nv-citation-toolbar input[type="text"] {
      width: 150px;
    }
    #sub-toolbar .nv-citation-toolbar .nv-citation-url input {
      width: min(280px, 30vw);
      min-width: 170px;
    }
    #sub-toolbar .nv-citation-toolbar input[type="date"] {
      width: 132px;
    }
    #sub-toolbar .nv-citation-status {
      min-width: 130px;
      color: #4b5563;
      font-weight: 500;
    }
    html[data-nv-theme="dark"] #sub-toolbar .nv-citation-toolbar input,
    html[data-nv-theme="dark"] #sub-toolbar .nv-citation-toolbar select {
      background: #111827;
      color: #e5e7eb;
      border-color: #475569;
    }
    html[data-nv-theme="dark"] #sub-toolbar .nv-citation-status {
      color: #cbd5e1;
    }
  `;
  document.head.appendChild(style);
}

function localDateInputValue(date = new Date()) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 10);
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeUrl(value) {
  const raw = normalizeText(value);
  if (!raw) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function formatDate(value) {
  const raw = normalizeText(value);
  if (!raw) return "";
  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function formatYear(value) {
  const raw = normalizeText(value);
  if (!raw) return "n.d.";
  const match = raw.match(/\b(\d{4})\b/);
  return match ? match[1] : "n.d.";
}

function cleanParts(parts) {
  return parts.map(normalizeText).filter(Boolean);
}

function joinSentence(parts) {
  return cleanParts(parts).join(" ").replace(/\s+([,.;:])/g, "$1");
}

function linkHtml(label, href) {
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function quotedLinkedTitle(title, href) {
  const label = title || href;
  return `"${linkHtml(label, href)}"`;
}

function plainLinkedTitle(title, href) {
  return linkHtml(title || href, href);
}

function urlLink(href) {
  return linkHtml(href, href);
}

function asPeriod(value) {
  const text = normalizeText(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function asComma(value) {
  const text = normalizeText(value);
  if (!text) return "";
  return /[,]$/.test(text) ? text : `${text},`;
}

function collectFields(form) {
  const data = new FormData(form);
  const href = normalizeUrl(data.get("url"));
  return {
    format: normalizeText(data.get("format")) || "mla",
    href,
    urlInput: normalizeText(data.get("url")),
    title: normalizeText(data.get("title")),
    author: normalizeText(data.get("author")),
    site: normalizeText(data.get("site")),
    publisher: normalizeText(data.get("publisher")),
    published: normalizeText(data.get("published")),
    accessed: normalizeText(data.get("accessed")),
  };
}

function formatCitation(fields) {
  const publishedDate = formatDate(fields.published);
  const accessedDate = formatDate(fields.accessed);
  const site = fields.site ? `<em>${escapeHtml(fields.site)}</em>` : "";
  const publisher = escapeHtml(fields.publisher);
  const author = escapeHtml(fields.author);
  const titleText = fields.title || fields.href;
  const quotedTitle = quotedLinkedTitle(titleText, fields.href);
  const linkedTitle = plainLinkedTitle(titleText, fields.href);
  const linkedUrl = urlLink(fields.href);

  if (fields.format === "apa") {
    const titlePart = fields.title ? linkedTitle : linkedUrl;
    if (fields.author) {
      return joinSentence([
        asPeriod(author),
        `(${escapeHtml(formatYear(fields.published))}).`,
        asPeriod(titlePart),
        fields.site ? asPeriod(site) : "",
        asPeriod(linkedUrl),
      ]);
    }
    return joinSentence([
      asPeriod(titlePart),
      `(${escapeHtml(formatYear(fields.published))}).`,
      fields.site ? asPeriod(site) : "",
      asPeriod(linkedUrl),
    ]);
  }

  if (fields.format === "chicago-notes") {
    return joinSentence([
      fields.author ? asComma(author) : "",
      asComma(quotedTitle),
      fields.site ? asComma(site) : "",
      fields.publisher ? asComma(publisher) : "",
      publishedDate ? asComma(escapeHtml(publishedDate)) : "",
      asPeriod(linkedUrl),
      accessedDate ? `Accessed ${escapeHtml(accessedDate)}.` : "",
    ]);
  }

  if (fields.format === "chicago-author-date") {
    return joinSentence([
      fields.author ? asPeriod(author) : "",
      `${escapeHtml(formatYear(fields.published))}.`,
      asPeriod(quotedTitle),
      fields.site ? asPeriod(site) : "",
      fields.publisher ? asPeriod(publisher) : "",
      publishedDate ? asPeriod(escapeHtml(publishedDate)) : "",
      asPeriod(linkedUrl),
    ]);
  }

  if (fields.format === "ieee") {
    return joinSentence([
      "[1]",
      fields.author ? asComma(author) : "",
      asComma(quotedTitle),
      fields.site ? asComma(site) : "",
      publishedDate ? asPeriod(escapeHtml(publishedDate)) : "",
      "[Online].",
      `Available: ${linkedUrl}.`,
      accessedDate ? `Accessed: ${escapeHtml(accessedDate)}.` : "",
    ]);
  }

  const container = cleanParts([
    fields.site ? site : "",
    fields.publisher ? publisher : "",
    publishedDate ? escapeHtml(publishedDate) : "",
  ]).join(", ");
  return joinSentence([
    fields.author ? asPeriod(author) : "",
    asPeriod(quotedTitle),
    container ? asComma(container) : "",
    asPeriod(linkedUrl),
    accessedDate ? `Accessed ${escapeHtml(accessedDate)}.` : "",
  ]);
}

function citationClass(format) {
  return `nodevision-citation nodevision-citation--${format.replace(/[^a-z0-9-]/gi, "")}`;
}

function buildCitationHtml(fields) {
  const citation = formatCitation(fields);
  return `<p class="nodevision-citation-entry" data-citation-format="${escapeHtml(fields.format)}"><cite class="${citationClass(fields.format)}">${citation}</cite></p>`;
}

function markEditorChanged() {
  const editorTools = window.HTMLWysiwygTools;
  if (editorTools && typeof editorTools.markDirty === "function") {
    editorTools.markDirty();
    return;
  }

  const wysiwyg = document.getElementById("wysiwyg");
  if (wysiwyg) {
    let event;
    try {
      event = new InputEvent("input", {
        bubbles: true,
        cancelable: false,
        inputType: "insertHTML",
        data: null,
      });
    } catch {
      event = new Event("input", { bubbles: true, cancelable: false });
    }
    wysiwyg.dispatchEvent(event);
  }
  if (window.NodevisionState) {
    window.NodevisionState.fileIsDirty = true;
  }
}

function selectedEditorText() {
  const selection = window.getSelection?.();
  const text = selection ? normalizeText(selection.toString()) : "";
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

export function initToolbarWidget(mount) {
  if (!mount) return;
  ensureCitationStyles();
  mount.classList.add("nv-citation-toolbar-host");
  const selectedText = selectedEditorText();
  const today = localDateInputValue();
  mount.innerHTML = `
    <form class="nv-citation-toolbar" autocomplete="off">
      <label>
        Format
        <select name="format">
          ${FORMAT_OPTIONS.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("")}
        </select>
      </label>
      <label class="nv-citation-url">
        Link
        <input name="url" type="text" inputmode="url" placeholder="https://example.com/source" required>
      </label>
      <label>
        Title
        <input name="title" type="text" placeholder="Page or article title" value="${escapeHtml(selectedText)}">
      </label>
      <label>
        Author
        <input name="author" type="text" placeholder="Last, First">
      </label>
      <label>
        Site
        <input name="site" type="text" placeholder="Website">
      </label>
      <label>
        Publisher
        <input name="publisher" type="text" placeholder="Publisher">
      </label>
      <label>
        Published
        <input name="published" type="date">
      </label>
      <label>
        Accessed
        <input name="accessed" type="date" value="${escapeHtml(today)}">
      </label>
      <button type="submit">Insert web source</button>
      <span class="nv-citation-status" role="status" aria-live="polite"></span>
    </form>
  `;

  const form = mount.querySelector("form");
  const status = mount.querySelector(".nv-citation-status");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const fields = collectFields(form);
    if (!fields.href) {
      status.textContent = "Enter a valid http or https link.";
      return;
    }
    const inserted = insertHtmlAtCaret(buildCitationHtml(fields));
    if (!inserted) {
      status.textContent = "Place the cursor in the HTML editor first.";
      return;
    }
    markEditorChanged();
    status.textContent = "Citation inserted.";
  });
}
