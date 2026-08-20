# Resource Paths

Resource Paths are named, Notebook-relative directories for reusable local resources. They keep resource locations portable with the active Notebook instead of storing absolute machine paths.

Configuration lives in `UserSettings/ResourcePaths.json` as human-readable JSON:

```json
{
  "version": 1,
  "resourcePaths": {
    "aviation.sectionalMaps": { "path": "Resources/Aviation/Sectionals" },
    "project.media": { "name": "Project Media", "path": "Resources/Media" }
  }
}
```

Built-in keys are protected from deletion: `aviation.sectionalMaps`, `maps.streetMaps`, `maps.terrain`, `fonts`, `dictionaries`, and `contacts`. Custom keys use dot-separated machine-readable names such as `project.media`.

Server code should use `ApplicationSystem/ResourcePaths/ResourcePathStore.mjs`:

```js
import { getResourcePath, listResourcePaths, resolveResourcePath, setResourcePath } from "./ResourcePaths/ResourcePathStore.mjs";
```

The store provides `get`, `set`, `has`, `list`, and `resolve` behavior through exported helpers. Browser code should use `/api/resource-paths`, which reports the configured Notebook-relative path plus `exists` and `isDirectory` status without exposing absolute filesystem paths.

The FAA sectional map updater resolves `aviation.sectionalMaps` through this registry. The registry names locations only; downloaders, indexers, and feature-specific readers remain separate services.
