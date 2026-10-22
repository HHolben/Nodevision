# Download assets

Open **File → Download** (replacing the obsolete Download File command). The reusable workspace panel opens beside the editor and supports normal docking and closing. File deletion commands remain available.

File → Download defaults to **Download Only**. Insert → Media → **Download from Online Source…** opens the same panel in insertion mode, defaulting to attributed insertion when compatible. The optional online button also appears in the existing Image form and retains its storage and fallback-reference settings. Opening local Insert Media does not start online discovery.

Choose a source, search and inspect an asset, choose an original file and destination, then choose **Download Only**, **Download and Insert**, or **Download, Insert, and Attribute**. The preview identifies the source, license, destination, captured document, insertion type and credit placement. Catalog identifiers preserve case, including IDs such as `ArmChair_01`.

## Editor targeting and insertion

Opening the panel captures the originating document and insertion location. Panel focus does not change that target. Use the target selector and **Capture selected editor/location** to explicitly recapture it. Changed, closed or read-only targets reject insertion while retaining the downloaded file.

- HTML graphical: insert at the captured caret using existing editor history; optional visible credit.
- HTML and SVG code: insert appropriate markup at the captured selection through Monaco undo operations. Unsafe markup locations fall back to Download Only or explicitly confirmed path insertion.
- PHP code: insert markup only in recognizable HTML regions; uncertain PHP contexts require reviewed path insertion.
- SVG graphical: insert into the captured unlocked layer, or document root when there are no layers. Image and optional credit share an undo operation.
- PNG/JPEG graphical: create a movable, resizable floating selection. Commit or cancel placement before another download. Commit does not save the document.
- Virtual World: insert supported images as image planes using existing layer history. Save/reload preserves the resource reference and embedded attribution.
- glTF/GLB editors and incompatible formats: Download Only. No history-safe model merge adapter is available.

Insertion never automatically saves the originating document. Undo removes the document change, not the downloaded asset. Raster placement can be cancelled without deleting its source file. World credits use embedded provenance and project credits; visible world credit signs are not implemented. Graphical SVG uses existing application resource URLs; code insertion uses document-relative Notebook references. Portable SVG export rebasing is not added.

## Destinations and credits

The recommended destination is project-relative and honors existing image/assets folder conventions, including PHP public folders. Enabled Notebook and managed image/model Resource Registry sources remain available. Disabled sources and application code directories are excluded. Relative subfolders stay within the selected source; duplicate filenames receive numeric suffixes.

Each download has a `.source.json` provenance sidecar. For supported captured documents, `AssetAttributions.json` records stable provider/asset/format identities, source, creator, license, local files and document references. Missing authors remain unknown. Repeated attribution is deduplicated. Project credits can be viewed and exported from the panel.

Unknown licensing requires explicit responsibility confirmation before insertion. Required credits cannot silently be omitted. Project records and hidden metadata alone may not satisfy a license's distribution requirements; include appropriate credits with distributed work.

Downloads, insertion and attribution are independently retryable. If insertion or project-credit writing fails, the file remains available and Retry uses that saved file. A retry after successful insertion does not insert it twice. Download Only leaves document contents unchanged.

Application file rename, cut/move, folder move and delete operations update known attribution references and sidecars. Deleted files retain attribution history marked missing. External filesystem changes and managed-library moves are not automatically reconciled. Manifest document references record insertion history; arbitrary later content edits or undo do not prune them.

## Provider and transfer limits

Poly Haven uses its [public API](https://github.com/Poly-Haven/Public-API). The panel displays service credit; asset licensing is separately identified. Search pages contain 12 entries and catalogs are cached for five minutes. Format filtering can yield an empty page while further results remain available.

Supported original downloads are JPEG, PNG, HDR, EXR and standalone GLB, up to 128 MiB. HDR/EXR and GLB are download-only in this workflow. Texture maps are not automatically converted into material definitions. No archives, scripts, conversion or remote model dependencies are loaded. Model inspection uses provider thumbnails.

Authenticated downloads require explicit write authorization and respect LAN write permissions. Provider hosts and redirects are allowlisted. The server resolves original URLs from catalog metadata and validates size, signature and available checksum, then records SHA-256. Traversal and symlink destinations are rejected. This is integrity/type validation, not comprehensive malware scanning.

Closing the panel cancels outstanding transfers. Failed transfers clean up temporary files; a server crash can leave a hidden `.asset-download-*.part` file. The recent-download list lasts for the application-page session; provenance persists on disk.

## Implementation

Backend modules live in `ApplicationSystem/AssetDownloads/`: provider adaptation, destination resolution, transfer validation, project attribution and file-operation synchronization. Authenticated routes are in `ApplicationSystem/server/routes/assetDownloadRoutes.mjs`.

Frontend modules in `ApplicationSystem/public/AssetDownloads/` capture editor context and manage independent workflow retries. Download adapters create normal ResourceReference values through ResourceAcquisitionService; `ToolbarJSONfiles/insertMediaResource.mjs` owns editor dispatch and `insertMediaCode.mjs` owns code insertion. The local image form and downloaded images share this insertion command. `DownloadAssetsPanel.mjs` owns panel lifecycle. Existing HTML, SVG, raster and world editor APIs provide history and save behavior.

## Verification

```sh
node ApplicationSystem/AssetDownloads/Tests/AssetDownloads.test.mjs
node ApplicationSystem/AssetDownloads/Tests/AssetDownloadRoutes.test.mjs
node ApplicationSystem/AssetDownloads/Tests/UniversalAssets.test.mjs
python3 scripts/test-download-assets-browser.py
python3 scripts/test-universal-assets-browser.py
env -u ELECTRON_RUN_AS_NODE NV_WORLD_BROWSER=downloaded-assets-world-browser.mjs xvfb-run -a node_modules/electron/dist/electron --no-sandbox scripts/procedural-world.electron.cjs
node scripts/test-asset-download-live.mjs
```

Browser tests use real editor/panel/history APIs with controlled provider responses. The world test controls texture loading. The opt-in live smoke test downloads a small original JPEG into a temporary Notebook, validates it and removes the fixture.

## Insert Media integration audit and limitations

The existing entry is `insertMediaWidget.mjs`, which reads media families from ModuleMap and opens `insertMediaPanel.mjs` forms. Existing Image, Video, Sound, Model and other family commands remain in place. Local file inputs, Browse Web, new-file generation and source defaults are retained. The online command is appended after local commands and appears only for supported editor contexts.

`insertMediaImage.mjs` resolves Notebook paths through `insertMediaIO.mjs` / ResourceAcquisitionService, constructs ResourceReference values, and retains fallback references. SVG uses its captured editor registry; HTML uses its editor insertion/history API. `insertMediaResource.mjs` makes these editor commands available for normalized acquired resources, including the existing raster placement and world image-plane APIs. No download provider writes editor markup.

The actual image storage controls in this checkout are **Referenced** (default) and **Inline**. They are now rendered by the same `insertMediaStorage.mjs` helper in the original form and download panel. Notebook destinations provide local files; enabled managed-library destinations provide shared files, referenced through existing registry URLs. No alternate Local/Shared/External mode system or library is introduced. Inline reads the validated saved file through existing acquisition. World image planes require saved references, so Inline is disabled there.

Existing external URL insertion remains unchanged. Provider hotlinking is not enabled: its original download endpoints are not declared permanent external references. Other provider formats, audio/video acquisition and glTF/model import require a compatible provider and existing editor adapter; the current providers and supported formats are documented below. Unsupported assets stay Download Only. No new provider API or executable import is added.

Credit placement defaults to project credits, avoiding unsolicited captions in arbitrary document locations. Users can choose visible credits where supported. Sidecars, project manifests, failure retries and download retention on undo are shared with File → Download.

Integration browser coverage includes local insertion while fetch is offline, unchanged local defaults, no discovery on local form open, shared and inline ResourceReferences, preserved Notebook identity, native undo, singleton reuse by both entry points, original caret after focus changes, and standalone mode without automatic insertion.

## Additional online sources

The Source dropdown now also includes:

| Source | Available originals | Licensing |
| --- | --- | --- |
| Wikimedia Commons | JPEG and PNG photos/illustrations | Per-file metadata: CC BY, CC BY-SA, CC0 or public domain when recognized; other licenses remain explicitly unverified |
| The Met Open Access | Original JPEG collection images | Only objects explicitly marked public domain with an original image URL |

These providers use the same downloader, destinations, Insert Media pipeline, sidecars and project credits. No account or API key is configured for either. Categories, formats and license filters update when the source changes. Other file types, including Commons SVG/audio and new model libraries, are not added by these adapters.

Commons uses the documented [MediaWiki Imageinfo API](https://www.mediawiki.org/wiki/API:Imageinfo) with paginated file search, original size/MIME metadata, thumbnail URLs and extended license/credit metadata. CC BY/ShareAlike credits remain required. Unrecognized licensing retains the provider-reported terms and source link, and requires explicit confirmation before insertion. Commons content is not assumed to be CC0.

The Met uses its [Collection API](https://metmuseum.github.io/), including the current `/v1.1/search` offset/limit endpoint. It retrieves at most twelve object records per page, with at most three detail requests at once. Stale 404 object records and non-public-domain images are omitted; service errors are reported. A HEAD request obtains the original size on inspection, and the normal downloader verifies actual bytes and signature. Search does not fetch original files. Collection credit is preserved.

Both adapters cache bounded metadata for five minutes, restrict API/image requests to their own HTTPS hosts, and reject off-host redirects. Filtering may leave an empty page while Next results remains available. Search pagination is bounded to the first 10,000 provider results; narrow the search for more specific results. Met does not supply an upstream checksum through this adapter, so the shared downloader records SHA-256 after size/signature validation.

Additional verification:

```sh
node ApplicationSystem/AssetDownloads/Tests/AdditionalProviders.test.mjs
node scripts/test-added-asset-providers-live.mjs
node scripts/test-added-asset-providers-live.mjs --download
```

The optional live download check uses temporary folders and removes its downloaded images and provenance afterward.

## Provider rollout directory

See [Online asset provider rollout](OnlineAssetProviders.md) for all 21 proposed sources, implemented feature flags, configuration boundaries and staged integration requirements. The existing Met source is retained. NASA image discovery and original JPEG/PNG downloads are the newest adapter; other proposed providers remain explicitly planned.
