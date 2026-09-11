// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/EdgeBucketHydrationPlan.mjs
// Plans locality-preserving graph edge bucket hydration for visible notebook paths.

export const EDGE_BUCKET_SYMBOLS = [
    ..."abcdefghijklmnopqrstuvwxyz",
    ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    ..."0123456789",
    "#",
    "_",
];

const EDGE_BUCKET_SYMBOL_SET = new Set(EDGE_BUCKET_SYMBOLS);

export function edgeBucketSymbolsForPaths(paths = [], normalizePath = (value) => String(value || "")) {
    const symbols = new Set();
    const values = Array.isArray(paths) ? paths : [paths];
    for (const pathValue of values) {
        const clean = normalizePath(pathValue || "");
        const name = clean.split("/").filter(Boolean).pop() || clean || "";
        const first = String(name || "").trim().charAt(0);
        if (!first) {
            symbols.add("#");
            continue;
        }
        if (/^[A-Za-z0-9]$/.test(first)) {
            symbols.add(first);
        } else {
            symbols.add("#");
            if (first === "_") symbols.add("_");
        }
    }
    return [...symbols].filter((symbol) => EDGE_BUCKET_SYMBOL_SET.has(symbol));
}

export function buildEdgeBucketHydrationPlan(paths = [], options = {}) {
    const normalizePath = typeof options.normalizePath === "function" ? options.normalizePath : (value) => String(value || "");
    const loaded = options.loaded instanceof Set ? options.loaded : new Set();
    const targetSymbols = options.all === true ? EDGE_BUCKET_SYMBOLS : edgeBucketSymbolsForPaths(paths, normalizePath);
    const sourceSymbols = options.all === true ? EDGE_BUCKET_SYMBOLS : edgeBucketSymbolsForPaths(paths, normalizePath);
    const requests = [];

    for (const symbol of targetSymbols) {
        const cacheKey = "target:" + symbol;
        if (options.force !== true && loaded.has(cacheKey)) continue;
        requests.push({ kind: "target", symbol, cacheKey, url: `/public/data/edges/${encodeURIComponent(symbol)}.json` });
    }

    for (const symbol of sourceSymbols) {
        const cacheKey = "source:" + symbol;
        if (options.force !== true && loaded.has(cacheKey)) continue;
        requests.push({ kind: "source", symbol, cacheKey, url: `/public/data/edges/by-source/${encodeURIComponent(symbol)}.json` });
    }

    return {
        requests,
        targetSymbols,
        sourceSymbols,
        requested: requests.length,
        targeted: options.all !== true,
    };
}
