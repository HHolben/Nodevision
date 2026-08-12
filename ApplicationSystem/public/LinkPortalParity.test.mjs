// Nodevision/ApplicationSystem/public/LinkPortalParity.test.mjs
// This test verifies that link and portal parity defaults to enabled while preserving an explicit user opt-out.

import assert from "node:assert/strict";
import { isLinkPortalParityEnabled } from "./LinkPortalParity.mjs";

function memoryStorage(value = null) {
  return {
    getItem: () => value,
  };
}

const original = {
  localStorage: globalThis.localStorage,
  NodevisionUserPreferences: globalThis.NodevisionUserPreferences,
  NodevisionState: globalThis.NodevisionState,
};

try {
  delete globalThis.NodevisionUserPreferences;
  delete globalThis.NodevisionState;
  globalThis.localStorage = memoryStorage(null);
  assert.equal(isLinkPortalParityEnabled(), true);

  globalThis.localStorage = memoryStorage(JSON.stringify({ linkPortalParity: false }));
  assert.equal(isLinkPortalParityEnabled(), false);

  globalThis.localStorage = memoryStorage(JSON.stringify({ linkPortalParity: true }));
  assert.equal(isLinkPortalParityEnabled(), true);

  globalThis.NodevisionUserPreferences = { linkPortalParity: false };
  assert.equal(isLinkPortalParityEnabled(), false);

  globalThis.NodevisionUserPreferences = {};
  globalThis.NodevisionState = { userPreferences: { linkPortalParity: false } };
  assert.equal(isLinkPortalParityEnabled(), false);

  globalThis.NodevisionUserPreferences = { linkPortalParity: true };
  assert.equal(isLinkPortalParityEnabled(), true);
} finally {
  Object.assign(globalThis, original);
}

console.log("LinkPortalParity tests passed.");
