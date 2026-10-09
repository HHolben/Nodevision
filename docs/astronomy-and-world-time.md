<!-- Nodevision/docs/astronomy-and-world-time.md -->
<!-- This report describes explicit Earth-analogue astronomy, calendar ownership, offline catalog provenance, solar-event controls and validation. -->

# Astronomy and world time

## Reconnaissance and dependencies

The audit covered application/vendor filenames, native world/environment code, package.json, root and ApplicationSystem lockfiles, installed package names, KML modules, FAA sectional infrastructure and dependency locations. No usable astronomy engine or local star catalog was found. Existing KML/FAA code supplies terrestrial latitude/longitude and map coordinates, not equatorial/sidereal transformations. No celestial body implementation existed.

The Game View temporal controller already owns elapsed simulation seconds, pause, positive/negative time scale, static time and temporal equation sampling. Weather consumes that controller. The new calendar is an absolute UTC anchor over the same seconds; it does not add an animation timer.

The old `environment.dayNightCycle` samples an authored brightness curve and multiplies scene lights/background by that value. It is not astronomical day/night. In astronomy-enabled Game View, `worldAstronomy.mjs` delegates the public environment lighting update to astronomy for the runtime's lifetime, restores baseline light intensities, and restores the old update method on release. The authored legacy settings remain intact. Worlds without astronomy continue using the old behavior. Private environment-UI refreshes still belong to the legacy environment component; no new recurring brightness cycle was added.

Two compact offline application dependencies were necessary:

- **SunCalc 1.9.0**, Vladimir Agafonkin, BSD-2-Clause: https://github.com/mourner/suncalc/tree/v1.9.0 . Approximately 9 KB, unminified. Only its UMD export wrapper was changed to an ES module export; formulas are unchanged.
- **HYG 4.1**, David Nash / Astronexus, CC BY-SA 4.0: https://github.com/astronexus/HYG-Database/tree/main/hyg . The derived 214,248-byte JSON retains 5,070 entries with visual magnitude <= 6, excluding Sol. Fields are HYG ID, optional name, J2000 right ascension in hours, declination in degrees, magnitude and color index. The derived data retains CC BY-SA 4.0 licensing.

Both are under `ApplicationSystem/public/vendor/`, with license/provenance files and SHA-256 hashes in `vendor/astronomy-dependencies.json`. `scripts/build-bright-star-catalog.py` reproduces the subset from a supplied upstream CSV. No network astronomy/catalog fetch occurs at runtime; the browser loads its local application asset once. Native code remains separate from licensed third-party code/data. The native-file audit now excludes the third-party vendor tree in accordance with the standards' existing exemption.

## Configuration and default Sandbox

Newly generated Sandbox worlds explicitly declare EarthTroposphere plus astronomy. This is a planner choice, not an atmosphere capability. Existing authored/procedural worlds are reused without migration. To opt an existing world in, merge this fragment into its definition:

```json
{
  "environment": {
    "gasMaterialId": "EarthTroposphere",
    "gasMaterialFile": "/MetaWorld/Materials/Gasses/EarthTroposphere.json"
  },
  "metadata": {
    "astronomy": {
      "model": "earth",
      "clock": { "mode": "system-local", "timeScale": 1 },
      "observer": { "latitude": 40, "longitude": -90 },
      "bodies": [
        { "id": "sun", "type": "sun", "intensity": 2 },
        { "id": "moon", "type": "moon" }
      ],
      "stars": { "enabled": true }
    }
  }
}
```

Remove either body or set its `enabled` to false independently. Set `stars.enabled` false to omit the catalog/render batch. `astronomy.enabled: false` disables the whole astronomical runtime. Atmosphere/weather settings may be omitted entirely while retaining astronomy. Conversely, EarthTroposphere alone still creates none of these bodies or lights.

`MIDWEST_OBSERVER` centralizes 40° N, 90° W as a representative central Illinois/Midwestern reference. It is not the user's location. There is no geolocation request or timezone-to-longitude conversion. Both coordinates are independently configurable, including southern and polar observers.

## Clock, timezone, season and persistence

`WorldCalendar.mjs` initializes once, using `Date.now()` and the system's IANA timezone in system-local mode. An instant already represents absolute time; no extra timezone offset is applied. The timezone is retained for local display and date interpretation, separately from geographic coordinates. A declared timezone overrides the captured display timezone. The runtime exposes `clock.instant`, `clock.localDateTime`, `clock.timezone` and `season`.

The temporal controller advances the clock thereafter. Pausing, static time and time scale use its existing rules. Sleep advances temporal elapsed/static seconds through `applySettings`, so subsequent weather and other time-based systems consume the same jump. Sleep does not replay every skipped simulation frame. `clock.synchronize()` is available as a future explicit resynchronization hook; no new UI was added for it.

Initialization modes:

| Mode | Declaration | Fresh-session behavior | Save behavior |
| --- | --- | --- | --- |
| `system-local` | Default | Read host instant/timezone once; subsequent simulation is independent. | Keep authored configuration; do not persist current instant as a resume point. |
| `fixed` | `initialTime: "2026-10-07T18:00:00Z"` | Start from the declared instant each fresh launch, then progress normally. | Keep the fixed initial instant. |
| `saved` | `savedTime` or an initial `initialTime` | Resume the saved instant, then progress normally. | Update declarative `clock.savedTime` with the simulated UTC instant. |
| `random` | Reserved | Unsupported in this milestone; configuration does not activate astronomy. | No implicit fallback. |

Explicit fixed/saved instants require an ISO string with `Z` or an explicit UTC offset. Invalid clock/observer configurations do not install a runtime. `timeScale` initializes the canonical temporal controller (its existing bounds are -128 to 128); temporal controls remain authoritative during the session. A fixed initialization mode is distinct from the temporal controller's optional static-time setting.

Seasons use a reusable **meteorological** classifier: northern seasons follow three-month groups; the southern hemisphere shifts by two seasons. The calendar month uses the clock timezone. The equator follows the northern convention. No terrain, snow probability or foliage data is changed by season.

The existing metadata validator and world-save path preserve `metadata.astronomy`. Generated spheres, lights, star coordinates and buffers never enter the authored objects array. System-local Build and Play each start from the host instant on fresh launch; saved mode instead resumes the saved instant.

## Sun, Moon and illumination

`CelestialCoordinates.mjs` uses SunCalc positions from UTC instant plus observer latitude/longitude. World axes are +X east, +Y up, -Z north. The Sun's visual direction and its owned directional light use the same direction vector. Solar intensity varies smoothly near the horizon and reaches zero at night. No unconditional Game View light was restored.

`BodyRenderer.mjs` renders declared Sun and Moon spheres at an artificial 800 m sky distance, radius 3.5 m, approximately 0.5° apparent diameter. They follow the viewer to avoid translational parallax. They are non-solid and cannot be picked as ordinary objects. The rendering uses depth testing so terrain can occlude sky bodies. The Earth model supports multiple explicit Sun declarations, but they currently follow the same Earth solar ephemeris; it is not a binary-star orbital model.

Moon position comes from the independent lunar ephemeris, not a point opposite the Sun. A simple sphere shader uses deterministic illuminated fraction, phase angle and parallactic angle to approximate the terminator. There is no lunar surface texture. Camera-roll handling and lunar shading are approximations. The Moon emits no scene light by default; an explicit positive `intensity` opts into a Moon-owned directional light.

Day/dawn/dusk/night semantics use solar altitude, with civil twilight between -6° and the horizon and rising/falling direction determining dawn versus dusk. Background color blends from dark to blue around twilight. Stars fade from full visibility at -6° to zero at the horizon. If there is no declared Sun, stars do not infer daylight and the runtime does not change the background. Existing artificial lights remain independently owned.

## Stars and weather

`StarRenderer.mjs` creates one point batch from fixed J2000 equatorial vectors. A shared local sidereal/observer matrix rotates it each frame; no per-star CPU conversion or buffer reconstruction occurs at sunrise or sunset. Magnitude controls point size; color index supplies restrained color variation. Below-horizon stars are clipped. The batch follows the camera position in the shader so walking does not translate the celestial sphere.

The star model omits precession, nutation, aberration and proper motion. It is suitable for this initial sky presentation, not precision navigation or historical/far-future astrometry. SunCalc is an approximate compact ephemeris rather than a high-precision planetary integrator.

Weather retains its own seed, field and configuration. Astronomy never modifies cloud placement or terrain generation. Clouds render after distant sky content and can obscure it through their existing alpha geometry; realistic scattering and cloud shadows are not implemented. A clock jump moves the wind field when weather resumes because both consume the same simulation seconds, not because weather depends on celestial positions.

## Sleep controls

`worldSleepControls.mjs` provides one “Sleep Until” action beside a selector for Daybreak, Mid morning, Noon, Mid afternoon, Evening, Nightfall and Midnight. Available choices are sorted by their next occurrence relative to world time; the nearest upcoming choice is selected when the menu opens or sleep completes. It contains no solar formulas; it calls the runtime service. Controls are disabled without a supported declared Sun. Errors appear in a status region.

`SleepTargets.mjs` derives noon from solar transit, mid morning and mid afternoon from the midpoint between sunrise/noon and noon/sunset, evening from sunset, and midnight from solar noon plus twelve hours. Thus these are observer-relative solar phases, not fixed host-clock hours. Unavailable polar sunrise/sunset choices are omitted; solar noon and midnight remain available. Every choice advances strictly forward, including a choice whose event has already passed today.

`nextSolarEvent` scans forward in ten-minute brackets for at most three days, then bisects the next crossing. Daybreak uses rising solar center altitude -0.833° (standard apparent sunrise approximation); nightfall uses falling altitude -6° (end of civil twilight). These are deliberately different events, not fixed 06:00/18:00 times. Already-daytime/nighttime requests find the next future crossing. Polar no-crossing conditions return a bounded, understandable failure. The world stays paused after a sleep click; the sky refreshes to the selected instant, and Resume continues from it without host-time resynchronization.

## Modules and validation

New native modules are under `MetaWorld/Astronomy/`: configuration, calendar/season, celestial coordinates/events, body renderer, star renderer, runtime and tests. Shared Game View integration is in `worldAstronomy.mjs`, `worldSleepControls.mjs`, `renderLoop.mjs` and `worldPause.mjs`. `SandboxWorldPlanner.mjs` owns the explicit default declaration.

Ten focused astronomy tests cover configuration separation, default/custom observer, mocked host clock/timezone, pause/scaling, forward jumps, static/fixed/saved policies, hemisphere seasons, deterministic Sun/Moon positions, lunar phase bounds, real solar events/polar failure, catalog identity/known Sirius and Polaris coordinates, shared star transforms/buffer residency, solar light/visual agreement, night fading, no-Sun behavior, saved metadata validation/resume, restoration of legacy lighting ownership and resource disposal. The combined astronomy, weather, terrain, Sandbox planner and pause regression run passed all 12 files.

Browser validation passed:

- Actual Sandbox Build/Play with mocked host instant October 7, 2026 at 18:00 UTC and configured America/Chicago timezone: autumn, daylight Sun/light, resident hidden stars, pause-menu nightfall/daybreak, untouched host clock, continuing simulation, compact save/reload and teardown.
- Normal Game View with Earth atmosphere/weather but no astronomy: no implicit body/light, weather remains functional, atmosphere switching and cleanup.
- Real WebGL catalog fixture: one star draw call for 5,070 points, declared Sun and Moon rendering above their computed horizons, frame submission and released GPU geometry.

The Sandbox harness reports existing optional registry, ResizeObserver and automated pointer-lock warnings; these did not fail validation. All dirty native JavaScript files passed the 200-line/header audit. Third-party source is explicitly exempt, and retains its license.

## Performance and limitations

Measured local CPU timings are in `astronomy-performance.json`: catalog parse approximately 5.40 ms; initial runtime/geometry setup 79.22 ms (including first-use internationalization); paired Sun/Moon/state query 0.007 ms; shared star transform 0.0014 ms; averaged runtime update 0.0077 ms. Star attribute buffers total 141,960 bytes. The local WebGL fixture records actual loading/frame submission results in `astronomy-render-performance.json`; it measured 77.5 ms readiness and 0.113 ms average frame submission, with one star draw and three allocated geometries after both bodies had rendered. Submission cost is not GPU completion time or a frame-rate guarantee.

Ephemerides are evaluated at most once per simulated second; jumps invalidate the cached result immediately. Star matrices update each frame. This cadence means a very slow simulation has correspondingly infrequent ephemeris evaluation, while fast time scales still run no more than once per rendered frame.

Remaining limits include approximate ephemerides/lunar shading, no precession/proper motion, no arbitrary planetary systems, same-motion multiple Earth Suns, no atmospheric scattering and no astronomical behavior in the separate legacy museum presentation renderer. The old environment panel's legacy brightness settings remain stored for compatibility; it is not yet a full astronomy editor. The smallest useful next milestone is a compact observer/calendar properties panel, followed by higher-accuracy celestial transforms if precision use cases require them.
