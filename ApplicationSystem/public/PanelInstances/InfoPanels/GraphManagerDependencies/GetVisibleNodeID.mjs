// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/GetVisibleNodeID.mjs
// This file defines browser-side Get Visible Node ID logic for the Nodevision UI.
import { normalizePath } from "./NormalizePath.mjs";

function elementIsDisplayed(element) {
    if (!element || (typeof element.empty === "function" && element.empty())) return false;

    try {
        if (typeof element.visible === "function" && !element.visible()) return false;
    } catch (_) {
        return false;
    }

    try {
        if (typeof element.style === "function" && element.style("display") === "none") return false;
    } catch (_) {
        // ignore
    }

    const ancestors = typeof element.ancestors === "function" ? element.ancestors() : null;
    if (ancestors && typeof ancestors.forEach === "function") {
        let displayed = true;
        ancestors.forEach((ancestor) => {
            if (!displayed) return;
            try {
                if (typeof ancestor.visible === "function" && !ancestor.visible()) displayed = false;
                if (typeof ancestor.style === "function" && ancestor.style("display") === "none") displayed = false;
            } catch (_) {
                displayed = false;
            }
        });
        if (!displayed) return false;
    }

    return true;
}

export function getVisibleNodeId(cy, fullPath) {
    if (!cy) return null;
    const cleanPath = normalizePath(fullPath);
    if (!cleanPath) return null;

    const exactNode = cy.getElementById(cleanPath);
    if (!exactNode.empty() && elementIsDisplayed(exactNode)) {
        return cleanPath;
    }

    const parts = cleanPath.split("/");
    for (let i = parts.length - 1; i > 0; i--) {
        const parentPath = parts.slice(0, i).join("/");
        const parentNode = cy.getElementById(parentPath);
        if (!parentNode.empty() && elementIsDisplayed(parentNode)) {
            return parentPath;
        }
    }

    return null;
}
