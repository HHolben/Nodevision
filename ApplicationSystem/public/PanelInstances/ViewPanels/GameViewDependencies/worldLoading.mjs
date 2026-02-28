// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs
// This file loads a world definition from the server and builds its scene objects.

function normalizeWorldPath(filePath) {
  if (!filePath) return "";
  const normalized = filePath.replace(/\\/g, "/");
  const notebookMarker = "/Notebook/";
  const idx = normalized.indexOf(notebookMarker);
  if (idx !== -1) return normalized.slice(idx + notebookMarker.length);
  const withoutLeading = normalized.replace(/^\/+/, "");
  if (withoutLeading.startsWith("./")) {
    return withoutLeading.slice(2);
  }
  if (withoutLeading.startsWith("Notebook/")) {
    return withoutLeading.slice("Notebook/".length);
  }
  return withoutLeading;
}

export async function loadWorldFromFile(filePath, state, THREE, options = {}) {
  console.log("Loading world:", filePath);

  try {
    if (!filePath) return;
    state.currentWorldPath = filePath;
    if (window.VRWorldContext) {
      window.VRWorldContext.currentWorldPath = filePath;
    }
    if (!window.VRWorldContext) {
      state.pendingWorldPath = filePath;
      state.pendingWorldOptions = options;
      return;
    }

    const worldPath = normalizeWorldPath(filePath);
    const res = await fetch("/api/load-world", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worldPath })
    });

    if (!res.ok) {
      let errorMessage = res.statusText;
      try {
        const payload = await res.json();
        if (payload?.error) errorMessage = payload.error;
        if (payload?.details) errorMessage = `${errorMessage} (${payload.details})`;
      } catch (_) {
        // ignore parse errors
      }
      console.warn("World load failed:", res.status, errorMessage);
      return;
    }

    const data = await res.json();
    const worldData = data?.worldDefinition || null;
    let objectDefs = worldData?.objects || null;
    if (!objectDefs) {
      console.warn("World has no objects.");
      return;
    }

    const { scene, objects, colliders, lights, portals, collisionActions, useTargets, spawnPoints, waterVolumes, measurementVisuals, controls, movementState } = window.VRWorldContext;
    if (state) {
      state.currentWorldDefinition = worldData ? JSON.parse(JSON.stringify(worldData)) : null;
    }
    if (window.VRWorldContext) {
      window.VRWorldContext.currentWorldDefinition = worldData ? JSON.parse(JSON.stringify(worldData)) : null;
    }
    const modeHint = String(
      worldData?.worldMode
      || worldData?.mode
      || worldData?.metadata?.worldMode
      || worldData?.usd?.metadata?.worldMode
      || "3d"
    ).toLowerCase();
    if (movementState) {
      movementState.worldMode = modeHint === "2d" ? "2d" : "3d";
      movementState.requestCycleCamera = false;

      const rawRules = worldData?.playerRules
        || worldData?.metadata?.playerRules
        || worldData?.metadata?.capabilities
        || worldData?.usd?.metadata?.playerRules
        || worldData?.usd?.metadata?.capabilities
        || {};
      const readRule = (name, fallback = false) => {
        const value = rawRules?.[name];
        return typeof value === "boolean" ? value : fallback;
      };
      movementState.worldRules = {
        allowFly: readRule("allowFly", false),
        allowRoll: readRule("allowRoll", false),
        allowPitch: readRule("allowPitch", false),
        allowPlace: readRule("allowPlace", false),
        allowBreak: readRule("allowBreak", false),
        allowInspect: readRule("allowInspect", false),
        allowToolUse: readRule("allowToolUse", false),
        allowSave: readRule("allowSave", false)
      };

      const envDef =
        worldData?.metadata?.environment
        || worldData?.environment
        || window.VRWorldContext?.environment
        || null;
      window.VRWorldContext?.consolePanels?.applyEnvironmentDefinition?.(envDef);
    }
    objects.forEach(obj => scene.remove(obj));
    objects.length = 0;
    colliders.length = 0;
    if (portals) portals.length = 0;
    if (collisionActions) collisionActions.length = 0;
    if (useTargets) useTargets.length = 0;
    if (spawnPoints) spawnPoints.length = 0;
    if (waterVolumes) waterVolumes.length = 0;
    if (Array.isArray(measurementVisuals) && measurementVisuals.length > 0) {
      measurementVisuals.forEach((entry) => {
        if (entry?.parent) entry.parent.remove(entry);
        if (entry?.geometry?.dispose) entry.geometry.dispose();
        if (entry?.material?.dispose) entry.material.dispose();
        if (entry?.material?.map?.dispose) entry.material.map.dispose();
      });
      measurementVisuals.length = 0;
    }
    if (movementState) {
      movementState.tapeMeasureFirstPoint = null;
      movementState.tapeMeasureSecondPoint = null;
      movementState.tapeMeasureFirstMarker = null;
      movementState.tapeMeasureSecondMarker = null;
      movementState.tapeMeasureLine = null;
      movementState.tapeMeasureLabel = null;
      movementState.tapeToolLatch = false;
    }
    if (lights) {
      lights.forEach(light => scene.remove(light));
      lights.length = 0;
    }

    const isSameWorldTarget = (value) => {
      if (typeof value !== "string") return false;
      const normalized = value.trim().toLowerCase();
      return normalized === "self" || normalized === "." || normalized === "same" || normalized === "current";
    };

    const readTypedValue = (entry) => {
      if (!entry) return entry;
      if (typeof entry === "object" && "value" in entry) return entry.value;
      return entry;
    };

    const parseMaybeJson = (value) => {
      if (typeof value !== "string") return value;
      try {
        return JSON.parse(value);
      } catch (_) {
        return value;
      }
    };

    const color3fToHex = (value) => {
      if (!Array.isArray(value) || value.length < 3) return null;
      const clamp = (num) => Math.max(0, Math.min(255, Math.round(num * 255)));
      const [r, g, b] = value;
      const toHex = (num) => clamp(num).toString(16).padStart(2, "0");
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };

    const normalizeUsdObjects = (primDefs) => {
      return primDefs.map((prim) => {
        if (!prim || typeof prim !== "object") return null;
        const attrs = prim.attributes || {};
        const custom = prim.customAttributes || prim.custom || {};
        const typeName = prim.typeName || prim.type || "";

        const readAttr = (name) => readTypedValue(attrs[name]);
        const readCustom = (name) => readTypedValue(custom[name]);

        const translate = readAttr("xformOp:translate") || readCustom("nv:position") || [0, 0, 0];
        const scale = readAttr("xformOp:scale");

        const displayColor = readAttr("primvars:displayColor");
        let colorValue = null;
        if (Array.isArray(displayColor)) {
          colorValue = Array.isArray(displayColor[0]) ? displayColor[0] : displayColor;
        }
        const colorHex = color3fToHex(colorValue) || readCustom("nv:color") || readCustom("nv:colorHex") || null;

        const nvType = readCustom("nv:type") || readCustom("nv:kind");
        const isPortal = readCustom("nv:isPortal") === true || nvType === "portal";
        const isLight = /light/i.test(typeName) || nvType === "light";

        const def = {
          position: Array.isArray(translate) ? translate : [0, 0, 0]
        };

        if (colorHex) def.color = colorHex;

        if (isLight) {
          def.type = "light";
          const lightTypeName = (typeName || readCustom("nv:lightType") || "point").toLowerCase();
          if (lightTypeName.includes("distant")) def.lightType = "directional";
          else if (lightTypeName.includes("dome")) def.lightType = "ambient";
          else if (lightTypeName.includes("disk")) def.lightType = "spot";
          else def.lightType = "point";
          const intensity = readAttr("intensity") ?? readCustom("nv:intensity");
          if (Number.isFinite(intensity)) def.intensity = intensity;
          const distance = readCustom("nv:distance");
          if (Number.isFinite(distance)) def.distance = distance;
          const decay = readCustom("nv:decay");
          if (Number.isFinite(decay)) def.decay = decay;
          const angle = readCustom("nv:angle");
          if (Number.isFinite(angle)) def.angle = angle;
          const penumbra = readCustom("nv:penumbra");
          if (Number.isFinite(penumbra)) def.penumbra = penumbra;
          const target = readCustom("nv:target");
          if (Array.isArray(target)) def.target = target;
          return def;
        }

        if (isPortal) {
          def.type = "portal";
          const shape = readCustom("nv:shape");
          if (shape) def.shape = shape;
          const size = readCustom("nv:size") || scale;
          if (Array.isArray(size)) def.size = size;
          const targetWorld = readCustom("nv:targetWorld");
          if (targetWorld) def.targetWorld = targetWorld;
          if (readCustom("nv:sameWorld") === true) def.sameWorld = true;
          const spawn = readCustom("nv:spawn");
          if (Array.isArray(spawn)) def.spawn = spawn;
          const spawnPoint = readCustom("nv:spawnPoint");
          if (spawnPoint) def.spawnPoint = spawnPoint;
          const spawnYaw = readCustom("nv:spawnYaw");
          if (Number.isFinite(spawnYaw)) def.spawnYaw = spawnYaw;
          const cooldownMs = readCustom("nv:cooldownMs");
          if (Number.isFinite(cooldownMs)) def.cooldownMs = cooldownMs;
          const opacity = readCustom("nv:opacity");
          if (Number.isFinite(opacity)) def.opacity = opacity;
          const emissive = readCustom("nv:emissive");
          if (emissive !== undefined) def.emissive = emissive;
          const emissiveIntensity = readCustom("nv:emissiveIntensity");
          if (Number.isFinite(emissiveIntensity)) def.emissiveIntensity = emissiveIntensity;
          const isSolid = readCustom("nv:isSolid");
          if (isSolid !== undefined) def.isSolid = isSolid;
          const tag = readCustom("nv:tag");
          if (tag) def.tag = tag;
          return def;
        }

        if (typeName === "Cube") {
          def.type = "box";
          def.size = Array.isArray(scale) ? scale : [1, 1, 1];
        } else if (typeName === "Sphere") {
          def.type = "sphere";
          const radius = readAttr("radius") ?? readCustom("nv:radius");
          def.size = [Number.isFinite(radius) ? radius : 0.5];
        } else if (typeName === "Cylinder") {
          def.type = "cylinder";
          const radius = readAttr("radius") ?? readCustom("nv:radius");
          const height = readAttr("height") ?? readCustom("nv:height");
          def.size = [
            Number.isFinite(radius) ? radius : 0.5,
            Number.isFinite(height) ? height : 1
          ];
        } else if (typeName === "Mesh") {
          const shape = readCustom("nv:shape");
          if (shape) {
            def.type = shape === "torus" ? "torus" : shape;
          } else {
            def.type = "box";
          }
          const size = readCustom("nv:size") || scale;
          if (Array.isArray(size)) def.size = size;
        } else if (nvType) {
          def.type = nvType;
          const size = readCustom("nv:size") || scale;
          if (Array.isArray(size)) def.size = size;
        } else {
          return null;
        }

        const isSolid = readCustom("nv:isSolid");
        if (isSolid !== undefined) def.isSolid = isSolid;
        const isWater = readCustom("nv:isWater");
        if (isWater !== undefined) def.isWater = isWater;
        const waterBuoyancyScale = readCustom("nv:waterBuoyancyScale");
        if (Number.isFinite(waterBuoyancyScale)) def.waterBuoyancyScale = waterBuoyancyScale;
        const tag = readCustom("nv:tag");
        if (tag) def.tag = tag;
        const spawnId = readCustom("nv:spawnId");
        if (spawnId) def.spawnId = spawnId;
        const spawnYaw = readCustom("nv:spawnYaw");
        if (Number.isFinite(spawnYaw)) def.spawnYaw = spawnYaw;
        const useRange = readCustom("nv:useRange");
        if (Number.isFinite(useRange)) def.useRange = useRange;
        const useAction = parseMaybeJson(readCustom("nv:useAction"));
        if (useAction) def.useAction = useAction;
        const collisionAction = parseMaybeJson(readCustom("nv:collisionAction"));
        if (collisionAction) def.collisionAction = collisionAction;

        return def;
      }).filter(Boolean);
    };

    const isUsdLike = Array.isArray(objectDefs)
      && (worldData?.usd?.metadata || objectDefs.some(def => def?.typeName || def?.path || def?.primPath));
    if (isUsdLike) {
      objectDefs = normalizeUsdObjects(objectDefs);
    }

    const normalizeAction = (action, fallbackTarget, fallbackSameWorld) => {
      if (!action) return null;
      if (typeof action === "string") return { type: action };
      if (typeof action === "object") {
        const normalized = { ...action };
        if (normalized.type === "portal") {
          const sameWorld = normalized.sameWorld === true || isSameWorldTarget(normalized.targetWorld) || fallbackSameWorld === true;
          if (!normalized.targetWorld && fallbackTarget && !sameWorld) {
            normalized.targetWorld = fallbackTarget;
          }
          if (sameWorld) {
            normalized.sameWorld = true;
            if (isSameWorldTarget(normalized.targetWorld)) {
              normalized.targetWorld = null;
            }
          }
        }
        return normalized;
      }
      return null;
    };

    const evaluateFunctionY = (equation, x) => {
      try {
        const fn = new Function("x", "Math", `"use strict"; return (${equation});`);
        const y = fn(x, Math);
        if (!Number.isFinite(y)) return null;
        return Math.max(-100, Math.min(100, y));
      } catch (_) {
        return Math.sin(x);
      }
    };

    const createMathFunctionMesh = (def) => {
      const equation = typeof def.equation === "string" && def.equation ? def.equation : "Math.sin(x)";
      const limits = Array.isArray(def.limits) && def.limits.length >= 2 ? def.limits : [-8, 8];
      const xMin = Number.isFinite(limits[0]) ? limits[0] : -8;
      const xMax = Number.isFinite(limits[1]) ? limits[1] : 8;
      const resolution = Number.isFinite(def.resolution) ? Math.max(16, Math.min(192, Math.floor(def.resolution))) : 96;
      const points = [];
      for (let i = 0; i <= resolution; i += 1) {
        const t = i / resolution;
        const x = xMin + (xMax - xMin) * t;
        const y = evaluateFunctionY(equation, x);
        if (!Number.isFinite(y)) continue;
        points.push(new THREE.Vector3(x, y, 0));
      }
      if (points.length < 2) return null;
      const curve = new THREE.CatmullRomCurve3(points);
      const geometry = new THREE.TubeGeometry(curve, Math.max(16, resolution), 0.035, 8, false);
      const material = new THREE.MeshStandardMaterial({
        color: def.color || "#44bbff",
        emissive: def.color || "#44bbff",
        emissiveIntensity: 0.22
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.mathFunctionProperties = {
        equation,
        resolution,
        limits: [xMin, xMax],
        collider: def.collider !== false,
        color: def.color || "#44bbff"
      };
      return mesh;
    };

    const spawnCandidates = [];
    const recordSpawnPoint = (def) => {
      if (!Array.isArray(def?.position) || def.position.length < 3) return;
      const id = typeof def.spawnId === "string"
        ? def.spawnId
        : typeof def.id === "string"
          ? def.id
          : typeof def.name === "string"
            ? def.name
            : typeof def.label === "string"
              ? def.label
              : null;
      const yaw = Number.isFinite(def.spawnYaw) ? def.spawnYaw : (Number.isFinite(def.yaw) ? def.yaw : null);
      spawnCandidates.push({
        id,
        position: [def.position[0], def.position[1], def.position[2]],
        yaw
      });
    };

    for (const def of objectDefs) {
      let mesh = null;
      let light = null;
      const isPortal = def.type === "portal" || def.isPortal === true;
      const portalTarget = def.targetWorld || def.target || def.href || def.world;
      const sameWorld = def.sameWorld === true || isSameWorldTarget(portalTarget);
      const resolvedPortalTarget = isSameWorldTarget(portalTarget) ? null : portalTarget;
      const portalSpawnPoint = def.spawnPoint ?? def.spawnId ?? null;
      const isSpawnPoint = def.type === "spawn" || def.tag === "spawn" || def.isSpawn === true;
      if (isSpawnPoint) {
        recordSpawnPoint(def);
      }
      const rawActions = def.collisionAction ?? def.onCollide;
      const actionList = Array.isArray(rawActions) ? rawActions : (rawActions ? [rawActions] : []);
      if (isPortal && actionList.length === 0) {
        actionList.push({
          type: "portal",
          targetWorld: resolvedPortalTarget,
          sameWorld,
          spawn: def.spawn,
          spawnYaw: def.spawnYaw,
          spawnPoint: portalSpawnPoint
        });
      }
      const portalShape = (def.shape || def.geometry || (def.type === "portal" ? "box" : def.type) || "").toLowerCase();
      if (!Array.isArray(def.size) || def.size.length === 0) {
        if (portalShape === "box") def.size = [1, 1, 1];
        else if (portalShape === "sphere") def.size = [0.5];
        else if (portalShape === "cylinder") def.size = [0.5, 1];
        else if (portalShape === "torus") def.size = [1, 0.25];
      }
      const materialOpts = {
        color: def.color || "#888"
      };
      if (def.isWater === true) {
        materialOpts.transparent = true;
        materialOpts.opacity = Number.isFinite(def.opacity) ? def.opacity : 0.45;
        materialOpts.emissive = def.emissive || "#0a4b7a";
        materialOpts.emissiveIntensity = Number.isFinite(def.emissiveIntensity) ? def.emissiveIntensity : 0.2;
        materialOpts.side = THREE.DoubleSide;
      }
      if (isPortal) {
        materialOpts.transparent = true;
        materialOpts.opacity = Number.isFinite(def.opacity) ? def.opacity : 0.65;
        materialOpts.emissive = def.emissive === true ? (def.color || "#55ccff") : (def.emissive || "#55ccff");
        materialOpts.emissiveIntensity = Number.isFinite(def.emissiveIntensity) ? def.emissiveIntensity : 0.9;
      }
      if (def.emissive && !isPortal) {
        materialOpts.emissive = def.emissive === true ? def.color || "#888" : def.emissive;
        materialOpts.emissiveIntensity = Number.isFinite(def.emissiveIntensity) ? def.emissiveIntensity : 0.75;
      }
      if (def.type === "math-function") {
        mesh = createMathFunctionMesh(def);
      } else if (def.type === "console") {
        const size = Array.isArray(def.size) && def.size.length >= 3 ? def.size : [0.9, 1.15, 0.7];
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(size[0], size[1], size[2]),
          new THREE.MeshStandardMaterial(materialOpts)
        );
        mesh.userData.consoleProperties = {
          collider: def.collider !== false,
          color: def.color || "#33ccaa",
          objectFile: typeof def.objectFile === "string" ? def.objectFile : "",
          linkedObject: typeof def.linkedObject === "string" ? def.linkedObject : ""
        };
      } else if (def.type === "object-file") {
        const size = Array.isArray(def.size) && def.size.length >= 3 ? def.size : [1, 1, 1];
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(size[0], size[1], size[2]),
          new THREE.MeshStandardMaterial(materialOpts)
        );
        if (typeof def.objectFile === "string" && def.objectFile) {
          mesh.userData.objectFilePath = def.objectFile;
        }
      } else if (portalShape === "box") {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(...def.size),
          new THREE.MeshStandardMaterial(materialOpts)
        );
      } else if (portalShape === "sphere") {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(def.size[0], 32, 32),
          new THREE.MeshStandardMaterial(materialOpts)
        );
      } else if (portalShape === "cylinder") {
        const radius = def.size[0];
        const height = def.size[1];
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(radius, radius, height, 24),
          new THREE.MeshStandardMaterial(materialOpts)
        );
      } else if (portalShape === "torus") {
        const radius = def.size[0];
        const tube = def.size[1];
        mesh = new THREE.Mesh(
          new THREE.TorusGeometry(radius, tube, 16, 64),
          new THREE.MeshStandardMaterial(materialOpts)
        );
      } else if (def.type === "light") {
        const lightType = (def.lightType || "point").toLowerCase();
        const color = def.color || "#ffffff";
        const intensity = Number.isFinite(def.intensity) ? def.intensity : 1;
        if (lightType === "ambient") {
          light = new THREE.AmbientLight(color, intensity);
        } else if (lightType === "directional") {
          light = new THREE.DirectionalLight(color, intensity);
        } else if (lightType === "spot") {
          const distance = Number.isFinite(def.distance) ? def.distance : 0;
          const angle = Number.isFinite(def.angle) ? def.angle : Math.PI / 6;
          const penumbra = Number.isFinite(def.penumbra) ? def.penumbra : 0;
          const decay = Number.isFinite(def.decay) ? def.decay : 1;
          light = new THREE.SpotLight(color, intensity, distance, angle, penumbra, decay);
        } else if (lightType === "hemisphere") {
          const groundColor = def.groundColor || "#111111";
          light = new THREE.HemisphereLight(color, groundColor, intensity);
        } else {
          const distance = Number.isFinite(def.distance) ? def.distance : 0;
          const decay = Number.isFinite(def.decay) ? def.decay : 1;
          light = new THREE.PointLight(color, intensity, distance, decay);
        }
      }

      if (mesh) {
        mesh.position.set(...def.position);
        mesh.userData.nvType = def.type || portalShape || null;
        if (typeof def.tag === "string" && def.tag) mesh.userData.tag = def.tag;
        if (typeof def.spawnId === "string" && def.spawnId) mesh.userData.spawnId = def.spawnId;
        if (Number.isFinite(def.spawnYaw)) mesh.userData.spawnYaw = def.spawnYaw;
        mesh.userData.breakable = def.breakable !== false && !isPortal && !isSpawnPoint && def.isWater !== true;
        mesh.userData.isWater = def.isWater === true;
        scene.add(mesh);
        objects.push(mesh);
        if (isPortal) {
          mesh.userData.isPortal = true;
          mesh.userData.portalTarget = resolvedPortalTarget;
          mesh.userData.portalSameWorld = sameWorld;
          mesh.userData.portalSpawn = Array.isArray(def.spawn) ? [...def.spawn] : null;
          mesh.userData.portalSpawnPoint = typeof portalSpawnPoint === "string" ? portalSpawnPoint : null;
          mesh.userData.portalSpawnYaw = Number.isFinite(def.spawnYaw) ? def.spawnYaw : null;
          mesh.userData.portalCooldownMs = Number.isFinite(def.cooldownMs) ? def.cooldownMs : 1200;
          if ((resolvedPortalTarget || sameWorld) && portals) {
            const box = new THREE.Box3().setFromObject(mesh);
            portals.push({
              box,
              targetWorld: resolvedPortalTarget,
              sameWorld,
              spawn: Array.isArray(def.spawn) ? def.spawn : null,
              spawnYaw: Number.isFinite(def.spawnYaw) ? def.spawnYaw : null,
              spawnPoint: typeof portalSpawnPoint === "string" ? portalSpawnPoint : null,
              cooldownMs: Number.isFinite(def.cooldownMs) ? def.cooldownMs : 1200,
              lastTriggeredAt: 0
            });
          } else {
            console.warn("Portal missing targetWorld:", def);
          }
        }
        if (actionList.length > 0 && collisionActions) {
          const box = new THREE.Box3().setFromObject(mesh);
          const actions = actionList
            .map(action => normalizeAction(action, resolvedPortalTarget, sameWorld))
            .filter(Boolean);
          if (actions.length > 0) {
            const collisionRef = {
              box,
              actions,
              cooldownMs: Number.isFinite(def.cooldownMs) ? def.cooldownMs : 1200,
              lastTriggeredAt: 0
            };
            collisionActions.push(collisionRef);
            mesh.userData.collisionActionRef = collisionRef;
          }
        }
        if (useTargets) {
          const rawUseActions = def.useAction ?? def.onUse;
          const useList = Array.isArray(rawUseActions) ? rawUseActions : (rawUseActions ? [rawUseActions] : []);
          if (useList.length > 0) {
            const actions = useList
              .map(action => normalizeAction(action, resolvedPortalTarget, sameWorld))
              .filter(Boolean);
            if (actions.length > 0) {
              const useRef = {
                position: mesh.position.clone(),
                range: Number.isFinite(def.useRange) ? def.useRange : 2,
                actions,
                cooldownMs: Number.isFinite(def.useCooldownMs) ? def.useCooldownMs : 600,
                lastTriggeredAt: 0
              };
              useTargets.push(useRef);
              mesh.userData.useTargetRef = useRef;
            }
          }
        }

        if (def.isWater === true && waterVolumes) {
          const box = new THREE.Box3().setFromObject(mesh);
          waterVolumes.push({
            box,
            buoyancyScale: Number.isFinite(def.waterBuoyancyScale) ? def.waterBuoyancyScale : 1
          });
        }

        if (def.isSolid && def.isWater !== true) {
          if (portalShape === "box") {
            const [sx, sy, sz] = def.size;
            const halfSize = new THREE.Vector3(sx / 2, sy / 2, sz / 2);
            const center = new THREE.Vector3(...def.position);
            const box = new THREE.Box3(center.clone().sub(halfSize), center.clone().add(halfSize));
            const colliderRef = { type: "box", box };
            colliders.push(colliderRef);
            mesh.userData.colliderRef = colliderRef;
          } else if (portalShape === "sphere") {
            const center = new THREE.Vector3(...def.position);
            const radius = def.size[0];
            const colliderRef = { type: "sphere", center, radius };
            colliders.push(colliderRef);
            mesh.userData.colliderRef = colliderRef;
          } else if (def.type === "console" || def.type === "object-file") {
            const colliderRef = { type: "box", box: new THREE.Box3().setFromObject(mesh) };
            colliders.push(colliderRef);
            mesh.userData.colliderRef = colliderRef;
          } else if (def.type === "math-function" && def.collider !== false) {
            const sphere = new THREE.Sphere();
            new THREE.Box3().setFromObject(mesh).getBoundingSphere(sphere);
            const colliderRef = { type: "sphere", center: sphere.center.clone(), radius: sphere.radius };
            colliders.push(colliderRef);
            mesh.userData.colliderRef = colliderRef;
          }
        }
      }

      if (light) {
        if (Array.isArray(def.position)) {
          light.position.set(...def.position);
        }
        if (Array.isArray(def.target) && light.target) {
          light.target.position.set(...def.target);
          scene.add(light.target);
        }
        scene.add(light);
        if (lights) lights.push(light);
      }
    }

    if (spawnPoints) {
      spawnPoints.push(...spawnCandidates);
    }

    const shouldAutoSpawn = options?.skipAutoSpawn !== true;
    if (shouldAutoSpawn && controls) {
      const availableSpawns = spawnPoints && spawnPoints.length > 0 ? spawnPoints : spawnCandidates;
      const spawnPointId = typeof options?.spawnPoint === "string" ? options.spawnPoint.trim() : null;
      let chosen = null;
      if (availableSpawns.length > 0) {
        if (spawnPointId) {
          chosen = availableSpawns.find(point => point?.id === spawnPointId) || null;
        }
        if (!chosen) {
          const idx = Math.floor(Math.random() * availableSpawns.length);
          chosen = availableSpawns[idx] || null;
        }
      }
      const position = Array.isArray(chosen?.position) && chosen.position.length >= 3
        ? chosen.position
        : [0, 0, 0];
      controls.getObject().position.set(position[0], position[1], position[2]);
      if (movementState?.worldMode === "2d") {
        movementState.planeZ = Number.isFinite(position[2]) ? position[2] : 0;
        controls.getObject().position.z = movementState.planeZ;
      }
      if (movementState) {
        movementState.velocityY = 0;
        movementState.isGrounded = true;
      }
      const yaw = Number.isFinite(options?.spawnYaw)
        ? options.spawnYaw
        : Number.isFinite(chosen?.yaw)
          ? chosen.yaw
          : null;
      if (Number.isFinite(yaw)) {
        controls.getObject().rotation.y = yaw;
      }
    }
  } catch (err) {
    console.error("Failed to load world:", err);
  }
}
