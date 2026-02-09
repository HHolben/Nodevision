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

export async function loadWorldFromFile(filePath, state, THREE) {
  console.log("Loading world:", filePath);

  try {
    if (!filePath) return;
    if (!window.VRWorldContext) {
      state.pendingWorldPath = filePath;
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
    const objectDefs = worldData?.objects || null;
    if (!objectDefs) {
      console.warn("World has no objects.");
      return;
    }

    const { scene, objects, colliders, lights, portals, collisionActions } = window.VRWorldContext;
    objects.forEach(obj => scene.remove(obj));
    objects.length = 0;
    colliders.length = 0;
    if (portals) portals.length = 0;
    if (collisionActions) collisionActions.length = 0;
    if (lights) {
      lights.forEach(light => scene.remove(light));
      lights.length = 0;
    }

    const normalizeAction = (action, fallbackTarget) => {
      if (!action) return null;
      if (typeof action === "string") return { type: action };
      if (typeof action === "object") {
        const normalized = { ...action };
        if (normalized.type === "portal" && !normalized.targetWorld && fallbackTarget) {
          normalized.targetWorld = fallbackTarget;
        }
        return normalized;
      }
      return null;
    };

    for (const def of objectDefs) {
      let mesh = null;
      let light = null;
      const isPortal = def.type === "portal" || def.isPortal === true;
      const portalTarget = def.targetWorld || def.target || def.href || def.world;
      const rawActions = def.collisionAction ?? def.onCollide;
      const actionList = Array.isArray(rawActions) ? rawActions : (rawActions ? [rawActions] : []);
      if (isPortal && actionList.length === 0) {
        actionList.push({
          type: "portal",
          targetWorld: portalTarget,
          spawn: def.spawn,
          spawnYaw: def.spawnYaw
        });
      }
      const portalShape = (def.shape || def.geometry || (def.type === "portal" ? "box" : def.type) || "").toLowerCase();
      const materialOpts = {
        color: def.color || "#888"
      };
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
      if (portalShape === "box") {
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
        scene.add(mesh);
        objects.push(mesh);
        if (isPortal) {
          mesh.userData.isPortal = true;
          mesh.userData.portalTarget = portalTarget;
          if (portalTarget && portals) {
            const box = new THREE.Box3().setFromObject(mesh);
            portals.push({
              box,
              targetWorld: portalTarget,
              spawn: Array.isArray(def.spawn) ? def.spawn : null,
              spawnYaw: Number.isFinite(def.spawnYaw) ? def.spawnYaw : null,
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
            .map(action => normalizeAction(action, portalTarget))
            .filter(Boolean);
          if (actions.length > 0) {
            collisionActions.push({
              box,
              actions,
              cooldownMs: Number.isFinite(def.cooldownMs) ? def.cooldownMs : 1200,
              lastTriggeredAt: 0
            });
          }
        }

        if (def.isSolid) {
          if (portalShape === "box") {
            const [sx, sy, sz] = def.size;
            const halfSize = new THREE.Vector3(sx / 2, sy / 2, sz / 2);
            const center = new THREE.Vector3(...def.position);
            const box = new THREE.Box3(center.clone().sub(halfSize), center.clone().add(halfSize));
            colliders.push({ type: "box", box });
          } else if (portalShape === "sphere") {
            const center = new THREE.Vector3(...def.position);
            const radius = def.size[0];
            colliders.push({ type: "sphere", center, radius });
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
  } catch (err) {
    console.error("Failed to load world:", err);
  }
}
