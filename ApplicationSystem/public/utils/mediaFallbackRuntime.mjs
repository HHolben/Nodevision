import {
    readFallbackReferencesFromElement,
    referenceCandidates
} from "./referenceFallbacks.mjs";

const fallbackStates = new WeakMap();
const handledErrorEvents = new WeakSet();
let installedOnDocument = false;

function isFallbackMediaElement(element) {
    const tagName = element?.tagName?.toLowerCase?.();
    return tagName === "img" || tagName === "audio" || tagName === "video";
}

function currentMediaSource(element) {
    return element?.getAttribute?.("src") || element?.currentSrc || element?.src || "";
}

function candidateKey(candidates) {
    return candidates.join("\n");
}

export function applyMediaFallbackToElement(element) {
    if (!isFallbackMediaElement(element)) return false;
    const current = currentMediaSource(element);
    const fallbackKey = candidateKey(readFallbackReferencesFromElement(element));
    let state = fallbackStates.get(element);

    if (!state || state.fallbackKey !== fallbackKey || !state.candidates.includes(current)) {
        const candidates = referenceCandidates(current, readFallbackReferencesFromElement(element));
        state = {
            fallbackKey,
            candidates,
            tried: new Set([current]),
            index: Math.max(0, candidates.indexOf(current))
        };
        fallbackStates.set(element, state);
    }

    if (state.candidates.length < 2) return false;
    state.tried.add(current);
    for (let index = state.index + 1; index < state.candidates.length; index += 1) {
        const candidate = state.candidates[index];
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

export function installNodevisionMediaFallbackRuntime(root = globalThis.document) {
    const documentTarget = globalThis.document;
    const target = root?.addEventListener ? root : documentTarget;
    if (!target?.addEventListener) return false;
    if (target === documentTarget && installedOnDocument) return false;
    if (target === documentTarget) installedOnDocument = true;

    target.addEventListener("error", (event) => {
        if (handledErrorEvents.has(event)) return;
        handledErrorEvents.add(event);
        applyMediaFallbackToElement(event.target);
    }, true);

    target.addEventListener("load", (event) => {
        const element = event.target;
        if (isFallbackMediaElement(element)) {
            fallbackStates.delete(element);
        }
    }, true);
    return true;
}
