<!-- Nodevision/docs/procedural-weather-clouds.md -->
<!-- This report documents atmosphere capability metadata, independently owned procedural clouds, shared lifecycle integration and validation. -->

# Procedural weather clouds

## Atmosphere, astronomy and lighting reconnaissance

Normal Virtual World stores its active atmosphere as `environment.gasMaterialId` and `gasMaterialFile`. These resolve to canonical gas definitions under `MetaWorld/Materials/Gasses/`. Existing gases include Earth Troposphere, White Oxygenated Air, hydrogen, helium and vacuum. There was no weather-capability metadata before this change.

The normal sky is a background color or image, not an astronomical sky model. An optional environment brightness cycle modulates lights/background. Searches of shared MetaWorld/Game View code found no dedicated Sun, Moon, star, celestial or astronomical-body declaration system. Ordinary declared lights remain independent world objects.

Atmosphere selection did not directly create lighting. However, `sceneBase.mjs` unconditionally created a directional light, making nominally unlit worlds appear illuminated. That fallback has been removed. Normal Game View now relies on declared lights. No Sun, Moon, stars, orbital model, day/night inference or new light has been introduced by weather.

The separate museum presentation renderer, `MetaWorldScene.mjs`, still creates hemisphere/directional presentation lights. Inspector previews also have their own presentation lighting. Those legacy defaults were not expanded or repurposed for weather. The museum renderer uses a separate loop and is not integrated with this first shared Game View weather adapter. Its lighting and optional brightness-cycle terminology remain future separation work; this change does not implement astronomical bodies.

## Atmosphere capability

`EarthTroposphere.json` now declares:

```json
"atmosphere": {
  "supportsWeather": true,
  "weatherProfile": "earth-like"
}
```

The material must also declare gas matter state. `AtmosphereWeather.mjs` reads the actual selected material definition, including a custom material file. It does not infer capability from ID, filename, color, light count, world name or the presence of a star. Other existing gases, including default White Oxygenated Air, remain unsupported unless explicitly given capability metadata. Future profiles can select other weather implementations without implying Earth astronomy.

## Declarative configuration and persistence

A world can opt into the existing Earth atmosphere and configure clouds using the existing extensible metadata schema:

```json
{
  "environment": {
    "gasMaterialId": "EarthTroposphere",
    "gasMaterialFile": "/MetaWorld/Materials/Gasses/EarthTroposphere.json"
  },
  "metadata": {
    "weather": {
      "enabled": true,
      "seed": 773,
      "cloudCoverage": 0.55,
      "cloudBaseAltitude": 80,
      "cloudTopAltitude": 115,
      "wind": [2, 0.5]
    }
  }
}
```

This is a fragment to merge into an existing world definition. Altitudes are world Y in metres. Wind is world X/Z velocity in metres per simulation second. Coverage is clamped to 0–1. Supported atmospheres use these cloud defaults when weather configuration is absent; `enabled: false` or zero coverage disables clouds. Changing the atmosphere through existing environment controls is detected by the runtime.

`metadata.weather` survives the existing world validator, document conversion and save path. Generated regions, meshes, instances, simulation clock state and materials are never added to the ordinary world objects array. Only the authored declaration persists. No astronomical data is copied into weather. Both Sandbox modes consume the same declaration.

## Seed and state ownership

`WeatherState.mjs` normalizes seed, enabled state, coverage, altitude limits and wind. An explicit weather seed wins. Otherwise, the runtime derives a separate unsigned seed from the world seed (metadata seed when available, or the procedural terrain definition's seed). A world without a seed uses a deterministic zero-seed fallback. Coordinate hashing uses the existing stateless noise utility; there is no shared mutable RNG to advance or alter terrain generation.

Weather layout depends only on weather configuration, viewer region and simulation time. Adding or removing declared illumination or astronomical metadata does not change the weather reconciliation key or reseed clouds.

## Field, rendering and movement

`CloudField.mjs` uses a 320 m coherent noise field to accept cloud groups in 128 m regions. Each region has at most six groups, each represented by five overlapping ellipsoidal lobes. Shape variation uses coordinate-derived hashes. Clouds are not quarter-metre voxels and do not query mountain height. The default 80–115 m cloud layer can intersect the existing 100.25 m mountain fixture.

`CloudRenderer.mjs` uses one low-poly sphere geometry shared by instanced meshes. At most 49 regions and 1,470 lobe instances reside around the viewer. Each region has at most one draw, and empty/distant regions are hidden. Opacity fades to zero before regions reach the eviction boundary. Clouds drift by `wind * simulationTime`; streaming uses viewer coordinates relative to that moving field so existing regions remain stable.

Clouds use non-emissive `MeshStandardMaterial`, so only existing scene illumination lights them. In worlds without lights they may appear dark against the background. The renderer does not change lighting, fog, shadows or sky color. Cloud raycasts are disabled and no collider is created. Transparency is a lightweight approximation: overlapping lobes can show sorting artifacts, and clouds have neither volumetric scattering nor realistic internal attenuation.

## Shared lifecycle

`WeatherRuntime.mjs` owns cloud state/time and rendering resources. `WorldWeatherController.mjs` resolves atmosphere capability asynchronously, reconciles configuration changes, and guards stale requests during switches/disposal.

`GameViewDependencies/worldWeather.mjs` attaches the controller to the shared Game View context. `renderLoop.mjs` calls it with the active camera after normal updates and disposes it when the loop stops. It consumes the existing temporal controller, including time scaling/static time, and respects pause/inactive-world state. It creates no second animation loop. A gas switch to an unsupported atmosphere releases clouds; late material loads cannot recreate disposed weather.

The normal-world scene initializer no longer adds automatic directional illumination. Authored world lights remain untouched. Existing no-light worlds, including generated Sandbox worlds without declared lights, can consequently render darker.

## Validation

The focused weather suite has eight test cases covering semantic gas support, unsupported atmospheres, no-light initialization, adding/removing explicit lights and an independently owned custom-body placeholder, deterministic weather seed/shape/wind, unchanged terrain generation, mountain-layer overlap, bounded streaming, lit non-emissive materials, no colliders, pause, disposal, late async completion, and metadata persistence.

Command:

`node --loader ./scripts/html-test-loader.mjs --test ApplicationSystem/public/MetaWorld/Weather/*.test.mjs ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/*.test.mjs ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldPauseState.test.mjs`

All ten test files passed. Additional Electron checks passed:

- `weather-world-browser.mjs`: real normal Game View render loop, no implicit base/cloud light, coexistence with two declared lights, removing illumination, pause, atmosphere switching and teardown.
- `sandbox-session-browser.mjs` with `weather-session-browser.mjs`: actual Build/Play sessions, bounded clouds with no declared astronomical bodies or lights, rendering, paused weather time, declarative save/reload, exclusion from authored objects/colliders and exit cleanup.

Sandbox output includes existing optional-registry 404, ResizeObserver and automated pointer-lock warnings. Those did not fail the checks.

A local CPU-only full-coverage benchmark measured approximately 11.56 ms to create the initial 49 regions and 0.025 ms per stationary drift update over 1,000 updates. It retained one geometry, 1,470 instances and 19 visible region meshes at the sampled camera position. These measurements exclude GPU rendering and are not a frame-rate guarantee.

All 80 dirty native JavaScript modules passed the line/header audit at completion. The separately reported dirty Markdown file contained only ten content lines. No weather module approaches the 200-line limit.

## Remaining scope

There is no rain, snowfall, lightning, precipitation collision, weather-driven fog, physical wind force, season model or full meteorological simulation. Coverage is a declared continuous parameter rather than an evolving forecast. No astronomical-body API was added, and weather neither requires nor owns one. The next steps can add other atmosphere profiles and weather phenomena through the same controller while consuming only explicitly declared lighting sources.
