import {
    getRelativeNotebookReference,
    isExternalNotebookReference,
    normalizeNotebookFilePath,
    resolveNotebookReference,
    splitNotebookReferenceSuffix
} from "./notebookPath.mjs";

export const FALLBACK_LINK_ATTR_PREFIX = "data-nodevision-fallback-";
export const FALLBACK_LINK_ATTR_PATTERN = /^data-nodevision-fallback-(\d+)$/i;

const BLOCKED_SCHEMES = new Set(["javascript:", "file:"]);
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;

export function escapeHtmlAttribute(value = "") {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

export function decodeHtmlAttribute(value = "") {
    return String(value ?? "")
        .replaceAll("&quot;", '"')
        .replaceAll("&#34;", '"')
        .replaceAll("&apos;", "'")
        .replaceAll("&#39;", "'")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&amp;", "&");
}

export function fallbackAttributeName(index) {
    const priority = Number(index) + 1;
    if (!Number.isInteger(priority) || priority < 1) {
        throw new Error("Fallback link index must be a zero-based integer.");
    }
    return `${FALLBACK_LINK_ATTR_PREFIX}${priority}`;
}

export function fallbackAttributePriority(attributeName) {
    const match = String(attributeName ?? "").match(FALLBACK_LINK_ATTR_PATTERN);
    if (!match) return 0;
    const priority = Number(match[1]);
    return Number.isInteger(priority) && priority > 0 ? priority : 0;
}

export function isFallbackAttributeName(attributeName) {
    return fallbackAttributePriority(attributeName) > 0;
}

export function isBlockedReferenceScheme(value = "") {
    const match = String(value ?? "").trim().match(/^([a-z][a-z0-9+.-]*:)/i);
    return Boolean(match && BLOCKED_SCHEMES.has(match[1].toLowerCase()));
}

export function normalizeReferenceCandidate(value = "") {
    const text = String(value ?? "").trim();
    if (!text) return "";
    if (CONTROL_CHARACTER_PATTERN.test(text)) return "";
    if (isBlockedReferenceScheme(text)) return "";
    return text;
}

export function normalizeFallbackReferences(values = [], { primary = "" } = {}) {
    const list = Array.isArray(values) ? values : String(values ?? "").split(/\r?\n/);
    const primaryReference = normalizeReferenceCandidate(primary);
    const seen = new Set(primaryReference ? [primaryReference] : []);
    const normalized = [];
    for (const value of list) {
        const candidate = normalizeReferenceCandidate(value);
        if (!candidate || seen.has(candidate)) continue;
        seen.add(candidate);
        normalized.push(candidate);
    }
    return normalized;
}

export function referenceCandidates(primary = "", fallbacks = []) {
    const normalizedPrimary = normalizeReferenceCandidate(primary);
    const normalizedFallbacks = normalizeFallbackReferences(fallbacks, { primary: normalizedPrimary });
    return normalizedPrimary ? [normalizedPrimary, ...normalizedFallbacks] : normalizedFallbacks;
}

export function readFallbackReferencesFromElement(element) {
    const attrs = Array.from(element?.attributes || []);
    return normalizeFallbackReferences(attrs
        .map((attr) => ({
            priority: fallbackAttributePriority(attr.name),
            value: attr.value
        }))
        .filter((attr) => attr.priority > 0)
        .sort((a, b) => a.priority - b.priority)
        .map((attr) => attr.value));
}

export function removeFallbackReferencesFromElement(element) {
    if (!element) return;
    for (const attr of Array.from(element.attributes || [])) {
        if (isFallbackAttributeName(attr.name)) {
            element.removeAttribute(attr.name);
        }
    }
}

export function applyFallbackReferencesToElement(element, fallbacks = [], { primary = "" } = {}) {
    if (!element) return [];
    const normalized = normalizeFallbackReferences(fallbacks, { primary });
    removeFallbackReferencesFromElement(element);
    normalized.forEach((value, index) => {
        element.setAttribute(fallbackAttributeName(index), value);
    });
    return normalized;
}

export function serializeFallbackAttributes(fallbacks = [], {
    primary = "",
    escapeAttribute = escapeHtmlAttribute
} = {}) {
    return normalizeFallbackReferences(fallbacks, { primary })
        .map((value, index) => ` ${fallbackAttributeName(index)}="${escapeAttribute(value)}"`)
        .join("");
}

export function parseFallbackAttributesFromTagSource(tagSource = "", tagStart = 0) {
    const source = String(tagSource ?? "");
    const attrPattern = /\s+(data-nodevision-fallback-(\d+))\s*=\s*(["'])(.*?)\3/gis;
    const matches = [];
    let match;
    while ((match = attrPattern.exec(source))) {
        const priority = Number(match[2]);
        const encodedValue = match[4] || "";
        const valueStart = tagStart + match.index + match[0].indexOf(encodedValue);
        const decodedValue = decodeHtmlAttribute(encodedValue);
        const candidate = normalizeReferenceCandidate(decodedValue);
        if (!candidate || !Number.isInteger(priority) || priority < 1) continue;
        matches.push({
            attributeName: match[1].toLowerCase(),
            priority,
            rawTarget: candidate,
            encodedTarget: encodedValue,
            range: {
                start: valueStart,
                end: valueStart + encodedValue.length,
                escapeHtmlAttribute: true
            }
        });
    }
    return matches.sort((a, b) => a.priority - b.priority);
}

export function replaceFallbackAttributesInHtmlTag(tagSource = "", fallbacks = [], { primary = "" } = {}) {
    const withoutFallbacks = String(tagSource ?? "")
        .replace(/\s+data-nodevision-fallback-\d+\s*=\s*(["']).*?\1/gis, "");
    const attrs = serializeFallbackAttributes(fallbacks, { primary });
    return withoutFallbacks.replace(/(\s*\/?>)$/s, `${attrs}$1`);
}

function looksLikeNotebookReference(value = "") {
    const text = String(value ?? "").trim();
    if (!text || text.startsWith("#")) return false;
    if (/^\/?Notebook\//i.test(text)) return true;
    if (text.startsWith("/") || text.startsWith("./") || text.startsWith("../")) return true;
    if (text.includes("/")) return true;
    const { pathPart } = splitNotebookReferenceSuffix(text);
    return /\.[A-Za-z0-9]{1,12}$/.test(pathPart);
}

export function normalizeReferenceForSource(value = "", { sourcePath = "" } = {}) {
    const candidate = normalizeReferenceCandidate(value);
    if (!candidate) return "";
    if (candidate.startsWith("#") || isExternalNotebookReference(candidate)) return candidate;
    if (!looksLikeNotebookReference(candidate)) return candidate;

    const resolved = sourcePath
        ? resolveNotebookReference({ sourcePath, reference: candidate })
        : "";
    if (resolved) {
        return getRelativeNotebookReference({
            sourcePath,
            targetPath: resolved,
            suffix: splitNotebookReferenceSuffix(candidate).suffix
        });
    }

    const { pathPart, suffix } = splitNotebookReferenceSuffix(candidate);
    const normalizedPath = normalizeNotebookFilePath(pathPart);
    if (!normalizedPath) return candidate;
    if (!sourcePath) return suffix ? `${normalizedPath}${suffix}` : normalizedPath;
    return getRelativeNotebookReference({
        sourcePath,
        targetPath: normalizedPath,
        suffix
    });
}

export function normalizeFallbackReferencesForSource(fallbacks = [], {
    sourcePath = "",
    primary = ""
} = {}) {
    const normalizedPrimary = normalizeReferenceForSource(primary, { sourcePath });
    return normalizeFallbackReferences(
        (Array.isArray(fallbacks) ? fallbacks : String(fallbacks ?? "").split(/\r?\n/))
            .map((value) => normalizeReferenceForSource(value, { sourcePath })),
        { primary: normalizedPrimary }
    );
}

export function resolveReferenceCandidates({
    sourcePath = "",
    primary = "",
    fallbacks = []
} = {}) {
    return referenceCandidates(primary, fallbacks).map((rawTarget, index) => {
        const role = index === 0 ? "primary" : "fallback";
        const priority = index;
        const targetPath = isExternalNotebookReference(rawTarget)
            ? ""
            : resolveNotebookReference({ sourcePath, reference: rawTarget });
        return {
            rawTarget,
            targetPath,
            role,
            priority,
            isNotebookReference: Boolean(targetPath),
            isExternalReference: isExternalNotebookReference(rawTarget)
        };
    });
}
