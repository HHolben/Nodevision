# Built-in mobs — Phase M0

Phase M0 prepared folders and reused existing static resource access. The sections below record that initial groundwork. **M1 update:** the user has since installed the Google Rabbit GLB/OBJ and CC BY 3.0 `licenseNotice.md` in BrownHare/Models, replacing the originally planned Quaternius download. The original files are preserved. See [MobPhaseM1BrownHare.md](MobPhaseM1BrownHare.md) for the current runtime, model verification and setup; the historical M0 examples below are illustrative, not the current inventory.

## Location and ownership

Built-in content belongs under **`ApplicationSystem/public/BuiltIn/Mobs/`**, rather than a new root-level BuiltIn folder. This adapts the proposed organization to Nodevision's existing browser resource tree. It sits alongside existing public assets, is separate from Notebook content and application modules, and requires no additional HTTP endpoint or asset manager.

```text
ApplicationSystem/public/BuiltIn/Mobs/
├── Mammals/
│   └── BrownHare/
│       ├── README.md
│       ├── Models/.gitkeep
│       ├── Textures/.gitkeep
│       └── Animations/.gitkeep
├── Amphibians/.gitkeep
├── Reptiles/.gitkeep
├── Fish/.gitkeep
├── Insects/.gitkeep
└── Birds/.gitkeep
```

Models holds original models and dependent bundles. Textures and Animations reserve locations for independent resources, not a requirement to reorganize downloaded bundles. Embedded animations remain embedded. Minimal `.gitkeep` files preserve otherwise empty directories. Mammals needs no marker because BrownHare contains files. No empty species folders or JavaScript implementation modules are added.

Future code is reserved conceptually at `ApplicationSystem/public/MetaWorld/Mobs/`, with Runtime, Behaviors, Navigation and Rendering as possible future subdivisions. Those folders are not created in M0. Phase M1 should establish reusable species-independent runtime responsibilities and the `mob.json` schema; there are no placeholder definitions to migrate.

## Installing the Bunny manually

Extract the user-selected Quaternius animated Bunny from Poly Pizza into:

```text
<application-root>/ApplicationSystem/public/BuiltIn/Mobs/Mammals/BrownHare/Models/
```

On this checkout the exact directory is `/home/henry/Nodevision/ApplicationSystem/public/BuiltIn/Mobs/Mammals/BrownHare/Models/`.

Keep original filenames, case and relative paths. For multi-file glTF, copy the entire downloaded model folder, including its `.bin` and texture subfolders. Do not flatten the archive or move dependent images into the sibling Textures folder unless the original references already point there. For a self-contained GLB, simply place the file in Models. Retain accompanying license/attribution files at their supplied locations; species-level license documents may also live beside README.md. The project request describes the selected asset as CC0; no original license was received or independently verified here. No fabricated LICENSE.txt is provided.

**Illustrative installation only — these files do not currently exist:**

```text
BrownHare/
├── README.md
├── Models/
│   └── DownloadFolder/         # use the original directory name
│       ├── Bunny.gltf         # use the actual downloaded filename
│       ├── Bunny.bin
│       ├── textures/
│       │   └── Bunny.png
│       └── LICENSE.txt        # only if included in the download
├── Textures/
└── Animations/
```

The actual download may have different filenames, a GLB, FBX or a different layout. This example does not assert that the supplier uses these names.

## URLs and existing loaders

`ApplicationSystem/server.mjs` already mounts `express.static(ctx.publicDir)` at the origin root. A hypothetical `Models/DownloadFolder/Bunny.gltf` is therefore available as:

```text
/BuiltIn/Mobs/Mammals/BrownHare/Models/DownloadFolder/Bunny.gltf
```

Future code can pass that same-origin URL to the existing Three.js GLTFLoader. Encode individual filename segments when needed; URL case must match filesystem case. Relative `.bin` and image URIs are resolved from the model URL's directory by GLTFLoader. Keep those references within the supplied public asset bundle. No asset alias registry, species-specific route or filesystem URL is needed.

Nodevision bundles `/lib/three/examples/jsm/loaders/GLTFLoader.js`; existing consumers include `ViewGLTF.mjs` and the GameView player avatar. It supports glTF JSON (`.gltf`) with associated buffers/images and binary glTF (`.glb`), including model-contained animation data. M0 does not wire a built-in model into a viewer or play its animations. The ordinary file viewer defaults to Notebook-relative URLs; this folder setup does not change its UI or that default.

An FBX may be retained as source material, but no FBXLoader is bundled in the current Three.js loader directory: storing `.fbx` is not a claim that the current runtime loads it. Standalone animation formats are likewise not newly supported. Compressed glTF extensions may require decoder resources/configuration not established in M0. Verify the actual downloaded asset's dependencies and loader compatibility before M1.

## Root resolution, serving and packaging

No application code, static mount or package manifest changes are necessary. Development startup sets NODEVISION_ROOT from the start script's location. `ApplicationSystem/shared/serverContext.mjs` derives publicDir from the application-system root; callers can supply an explicit absolute root. Existing fallback behavior uses `~/Nodevision`, or the executable directory for pkg builds. None of these asset URLs depends on the shell's working directory. Do not pass a relative NODEVISION_ROOT when launching from another directory.

The root `package.json` pkg assets already includes `ApplicationSystem/public/**/*`. A distribution must actually ship the public tree with these resources. Existing server context in pkg mode expects an ApplicationSystem/public tree alongside the executable by default; inclusion in pkg assets alone does not demonstrate that the server resolves the embedded snapshot. Preserve the existing external-tree deployment convention or provide the established publicDir override. Installer/release or native desktop builds with an installed model were not executed in M0. To work offline, include the model and all relative dependencies locally; remote glTF resource URIs still require a network and should be reviewed when the asset arrives.

Express's existing static middleware confines lexical URL traversal to its configured public root and denies dotfiles by default. It does not expose arbitrary absolute filesystem paths or list directories. It is the same public root used for scripts, textures and models, not a private species sandbox. Keep installed content as real files/directories: Express static follows filesystem symlinks, so do not install links pointing outside the public tree. M0 introduces no new filesystem access surface. Resources placed here are public application assets and do not use Notebook authentication.

## Future species and custom content

Add a species directory to the corresponding category when real resources arrive; retain their license, filenames and dependent layout. The intended Mount Pelion roster is:

| Category | Planned species |
|---|---|
| Mammals | Brown Hare, Red Fox |
| Amphibians | Fire Salamander, Agile Frog |
| Reptiles | Hermann's Tortoise, Balkan Green Lizard |
| Fish | European Sea Bass, Annular Seabream |
| Insects | Swallowtail Butterfly, European Praying Mantis |
| Birds | Eurasian Jay, Common Buzzard |

Only BrownHare is prepared at species level. User-created mobs should remain in the user's Notebook resources and use existing Notebook-relative Resource Paths/file management where appropriate (`ApplicationSystem/docs/resource-paths.md`). They must not be mixed into shipped BuiltIn content. A dedicated custom-mob resource key, schema and discovery policy are deferred to M1.

## Verification and remaining setup

M0 verification checks the directory markers are not Git-ignored, existing static middleware serves ordinary resources and model-relative fixture dependencies, traversal cannot retrieve a file outside the public root, and root resolution works from a different working directory. Fixture resources are temporary and are not installed as models. Verification on 2026-11-15 passed: existing public README/Three.js loader serving, temporary glTF relative buffer/image URL serving, raw and encoded traversal rejection, dotfile rejection, and alternate-working-directory context resolution. Both existing test files passed: `node --test ApplicationSystem/ResourcePaths/Tests/ResourcePaths.test.mjs ApplicationSystem/server/routes/resourcePathRoutes.test.mjs`. `git diff --check` passed. Notebook/test.html retained SHA-256 `75533dd604cbacc1de34bd42e1e3c5a5faeef5f4779b51c520a2e0c0edd81292`. The HTTP checks used the same Express static middleware as production, not a full application startup or actual model-load test. Files are ready for version control; no commit or index staging is performed.

Before M1, manually install the actual download, retain and inspect its license, verify its model/dependencies and animation clip names in the existing loader, and include it in the intended distribution. M1 can then define mob metadata, rendering/animation integration, physics, lifecycle, placement and species behaviors. None of those systems is scaffolded in M0.
