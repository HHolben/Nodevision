# Online asset provider rollout

The provider directory records all 21 proposed sources, plus the previously integrated Met. A directory entry is a roadmap record, not a working integration. The Download panel exposes an expandable **Sources and integration status** list. Only usable adapters appear in the Source selector.

| Source | Proposed asset types | Nodevision status | Enabled download formats |
| --- | --- | --- | --- |
| Poly Haven | models, textures, hdri | available | jpg, png, hdr, exr, glb |
| Openverse | images, illustrations, audio | planned | Not integrated |
| Iconify | svg, icons | planned | Not integrated |
| Wikimedia Commons | images, diagrams, maps, audio | available | jpg, png |
| ambientCG | textures, materials, hdri | planned | Not integrated |
| Kenney | sprites, models, game-assets | planned | Not integrated |
| Smithsonian 3D | models, scans | planned | Not integrated |
| Sketchfab | models, scans | planned | Not integrated |
| The Noun Project | svg, icons, images | planned | Not integrated |
| Freesound | audio | planned | Not integrated |
| Google Fonts | fonts | planned | Not integrated |
| Quaternius | models, game-assets | planned | Not integrated |
| SVG Repo | svg, icons, illustrations | planned | Not integrated |
| NASA Image Library | images, video, audio | available | jpg, png |
| OpenGameArt | sprites, textures, models, audio | planned | Not integrated |
| Blend Swap | blender-models | planned | Not integrated |
| CGTrader | models, cad | planned | Not integrated |
| Printables | stl, 3mf, cad | planned | Not integrated |
| Thingiverse | stl, 3mf, cad | planned | Not integrated |
| Project Gutenberg | books, text, html | planned | Not integrated |
| Internet Archive | books, images, video, audio | planned | Not integrated |
| The Met Open Access | images, artwork | available | jpg |

## Capability and configuration contract

ProviderDirectory.mjs defines stable IDs, website links, proposed asset families and six explicit feature flags: search, preview, download, licensing, attribution and formatSelection. Planned integrations report false for all working features. Their proposed types do not promise an API, download permission or editor compatibility. This directory does not claim that public APIs have been verified for every proposed source.

ProviderRegistry.mjs keeps executable adapters separate from the directory. Adapters can implement partial capabilities. Search/inspect/download routes reject missing operations before dispatch. An adapter declaring authentication.configured=false is listed as needs-configuration and excluded from active sources; requests cannot bypass this guard. Authentication labels are public, but credential objects and adapter internals are never serialized. This is a configuration boundary, not an implemented OAuth or credential-entry UI.

Existing adapters expose id, name, categories, formats, licenses, credit, downloadHosts, capabilities, search(query, signal) and inspect(id, signal). Search returns bounded items and a next offset. Inspection returns normalized provenance and downloadable format records with stable id, URL, extension and byte size. An original-file URL must be resolved server-side through the adapter; client-supplied URLs are not accepted by the downloader.

Licensing describes available metadata, not blanket permission. Adapters must distinguish verified known licenses from unknown or conditional usage, preserve creator/source/credit information, and declare attribution requirements. A download capability also does not imply compatible insertion in every editor. The existing downloader and Insert Media commands remain responsible for validation, references, undo and attribution.

## Incremental integration order

1. **Current image adapters:** Poly Haven, Commons, The Met and NASA. Preserve compatibility with existing Notebook/managed destinations and the insertion pipeline.
2. **Additional documented discovery APIs:** evaluate Openverse image/audio coverage, Iconify icon data and Google Fonts. Implement trusted origin policies, SVG handling, audio/font format validation and suitable existing insertion commands before enabling new formats. Openverse is an aggregator; arbitrary publisher URLs must not bypass download-host restrictions.
3. **Textures and models:** evaluate ambientCG, Smithsonian 3D, Kenney and Quaternius. Determine permitted acquisition, archive/dependency handling and editor import compatibility. Pack downloads and standalone files require different validation; no implicit ZIP extraction is added by this directory.
4. **Accounts, commercial access and additional catalogs:** review Sketchfab, The Noun Project, Freesound, SVG Repo, OpenGameArt, Blend Swap, CGTrader, Printables and Thingiverse individually. Verify current APIs, credentials, license/entitlement rules and rate limits; do not substitute scraping or bypass access restrictions.
5. **Books and broader media:** review Project Gutenberg and Internet Archive for documented metadata/download APIs, per-item rights, multi-file format selection and suitable text/book/media insertion paths.

These are implementation queues, not claims about which services currently grant API access. Each source can be activated independently after its adapter, required formats and tests are ready. Until then its website link is available and downloaded local files can still use existing local insertion.

## NASA image increment

The adapter uses the [documented NASA Image Library API](https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf): paginated image search, exact NASA-ID lookup and asset manifests. Search reads twelve entries per page. Only original JPEG/PNG variants on images-assets.nasa.gov are offered; audio/video/TIFF are not enabled. Inspection obtains bounded original sizes, and the existing downloader checks actual bytes/signatures and creates provenance.

The provider retains NASA/photographer/center credits and links the [NASA media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). It deliberately marks per-item permission unverified instead of declaring every item CC0. Existing insertion controls require explicit usage review; third-party rights are not inferred from the NASA host.

## Verification

- ProviderDirectory.test.mjs: all proposed IDs, capability flags, unavailable/configuration guards, credential redaction, NASA metadata, pagination, filtering, cancellation and host/format restrictions.
- Existing download/provider tests: authentication, integrity, destinations, provenance and prior adapters.
- Download-panel browser tests: planned-source visibility without selectable fake integrations, plus existing lifecycle and insertion behavior.
- Optional live NASA smoke test: node scripts/test-added-asset-providers-live.mjs --nasa --download. Uses temporary storage and cleans it afterward.
