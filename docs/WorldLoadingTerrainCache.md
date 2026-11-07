# Large terrain cache viewer-loading failure

Verified November 3, 2026 against `Notebook/test.html`, SHA-256 `75533dd604cbacc1de34bd42e1e3c5a5faeef5f4779b51c520a2e0c0edd81292`. The original file was read only; save tests used temporary copies outside the Notebook.

## Exact cause and first divergence

The saved HTML is valid. Its world script contains 771,948 ASCII characters/bytes, including leading and trailing newlines. The elevation cache contains 692,908 Base64 characters representing 64,960 Float64 samples.

The normal viewer path is `GameView.loadSelectedWorld` → `detectWorldKind` → `loadWorldFromFile` → POST `/api/load-world` → filesystem read → Cheerio script extraction → JSON parsing → JSON HTTP response → client runtime. The optional in-memory definition used by sandbox sessions bypasses the endpoint; it is not involved in this failure.

Cheerio extraction is character-for-character identical to the saved script. Browser DOMParser extraction and the HTML editor's `createHtmlSourceDocument` projection/serialization also preserve the script exactly. No transport truncation or line wrapping is necessary to reproduce the error.

Before the fix, the endpoint applied:

```js
.replace(/\/\*[\s\S]*?\*\//g, "")
.replace(/(^|[^:])\/\/.*$/gm, "$1")
.trim()
```

The block-comment pass makes no change to this file. The line-comment pass treats the first `//` inside the elevation string as a comment and removes 621,278 characters through the closing quote and comma. It leaves the existing following newline inside the now unterminated JSON string.

The first destructive divergence is at zero-based offset **148305** in the untrimmed script: saved character `/` (47), transformed character LF (10). After the old `.trim()` removes the leading newline, the error is **148304**, line 3030, column 71655. Comparing both strings with equivalent outer whitespace removed gives the same first divergence, 148304. The resulting parser input shrinks from 771,946 to 150,668 characters.

Nearby saved text contains `...wG/9kUAAAAAA//yRQ...`; the transformed input contains `...wG/9kUAAAAAA\n          "asset"...`. This reproduces the reported “Bad control character in string literal” exactly. The newline is exposed by deletion, not inserted by HTML parsing.

## Fix

`server/routes/worldJson.mjs` parses valid JSON verbatim. If strict parsing fails, its legacy-comment fallback scans quoted strings and escapes, replacing only actual outside-string comments with whitespace. It does not remove or repair invalid cache contents. Both world loading and asset import use this shared parser; asset import had the same unsafe regex.

## Regression and save/reopen evidence

```sh
node ApplicationSystem/server/routes/worldJson.test.mjs
node scripts/test-world-loading-browser.mjs
node scripts/test-world-loading-browser.mjs Notebook/test.html
```

The browser integration serves real HTML through Express, registers the production `/api/load-world` and `/api/save` handlers, and calls the production viewer loader and world saver in Chromium. Neither endpoint is mocked. Toolbar/workspace shells are stubbed. Persistence and backups are confined to a temporary directory and cleaned up afterward. With no argument, a portable HTML fixture contains a genuine 692,908-character encoded cache with slash pairs and 64,960 finite elevation values; no private Notebook fixture is committed.

The test observes actual server `JSON.parse` calls and verifies initial and reopened inputs against their respective saved scripts. It also checks DOM parsing, editor source projection, viewer kind detection, runtime geographic identity, every decoded elevation, complete geographic metadata, and deep equality of every object definition after saving.

Results: all three parser tests pass; both browser integration runs pass. For the actual document, initial and reopened scripts are each 771,948 characters and each parser input equals its corresponding saved script exactly. All three full object definitions and the entire geographic recipe remain equal after save/reopen. The original Notebook file remains untouched.
