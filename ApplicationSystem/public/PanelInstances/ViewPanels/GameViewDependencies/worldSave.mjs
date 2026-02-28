// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs
// Serializes the active GameView scene back into a world JSON block and saves it.

function normalizeWorldPath(filePath) {
  if (!filePath) return "";
  const normalized = String(filePath).replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.startsWith("./")) return normalized.slice(2);
  if (normalized.startsWith("Notebook/")) return normalized.slice("Notebook/".length);
  return normalized;
}

const DEFAULT_ENVIRONMENT = {
  skyColor: "#0f1c2b",
  floorColor: "#333333",
  backgroundMode: "color",
  backgroundImage: ""
};

function buildEnvironmentMeta(movementState) {
  const env = movementState?.environment || {};
  return {
    skyColor: env.skyColor || DEFAULT_ENVIRONMENT.skyColor,
    floorColor: env.floorColor || DEFAULT_ENVIRONMENT.floorColor,
    backgroundMode: env.backgroundMode || (env.backgroundImage ? "image" : "color"),
    backgroundImage: env.backgroundImage || "",
    floorImage: env.floorImage || ""
  };
}

function round3(n) {
  return Math.round(Number(n) * 1000) / 1000;
}

function vec3(v) {
  return [round3(v.x), round3(v.y), round3(v.z)];
}

function getMeshType(mesh) {
  const hint = String(mesh?.userData?.nvType || "").toLowerCase();
  if (hint === "portal") return "portal";
  if (
    hint === "box"
    || hint === "sphere"
    || hint === "cylinder"
    || hint === "torus"
    || hint === "math-function"
    || hint === "console"
    || hint === "object-file"
  ) return hint;
  const gType = mesh?.geometry?.type;
  if (gType === "BoxGeometry") return "box";
  if (gType === "SphereGeometry") return "sphere";
  if (gType === "CylinderGeometry") return "cylinder";
  if (gType === "TorusGeometry") return "torus";
  return null;
}

function getGeometryShape(mesh) {
  const gType = mesh?.geometry?.type;
  if (gType === "BoxGeometry") return "box";
  if (gType === "SphereGeometry") return "sphere";
  if (gType === "CylinderGeometry") return "cylinder";
  if (gType === "TorusGeometry") return "torus";
  return "box";
}

function materialColorHex(mesh) {
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (mat?.color?.isColor) return `#${mat.color.getHexString()}`;
  return "#888888";
}

function materialMeta(mesh) {
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (!mat) return {};
  const out = {};
  if (mat.transparent === true) out.opacity = Number.isFinite(mat.opacity) ? round3(mat.opacity) : 0.65;
  if (mat.emissive?.isColor && mat.emissive.getHex() !== 0) out.emissive = `#${mat.emissive.getHexString()}`;
  if (Number.isFinite(mat.emissiveIntensity) && mat.emissiveIntensity !== 1) out.emissiveIntensity = round3(mat.emissiveIntensity);
  return out;
}

function serializeMesh(mesh) {
  if (!mesh?.isMesh) return null;
  const type = getMeshType(mesh);
  if (!type) return null;

  const def = {
    type,
    position: vec3(mesh.position),
    color: materialColorHex(mesh),
    isSolid: mesh.userData?.isSolid === true
  };

  const g = mesh.geometry;
  const sx = Math.abs(mesh.scale?.x || 1);
  const sy = Math.abs(mesh.scale?.y || 1);
  const sz = Math.abs(mesh.scale?.z || 1);

  const shape = type === "portal" ? getGeometryShape(mesh) : type;

  if (type === "math-function") {
    const props = mesh.userData?.mathFunctionProperties || {};
    def.equation = typeof props.equation === "string" ? props.equation : "Math.sin(x)";
    const rawResolution = Number.isFinite(props.resolution) ? props.resolution : 96;
    def.resolution = Math.max(16, Math.min(192, Math.floor(rawResolution)));
    def.limits = Array.isArray(props.limits) ? props.limits.slice(0, 2).map(round3) : [-8, 8];
    def.collider = props.collider !== false;
  } else if (type === "console") {
    const props = mesh.userData?.consoleProperties || {};
    def.collider = props.collider !== false;
    if (typeof props.objectFile === "string" && props.objectFile) def.objectFile = props.objectFile;
    if (typeof props.linkedObject === "string" && props.linkedObject) def.linkedObject = props.linkedObject;
    const p = g?.parameters || {};
    def.size = [
      round3((p.width ?? 1) * sx),
      round3((p.height ?? 1) * sy),
      round3((p.depth ?? 1) * sz)
    ];
  } else if (type === "object-file") {
    const p = g?.parameters || {};
    def.size = [
      round3((p.width ?? 1) * sx),
      round3((p.height ?? 1) * sy),
      round3((p.depth ?? 1) * sz)
    ];
    if (typeof mesh.userData?.objectFilePath === "string" && mesh.userData.objectFilePath) {
      def.objectFile = mesh.userData.objectFilePath;
    }
  } else if (shape === "box") {
    const p = g?.parameters || {};
    def.size = [
      round3((p.width ?? 1) * sx),
      round3((p.height ?? 1) * sy),
      round3((p.depth ?? 1) * sz)
    ];
  } else if (shape === "sphere") {
    const p = g?.parameters || {};
    const scale = Math.max(sx, sy, sz);
    def.size = [round3((p.radius ?? 0.5) * scale)];
  } else if (shape === "cylinder") {
    const p = g?.parameters || {};
    const rScale = Math.max(sx, sz);
    def.size = [
      round3((p.radiusTop ?? p.radius ?? 0.5) * rScale),
      round3((p.height ?? 1) * sy)
    ];
  } else if (shape === "torus") {
    const p = g?.parameters || {};
    const rScale = Math.max(sx, sz);
    def.size = [
      round3((p.radius ?? 1) * rScale),
      round3((p.tube ?? 0.25) * rScale)
    ];
  }

  Object.assign(def, materialMeta(mesh));

  if (mesh.userData?.isWater === true) def.isWater = true;
  if (typeof mesh.userData?.tag === "string" && mesh.userData.tag) def.tag = mesh.userData.tag;
  if (typeof mesh.userData?.spawnId === "string" && mesh.userData.spawnId) def.spawnId = mesh.userData.spawnId;
  if (Number.isFinite(mesh.userData?.spawnYaw)) def.spawnYaw = mesh.userData.spawnYaw;

  if (mesh.userData?.isPortal === true || type === "portal") {
    def.type = "portal";
    def.shape = shape;
    def.isSolid = mesh.userData?.isSolid === true;
    if (typeof mesh.userData?.portalTarget === "string" && mesh.userData.portalTarget) def.targetWorld = mesh.userData.portalTarget;
    if (mesh.userData?.portalSameWorld === true) def.sameWorld = true;
    if (Array.isArray(mesh.userData?.portalSpawn) && mesh.userData.portalSpawn.length >= 3) def.spawn = mesh.userData.portalSpawn.slice(0, 3).map(round3);
    if (typeof mesh.userData?.portalSpawnPoint === "string" && mesh.userData.portalSpawnPoint) def.spawnPoint = mesh.userData.portalSpawnPoint;
    if (Number.isFinite(mesh.userData?.portalSpawnYaw)) def.spawnYaw = mesh.userData.portalSpawnYaw;
    if (Number.isFinite(mesh.userData?.portalCooldownMs)) def.cooldownMs = mesh.userData.portalCooldownMs;
  }

  return def;
}

function serializeLight(light) {
  if (!light?.isLight) return null;
  let lightType = "point";
  if (light.isAmbientLight) lightType = "ambient";
  else if (light.isDirectionalLight) lightType = "directional";
  else if (light.isSpotLight) lightType = "spot";
  else if (light.isHemisphereLight) lightType = "hemisphere";
  return {
    type: "light",
    lightType,
    position: vec3(light.position),
    color: light.color?.isColor ? `#${light.color.getHexString()}` : "#ffffff",
    intensity: Number.isFinite(light.intensity) ? round3(light.intensity) : 1
  };
}

function buildWorldDefinition({
  existingWorldDefinition,
  objects,
  lights,
  movementState
}) {
  const existing = existingWorldDefinition && typeof existingWorldDefinition === "object"
    ? JSON.parse(JSON.stringify(existingWorldDefinition))
    : {};

  const objectArray = objects || [];
  const meshDefs = objectArray
    .map(serializeMesh)
    .filter(Boolean);
  const lightDefs = (lights || [])
    .map(serializeLight)
    .filter(Boolean);

  const shouldFallbackToExistingObjects = meshDefs.length === 0
    && objectArray.length > 0
    && Array.isArray(existing.objects)
    && existing.objects.length > 0;
  if (shouldFallbackToExistingObjects) {
    console.warn("[worldSave] Retaining previously saved objects because serialization returned 0 meshes after environment update.");
  }

  const finalMeshDefs = shouldFallbackToExistingObjects ? existing.objects : meshDefs;
  const worldRules = movementState?.worldRules || {};
  const metadata = {
    ...(existing.metadata || {}),
    source: existing?.metadata?.source || "GameView",
    lastSavedAt: new Date().toISOString(),
    playerRules: {
      allowFly: worldRules.allowFly === true,
      allowRoll: worldRules.allowRoll === true,
      allowPitch: worldRules.allowPitch === true,
      allowPlace: worldRules.allowPlace === true,
      allowBreak: worldRules.allowBreak === true,
      allowInspect: worldRules.allowInspect === true,
      allowToolUse: worldRules.allowToolUse === true,
      allowSave: worldRules.allowSave === true
    },
    environment: buildEnvironmentMeta(movementState)
  };

  return {
    ...existing,
    worldMode: movementState?.worldMode === "2d" ? "2d" : "3d",
    metadata,
    objects: finalMeshDefs.concat(lightDefs)
  };
}

function injectWorldDefinitionIntoHtml(html, worldDefinition) {
  const scriptBlock = `<script type="application/json">\n${JSON.stringify(worldDefinition, null, 2)}\n</script>`;
  const scriptRegex = /<script\s+type=["']application\/json["']\s*>[\s\S]*?<\/script>/i;
  if (scriptRegex.test(html)) {
    return html.replace(scriptRegex, scriptBlock);
  }
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `  ${scriptBlock}\n</body>`);
  }
  return `${html}\n${scriptBlock}\n`;
}

export async function saveCurrentWorldFile({
  state,
  movementState,
  objects,
  lights
}) {
  const currentMode = String(movementState?.playerMode || "survival").toLowerCase();
  if (currentMode !== "creative") {
    alert("World saving is only available in Creative mode.");
    return false;
  }

  const worldPath = normalizeWorldPath(state?.currentWorldPath || window.selectedFilePath || "");
  if (!worldPath) {
    alert("No world file is selected.");
    return false;
  }

  const worldDefinition = buildWorldDefinition({
    existingWorldDefinition: state?.currentWorldDefinition || window.VRWorldContext?.currentWorldDefinition || null,
    objects,
    lights,
    movementState
  });

  let existingHtml = "";
  try {
    const res = await fetch(`/Notebook/${encodeURI(worldPath)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    existingHtml = await res.text();
  } catch (err) {
    console.error("Failed to load current world HTML before save:", err);
    alert(`Failed to read world file before save: ${err.message}`);
    return false;
  }

  const updatedHtml = injectWorldDefinitionIntoHtml(existingHtml, worldDefinition);

  try {
    const saveRes = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: worldPath, content: updatedHtml })
    });
    const payload = await saveRes.json().catch(() => ({}));
    if (!saveRes.ok || !payload?.success) {
      throw new Error(payload?.error || `${saveRes.status} ${saveRes.statusText}`);
    }
    if (state) state.currentWorldDefinition = JSON.parse(JSON.stringify(worldDefinition));
    if (window.VRWorldContext) window.VRWorldContext.currentWorldDefinition = JSON.parse(JSON.stringify(worldDefinition));
    return true;
  } catch (err) {
    console.error("Failed to save world HTML:", err);
    alert(`Failed to save world: ${err.message}`);
    return false;
  }
}
