// Nodevision/ApplicationSystem/routes/api/fileSaveRoutes/svgSaveGuard.js
// This file protects SVG saves from accidentally overwriting vector files with HTML editor payloads.

function cleanPath(pathValue = "") {
  return String(pathValue || "")
    .trim()
    .replace(/\\/g, "/")
    .split(/[?#]/)[0]
    .replace(/^\/+/, "")
    .replace(/^Notebook\//i, "");
}

export function isSvgSavePath(pathValue = "") {
  const clean = cleanPath(pathValue).toLowerCase();
  const name = clean.split("/").pop() || clean;
  return name.endsWith(".svg");
}

function textFromPayload({ content, encoding = "utf8" } = {}) {
  const enc = String(encoding || "utf8").toLowerCase();

  if (enc === "base64") {
    return Buffer.from(String(content || ""), "base64").toString("utf8");
  }
  if (enc === "binary") {
    return Buffer.from(String(content || ""), "binary").toString("utf8");
  }

  return String(content ?? "");
}

function firstElementName(textValue = "") {
  let rest = String(textValue || "").replace(/^\uFEFF/, "").trimStart();

  for (let i = 0; i < 20 && rest; i += 1) {
    if (rest.startsWith("<?")) {
      const end = rest.indexOf("?>");
      if (end === -1) return "";
      rest = rest.slice(end + 2).trimStart();
      continue;
    }

    if (rest.startsWith("<!--")) {
      const end = rest.indexOf("-->");
      if (end === -1) return "";
      rest = rest.slice(end + 3).trimStart();
      continue;
    }

    const doctypeMatch = rest.match(/^<!doctype\s+([a-zA-Z][\w:-]*)[^>]*>/i);
    if (doctypeMatch) {
      const doctypeName = doctypeMatch[1].toLowerCase();
      if (doctypeName !== "svg") return doctypeName;
      rest = rest.slice(doctypeMatch[0].length).trimStart();
      continue;
    }

    const tagMatch = rest.match(/^<([a-zA-Z][\w:-]*)(?:\s|>|\/)/);
    return tagMatch ? tagMatch[1].toLowerCase() : "";
  }

  return "";
}

export function validateSvgSavePayload({ relativePath, content, encoding = "utf8" } = {}) {
  if (!isSvgSavePath(relativePath)) return { ok: true };

  const text = textFromPayload({ content, encoding });
  const firstTag = firstElementName(text);
  const rootName = firstTag.split(":").pop();

  if (rootName === "html" || rootName === "body") {
    return {
      ok: false,
      error: "Refusing to save an HTML document into an SVG file.",
      code: "SVG_HTML_PAYLOAD",
    };
  }

  if (rootName !== "svg") {
    return {
      ok: false,
      error: "Refusing to save non-SVG content into an SVG file.",
      code: "SVG_CONTENT_MISMATCH",
    };
  }

  return { ok: true };
}
