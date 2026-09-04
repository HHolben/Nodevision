import {
    readFallbackReferencesFromElement,
    referenceCandidates
} from "./referenceFallbacks.mjs";

const fallbackStates = new WeakMap();
let installedOnDocument = false;

function isFallbackMediaElement(element) {
    const tagName = element?.tagName?.toLowerCase?.();
    return tagName === "img" || tagName === "audio" || tagName === "video";
}

function currentMediaSource(element) {
    return element?.getAttribute?.("src") || "";
}

function candidateKey(candidates) {
    return candidates.join("\n");
}

export function applyMediaFallbackToElement(element) {
    if (!isFallbackMediaElement(element)) return false;
    const primary = currentMediaSource(element);
    const fallbacks = readFallbackReferencesFromElement(element);
    const candidates = referenceCandidates(primary, fallbacks);
    if (candidates.length < 2) return false;

    const key = candidateKey(candidates);
    const current = currentMediaSource(element);
    let state = fallbackStates.get(element);
    if (!state || state.key !== key) {
        state = {
            key,
            tried: new Set([current]),
            index: Math.max(0, candidates.indexOf(current))
        };
        fallbackStates.set(element, state);
    }

    state.tried.add(current);
    for (let index = state.index + 1; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        if (!candidate || state.tried.has(candidate)) continue;
        state.index = index;
        state.tried.add(candidate);
        element.setAttribute("src", candidate);
        if (typeof element.load === "function" && element.tagName.toLowerCase() !== "img") {
            element.load();
        }
        return true;
    }

    return false;
}

export function installNodevisionMediaFallbackRuntime(root = document) {
    const target = root?.addEventListener ? root : document;
    if (target === document && installedOnDocument) return;
    if (target === document) installedOnDocument = true;

    target.addEventListener("error", (event) => {
        applyMediaFallbackToElement(event.target);
    }, true);

    target.addEventListener("load", (event) => {
        const element = event.target;
        if (isFallbackMediaElement(element)) {
            fallbackStates.delete(element);
        }
    }, true);
}
