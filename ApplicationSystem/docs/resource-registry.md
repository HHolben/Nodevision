# Nodevision Resource Registry

The Resource Registry is the typed resource layer over the older single-value Resource Paths system. Code should resolve reusable assets by category instead of hard-coding one Notebook folder:

```js
await getResources(ctx, "font");
await getResources(ctx, "dictionary");
await getResources(ctx, "faa.sectional");
await getResources(ctx, "material");
await getResources(ctx, "electronics.component");
```

## Source Types

Each resource type can use multiple ordered sources. Source IDs are stable and saved in `UserSettings/ResourcePaths.json` under `resources`.

- `application`: read-only files shipped with Nodevision, resolved under `ApplicationSystem/public`.
- `managed`: user-owned shared resources under `UserData`, outside any Notebook.
- `notebook`: Notebook-relative Library or Personal Notebook folders.

Notebook sources are stored as Notebook-relative paths. Application and managed sources are stored relative to their own source roots. Absolute paths and `..` traversal segments are rejected. Missing folders produce diagnostics and empty resource lists rather than crashing callers.

## Resolution Strategies

- `collection`: returns the union of all enabled sources. Duplicate logical IDs resolve predictably by priority; higher-priority sources override lower-priority entries with the same ID.
- `overlay`: applies lower-priority resources first and higher-priority resources last. Lower layers are not modified, and resolved resources keep layer provenance.

Higher numeric `priority` means higher precedence. The Settings panel shows higher precedence first.

`electronics.component` is declared as a collection because callers receive a collection of logical components. Inside each logical component, metadata and subresources are still layered by source priority so personal Notebook annotations can extend or override application, managed, or shared Notebook libraries.

## Built-In Types

- `font`: collection of `.ttf`, `.otf`, `.woff`, and `.woff2` files from Application Fonts, Managed Fonts, and Notebook Fonts. The graphical HTML editor loads these logical font identities and applies them using `@font-face`, while preserving existing Notebook-relative and web-font references.
- `dictionary`: overlay of JSON dictionary documents plus `.txt` and `.wordlist` spelling lists. The resolver returns entry-level results.
- `faa.sectional`: collection of FAA sectional chart packages. The updater and status code resolve the active writable source through the registry instead of assuming a hard-coded Notebook folder.
- `material`: overlay of material JSON definitions from Application, Managed, and Notebook sources. Higher-priority layers override only the fields they provide.
- `electronics.component`: collection of circuit component library documents and electronics assets from Application, Managed, shared Notebook, and Personal Notebook sources. The display name is `Circuit Component Libraries`.

## Dictionary Model

Dictionary documents can contain `entries` or `operations`. Each item targets an entry by `term` and optionally a sense by `senseId`.

Supported operations:

- `add`: adds an entry or sense without erasing lower-priority senses.
- `override-sense`: replaces or patches one sense while preserving the rest of the entry.
- `override-entry`: replaces the visible senses for one term while retaining overlay history.
- `annotate`: attaches notes, links, or tags to an entry or sense.
- `suppress`: hides an entry or a single sense from the resolved output.

Spelling metadata can be attached at the entry or sense level with fields such as `accepted`, `preferred`, `caseSensitive`, `tags`, and `notes`.

## Circuit Component Model

Circuit component library JSON files can contain a `components` array, an `operations` array, a single `component` object, or one component object at the top level. Stable component identities use `componentId`; if omitted, the resolver derives a local ID from manufacturer and part number, or from the file or display name.

A logical component can describe:

- identity, display name, category, description, and generic versus specific component kind
- manufacturer, manufacturer part number, device family, and generic component identity
- pins, schematic symbols, footprints, packages, electrical properties, and lifecycle or status metadata
- simulation models, SPICE models, IBIS models, 3D models, datasheets, documentation, alternates, substitutes, and material references
- provenance at the component level and subresource level

Package, footprint, datasheet, symbol, model, and other child records should carry stable IDs. Variants and packages should be represented as child subresources, not as replacement logical components unless they are truly separate parts.

Supported component operations are:

- `add`: adds or augments a component and merges child records by stable subresource ID.
- `override`: patches component metadata or child records with higher-priority values.
- `annotate`: adds notes, datasheets, docs, or annotations without replacing lower-priority records.
- `suppress`: hides a logical component or a targeted subresource such as one footprint.

Duplicate component IDs are merged deterministically by source priority and reported through diagnostics. Duplicate subresource IDs are also merged deterministically and preserve provenance from both records. This is intentionally not a whole-file replacement model.

Component documents may point at existing material resources by ID in `materials` or `materialRefs`. They should not duplicate full material definitions from the material database.

Datasheets and other Notebook assets should be written as Notebook-relative paths and are normalized with the same Notebook path utilities used by the older Resource Paths system. Unsafe local references are diagnosed and removed from the resolved component payload. Missing subordinate files produce diagnostics but do not prevent the component from loading.

## Format Adapters

The component registry currently parses JSON component-library documents and provides lightweight asset adapters for known electronics formats. Standalone `.cir`, `.sp`, `.spi`, and `.subckt` files become SPICE model subresources. `.ibs` files become IBIS model subresources. `.kicad_sym` and `.lib` files become schematic-symbol subresources. `.kicad_mod` and `.mod` files become footprint subresources. `.step`, `.stp`, `.stl`, `.obj`, `.glb`, and `.gltf` files become 3D model subresources. `.pdf` files become datasheet subresources.

The adapters are intentionally narrow. Rich KiCad, SPICE, IBIS, STEP, and STL parsing can be added behind the same normalized component document shape.

## Compatibility

The existing `resourcePaths` object in `UserSettings/ResourcePaths.json` is still read and mirrored for legacy keys such as `fonts`, `dictionaries`, `aviation.sectionalMaps`, `materials`, and `electronics.components`. Older settings files keep working, and new resource sources live alongside the legacy object in the same JSON file.

The registry deliberately avoids absolute Notebook paths, so a Notebook can move between machines without rewriting settings. UserData managed resources are associated with the local Nodevision user profile rather than a specific Notebook.
