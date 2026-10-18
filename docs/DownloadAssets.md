# Virtual World Editor: Download Assets (V1)

Open **File → Download** in Virtual World Editing or VR World Editing. The normal workspace panel opens on the right, retains the active editor context, and reuses its existing panel/cell when reopened. Its standard header supports docking, floating, resizing and closing. No discovery or download operation edits the world.

Search Poly Haven, optionally filter by category, format and license, select a result, inspect its creator/license and original-file choices, then choose a destination and click **Download**. Format filtering checks actual downloadable files in each 12-item catalog page; a filtered page can be empty while **Next results** remains available. Source and catalog results are cached for five minutes. Failed searches can be retried with Search; source-configuration failures can be retried by reopening the panel.

## Provider and formats

V1 implements the [documented Poly Haven public API](https://github.com/Poly-Haven/Public-API), using `/assets`, `/info/{id}` and `/files/{id}`. No API key or credentials are needed under the [API terms](https://github.com/Poly-Haven/Public-API/blob/master/ToS.md). Server requests identify Nodevision in their user-agent; the panel displays a visible Poly Haven credit. Assets use [CC0](https://polyhaven.com/license); the service credit and asset licensing are separate requirements.

Supported original standalone files: **JPEG, PNG, HDR, EXR and GLB**, up to **128 MiB per file**. The server checks extension, signature, exact catalog size and the provider's checksum when supplied, and records SHA-256. This is type/integrity checking, not a comprehensive parser or malware scanner.

Categories include models, voxel structures, textures/materials, terrain/heightmaps, vegetation, and images/environment maps. Poly Haven does not provide voxel structures. Terrain/vegetation filters use catalog tags; they do not promise an elevation dataset or procedural tree. Models without a supported standalone GLB remain inspection-only. Individual texture maps are saved as original images, not converted into Nodevision material definitions.

V1 uses provider thumbnail previews, including for models. It does not run a 3D scene or load model dependencies during inspection. No archives, extraction, conversion, Blender files, glTF sidecars or scripts are downloaded. HDR/EXR files are registered as image resources but are not directly supported by the Insert Asset billboard loader. PNG/JPEG and GLB use the existing import workflow. A downloaded GLB is never loaded automatically; any later import is a separate user action through the existing loader.

## Existing storage and discovery

Destination choices come from **enabled image/model Resource Registry sources**. Notebook sources save project assets; managed sources use the established `UserData/Resources/...` library across Notebooks. Disabled sources and application code/bundled resource directories are excluded. Existing custom resource paths are honored and checked again at download time. An optional relative subfolder stays within the selected source. No new global asset store or dependency configuration is introduced.

A click on Download authorizes that write. Duplicate names get numeric suffixes, and existing asset or sidecar files are never overwritten. Each asset has a `.source.json` sidecar containing source, creator, license, attribution, chosen original URL/format, size, timestamp and SHA-256. Find Notebook files through **File Manager** or **Insert → Asset** by navigating to the reported folder; refresh an already open listing if needed. Managed files appear through the existing **Resource Registry / Find / Install Resource** workflow. The recent-download list retains the latest 20 successful downloads for the current application-page session, including panel close/reopen; provenance sidecars persist across restarts.

Cancellation and panel close abort outstanding requests. Failed/incomplete transfers remove temporary files and any partially installed asset/sidecar. A server-process crash can leave a hidden `.asset-download-*.part` file, which is not a supported import format. No extraction takes place, so archive bombs cannot be expanded. Destination traversal and symlink components are rejected; provider HTTPS hosts and every redirect are allowlisted. URLs supplied by clients are not used: the server resolves the selected format from the provider's catalog. Discovery requires authentication. Downloads require authentication, explicit authorization, and at most one concurrent transfer per identity. Requests have bounded timeouts and catalog/file sizes.

## Implementation and extension points

- `AssetDownloads/ProviderRegistry.mjs`: provider registry and public capability descriptors. An adapter implements `search` and `inspect`; inspection returns normalized metadata and supported original formats. `downloadHosts` controls permitted original-file hosts. Networking remains outside the panel.
- `AssetDownloads/PolyHavenProvider.mjs` / `ProviderNetwork.mjs`: documented API adaptation, normalization, caching and bounded HTTPS requests.
- `AssetDownloads/DownloadDestinations.mjs`: existing layered Resource Registry resolution.
- `AssetDownloads/DownloadAsset.mjs` / `DownloadValidation.mjs`: streaming, exclusive publication, signatures and provenance.
- `server/routes/assetDownloadRoutes.mjs`: authenticated discovery and NDJSON progress/cancellation.
- `public/AssetDownloads/*` and `PanelInstances/InfoPanels/DownloadAssetsPanel.mjs`: presentation and request lifecycle.
- `ToolbarCallbacks/file/downloadAssets.mjs` and `fileToolbar.json`: File menu and singleton docking. Workspace split helpers gained an optional `activate: false`; existing callers retain their default activation behavior.

Future providers should declare their actual capabilities/licenses and read any required credentials from server configuration, never client bundles. A restricted license must be clearly identified in metadata before enabling downloads. Add categories/formats deliberately, including their type validation and existing-loader compatibility.

## Verification

```sh
node ApplicationSystem/AssetDownloads/Tests/AssetDownloads.test.mjs
node ApplicationSystem/AssetDownloads/Tests/AssetDownloadRoutes.test.mjs
python3 scripts/test-download-assets-browser.py
node scripts/test-asset-download-live.mjs
```

The live smoke test is opt-in, uses the real service, downloads a small original JPEG into a temporary Notebook, validates it and removes the fixture. Browser tests use real panel creation, splitting/docking and removal cleanup with controlled provider responses; Status Bar and panel-tab context are stubbed. Service tests cover normalization, filtering/cache, authentication, layered destinations, disabled/custom paths, symlinks/traversal, hostile redirects, signatures, incomplete/oversized streams, checksum errors, cancellation, offline errors, duplicates and provenance.
