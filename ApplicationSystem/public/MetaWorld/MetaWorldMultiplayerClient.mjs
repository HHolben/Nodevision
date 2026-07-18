// Nodevision/ApplicationSystem/public/MetaWorld/MetaWorldMultiplayerClient.mjs
// Browser-side MetaWorld multiplayer presence client.

import { normalizeMetaWorldMultiplayer } from "/MetaWorld/MetaWorldMultiplayerConfig.mjs";

const PLAYER_ID_STORAGE_KEY = "nodevision.metaWorld.multiplayer.playerId";
const LAN_DEVICE_STORAGE_KEY = "nodevision.lanCooperation.deviceId";
const DISPLAY_NAME_STORAGE_KEY = "nodevision.lanCooperation.displayName";
const API_BASE = "/api/meta-world/multiplayer";

function randomId(prefix) {
  const nativeId = window.crypto?.randomUUID?.();
  return nativeId ? `${prefix}-${nativeId}` : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStorage(key) {
  try {
    return window.localStorage?.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    // Local storage is optional for embedded/browser-restricted contexts.
  }
}

function getPlayerId() {
  const existing = readStorage(PLAYER_ID_STORAGE_KEY);
  if (existing) return existing;
  const generated = randomId("metaworld-player");
  writeStorage(PLAYER_ID_STORAGE_KEY, generated);
  return generated;
}

function getLanDeviceId() {
  const existing = readStorage(LAN_DEVICE_STORAGE_KEY);
  if (existing) return existing;
  const generated = randomId("lan");
  writeStorage(LAN_DEVICE_STORAGE_KEY, generated);
  return generated;
}

function getDisplayName() {
  const stored = readStorage(DISPLAY_NAME_STORAGE_KEY);
  if (stored) return stored;
  const identity = window.NodevisionState?.identity || window.NodevisionUser || null;
  return identity?.username || identity?.displayName || "MetaWorld Player";
}

function numberOr(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function vectorFromPose(position = {}) {
  if (Array.isArray(position)) {
    return {
      x: numberOr(position[0]),
      y: numberOr(position[1]),
      z: numberOr(position[2])
    };
  }
  return {
    x: numberOr(position.x),
    y: numberOr(position.y),
    z: numberOr(position.z)
  };
}

function normalizeWorldPath(rawPath = "") {
  let text = String(rawPath || "").replace(/\\/g, "/");
  const notebookMarker = "/Notebook/";
  const markerIndex = text.indexOf(notebookMarker);
  if (markerIndex !== -1) text = text.slice(markerIndex + notebookMarker.length);
  text = text.replace(/^\/+/, "");
  if (text.startsWith("./")) return text.slice(2);
  if (text.startsWith("Notebook/")) return text.slice("Notebook/".length);
  return text;
}

function colorForPlayer(playerId = "") {
  let hash = 0;
  for (let i = 0; i < playerId.length; i += 1) {
    hash = ((hash << 5) - hash + playerId.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 72%, 58%)`;
}

function encodeQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

async function fetchJson(url, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  headers.set("X-Nodevision-Lan-Device-Id", getLanDeviceId());
  headers.set("X-Nodevision-MetaWorld-Player-Id", getPlayerId());
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `MetaWorld multiplayer request failed (${response.status})`);
  return payload;
}

function disposeObject3d(object) {
  object?.traverse?.((child) => {
    if (child.geometry?.dispose) child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : (child.material ? [child.material] : []);
    materials.forEach((material) => {
      if (material.map?.dispose) material.map.dispose();
      if (material.dispose) material.dispose();
    });
  });
  object?.parent?.remove?.(object);
}

function createNameSprite(THREE, labelText, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(12, 18, 26, 0.72)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect?.(8, 10, 240, 44, 12);
    if (typeof ctx.roundRect === "function") {
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(8, 10, 240, 44);
      ctx.strokeRect(8, 10, 240, 44);
    }
    ctx.fillStyle = color || "#ffffff";
    ctx.font = "600 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(labelText || "Player").slice(0, 22), 128, 32, 216);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    depthWrite: false,
    transparent: true,
    toneMapped: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(0, 2.05, 0);
  sprite.scale.set(1.4, 0.35, 1);
  return sprite;
}

function createAvatar(THREE, player) {
  const color = player.color || colorForPlayer(player.playerId);
  const group = new THREE.Group();
  group.name = `MetaWorldRemotePlayer:${player.playerId}`;
  group.userData.nvType = "remote-player";
  group.userData.playerId = player.playerId;

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.28, 1.12, 18),
    new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.05 })
  );
  body.position.y = 0.72;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 20, 20),
    new THREE.MeshStandardMaterial({ color: "#f3d3b0", roughness: 0.8 })
  );
  head.position.y = 1.46;
  group.add(head);

  const facing = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.08, 0.18),
    new THREE.MeshStandardMaterial({ color: "#1b2430", roughness: 0.5 })
  );
  facing.position.set(0, 1.46, -0.23);
  group.add(facing);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.018, 8, 36),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.04;
  group.add(ring);

  const nameSprite = createNameSprite(THREE, player.displayName || "Player", color);
  group.add(nameSprite);
  group.userData.nameSprite = nameSprite;

  return group;
}

function lerpAngle(current, target, amount) {
  const pi2 = Math.PI * 2;
  let delta = (target - current) % pi2;
  if (delta > Math.PI) delta -= pi2;
  if (delta < -Math.PI) delta += pi2;
  return current + delta * amount;
}

export function createMetaWorldMultiplayerClient({ THREE, scene, camera, controls, movementState, panel }) {
  const playerId = getPlayerId();
  const avatars = new Map();
  const reusablePosition = new THREE.Vector3();
  let settings = normalizeMetaWorldMultiplayer();
  let worldPath = "";
  let running = false;
  let joined = false;
  let heartbeatTimer = 0;
  let snapshotTimer = 0;
  let lastErrorAt = 0;
  const beforeUnloadHandler = () => stop({ sendLeave: true });

  function clearTimer(timer) {
    if (timer) window.clearTimeout(timer);
    return 0;
  }

  function localPose() {
    const playerObject = controls?.getObject?.();
    const position = playerObject?.getWorldPosition
      ? playerObject.getWorldPosition(reusablePosition)
      : (playerObject?.position || camera?.position || reusablePosition.set(0, 0, 0));
    return {
      position: {
        x: numberOr(position.x),
        y: numberOr(position.y),
        z: numberOr(position.z)
      },
      rotation: {
        yaw: numberOr(playerObject?.rotation?.y, numberOr(camera?.rotation?.y)),
        pitch: numberOr(camera?.rotation?.x),
        roll: numberOr(camera?.rotation?.z)
      },
      mode: movementState?.movementMode || movementState?.worldMode || "3d",
      cameraMode: movementState?.cameraMode || "first",
      playerHeight: numberOr(movementState?.playerHeight, 1.75)
    };
  }

  function status(message) {
    movementState.metaWorldMultiplayerStatus = message;
  }

  function noteError(err) {
    const now = Date.now();
    if (now - lastErrorAt > 5000) {
      console.warn("[MetaWorldMultiplayer]", err);
      lastErrorAt = now;
    }
    status(err?.message || "Multiplayer unavailable.");
  }

  function playerPayload(extra = {}) {
    return {
      worldPath,
      playerId,
      displayName: getDisplayName(),
      deviceId: getLanDeviceId(),
      settings,
      pose: localPose(),
      ...extra
    };
  }

  async function join() {
    if (!running || joined || !worldPath) return;
    const payload = await fetchJson(`${API_BASE}/join`, {
      method: "POST",
      body: JSON.stringify(playerPayload())
    });
    joined = true;
    status("Multiplayer connected.");
    updateRemotePlayers(payload.players || []);
  }

  async function sendHeartbeat() {
    if (!running || !worldPath) return;
    if (!joined) await join();
    const payload = await fetchJson(`${API_BASE}/heartbeat`, {
      method: "POST",
      body: JSON.stringify(playerPayload())
    });
    if (Array.isArray(payload.players)) updateRemotePlayers(payload.players);
  }

  async function fetchSnapshot() {
    if (!running || !worldPath) return;
    if (!joined) await join();
    const payload = await fetchJson(`${API_BASE}/snapshot${encodeQuery({ worldPath, playerId })}`);
    updateRemotePlayers(payload.players || []);
  }

  function scheduleHeartbeat() {
    heartbeatTimer = clearTimer(heartbeatTimer);
    if (!running) return;
    heartbeatTimer = window.setTimeout(async () => {
      try {
        await sendHeartbeat();
      } catch (err) {
        joined = false;
        noteError(err);
      }
      scheduleHeartbeat();
    }, settings.publishRateMs);
  }

  function scheduleSnapshot() {
    snapshotTimer = clearTimer(snapshotTimer);
    if (!running) return;
    snapshotTimer = window.setTimeout(async () => {
      try {
        await fetchSnapshot();
      } catch (err) {
        noteError(err);
      }
      scheduleSnapshot();
    }, settings.snapshotRateMs);
  }

  function removeAvatar(remotePlayerId) {
    const entry = avatars.get(remotePlayerId);
    if (!entry) return;
    disposeObject3d(entry.group);
    avatars.delete(remotePlayerId);
  }

  function updateRemotePlayers(players = []) {
    const seen = new Set();
    for (const player of players) {
      if (!player || player.playerId === playerId) continue;
      const remotePlayerId = String(player.playerId || "");
      if (!remotePlayerId) continue;
      seen.add(remotePlayerId);
      const pose = player.pose || {};
      const position = vectorFromPose(pose.position || {});
      const rotation = pose.rotation || {};
      const playerHeight = numberOr(pose.playerHeight, 1.75);
      let entry = avatars.get(remotePlayerId);
      if (!entry) {
        const group = createAvatar(THREE, player);
        group.scale.setScalar(settings.avatarScale);
        scene.add(group);
        entry = {
          group,
          targetPosition: new THREE.Vector3(position.x, position.y - playerHeight, position.z),
          targetYaw: numberOr(rotation.yaw),
          updatedAt: Date.now()
        };
        group.position.copy(entry.targetPosition);
        group.rotation.y = entry.targetYaw;
        avatars.set(remotePlayerId, entry);
      }
      entry.targetPosition.set(position.x, position.y - playerHeight, position.z);
      entry.targetYaw = numberOr(rotation.yaw, entry.targetYaw);
      entry.updatedAt = Date.now();
      entry.group.visible = true;
      entry.group.scale.setScalar(settings.avatarScale);
      if (entry.group.userData.nameSprite) {
        entry.group.userData.nameSprite.visible = settings.showNames !== false;
      }
    }

    for (const [remotePlayerId, entry] of avatars.entries()) {
      const staleBySnapshot = !seen.has(remotePlayerId) && Date.now() - entry.updatedAt > settings.staleMs;
      if (staleBySnapshot) removeAvatar(remotePlayerId);
    }
  }

  function stop({ sendLeave = true } = {}) {
    if (!running && avatars.size === 0) return;
    const previousWorldPath = worldPath;
    running = false;
    joined = false;
    heartbeatTimer = clearTimer(heartbeatTimer);
    snapshotTimer = clearTimer(snapshotTimer);
    for (const remotePlayerId of Array.from(avatars.keys())) removeAvatar(remotePlayerId);
    status("");
    if (sendLeave && previousWorldPath) {
      const body = JSON.stringify({ worldPath: previousWorldPath, playerId, deviceId: getLanDeviceId() });
      try {
        if (!navigator.sendBeacon?.(`${API_BASE}/leave`, new Blob([body], { type: "application/json" }))) {
          void fetchJson(`${API_BASE}/leave`, { method: "POST", body, keepalive: true }).catch(() => {});
        }
      } catch {
        void fetchJson(`${API_BASE}/leave`, { method: "POST", body, keepalive: true }).catch(() => {});
      }
    }
  }

  function start() {
    if (!worldPath || running) return;
    running = true;
    joined = false;
    status("Connecting multiplayer...");
    void join().catch(noteError);
    scheduleHeartbeat();
    scheduleSnapshot();
  }

  function configure(next = {}) {
    const nextSettings = normalizeMetaWorldMultiplayer(next.settings || next.multiplayer || {});
    settings = next.enabled === true ? { ...nextSettings, enabled: true } : nextSettings;
    const nextWorldPath = normalizeWorldPath(next.worldPath || "");
    const shouldRestart = worldPath !== nextWorldPath;
    if (shouldRestart) stop({ sendLeave: true });
    worldPath = nextWorldPath;
    movementState.multiplayer = settings;
    if (settings.enabled === true && worldPath) start();
    else stop({ sendLeave: true });
    return settings;
  }

  function update() {
    if (!running) return;
    const now = Date.now();
    for (const [remotePlayerId, entry] of avatars.entries()) {
      if (now - entry.updatedAt > settings.staleMs * 1.5) {
        removeAvatar(remotePlayerId);
        continue;
      }
      entry.group.position.lerp(entry.targetPosition, 0.22);
      entry.group.rotation.y = lerpAngle(entry.group.rotation.y, entry.targetYaw, 0.24);
      if (entry.group.userData.nameSprite) {
        entry.group.userData.nameSprite.quaternion.copy(camera.quaternion);
      }
    }
  }

  window.addEventListener("beforeunload", beforeUnloadHandler);

  return {
    playerId,
    configure,
    update,
    stop,
    dispose() {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      stop({ sendLeave: true });
    },
    getStatus() {
      return {
        running,
        joined,
        worldPath,
        settings,
        remotePlayerCount: avatars.size,
        status: movementState.metaWorldMultiplayerStatus || ""
      };
    }
  };
}
