// Nodevision/ApplicationSystem/public/MetaWorld/MetaWorldMultiplayerConfig.mjs
// Shared MetaWorld multiplayer defaults and normalization helpers.

export const DEFAULT_META_WORLD_MULTIPLAYER = Object.freeze({
  enabled: false,
  publishRateMs: 700,
  snapshotRateMs: 1000,
  staleMs: 12000,
  avatarScale: 1,
  showNames: true
});

function clampFiniteNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function normalizeMetaWorldMultiplayer(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    enabled: source.enabled === true,
    publishRateMs: clampFiniteNumber(
      source.publishRateMs ?? source.heartbeatMs ?? source.sendRateMs,
      250,
      5000,
      DEFAULT_META_WORLD_MULTIPLAYER.publishRateMs
    ),
    snapshotRateMs: clampFiniteNumber(
      source.snapshotRateMs ?? source.pollRateMs ?? source.receiveRateMs,
      300,
      5000,
      DEFAULT_META_WORLD_MULTIPLAYER.snapshotRateMs
    ),
    staleMs: clampFiniteNumber(
      source.staleMs ?? source.timeoutMs,
      3000,
      60000,
      DEFAULT_META_WORLD_MULTIPLAYER.staleMs
    ),
    avatarScale: clampFiniteNumber(
      source.avatarScale ?? source.scale,
      0.35,
      2.5,
      DEFAULT_META_WORLD_MULTIPLAYER.avatarScale
    ),
    showNames: source.showNames !== false
  };
}

export function cloneDefaultMetaWorldMultiplayer() {
  return normalizeMetaWorldMultiplayer(DEFAULT_META_WORLD_MULTIPLAYER);
}
