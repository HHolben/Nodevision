// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/IoTDashboardHelpers.test.mjs
// Tests pure IoT Dashboard helper behavior.

import {
  DEFAULT_IOT_TOPIC_PREFIX,
  mapGardenBed1Payload,
  parseIotPublishPayload,
  truncatePayloadPreview,
} from "./IoTDashboardHelpers.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertThrows(label, fn) {
  let didThrow = false;
  try {
    fn();
  } catch {
    didThrow = true;
  }
  assert(didThrow, `${label} should throw`);
}

function main() {
  const preview = truncatePayloadPreview({ hello: "world", tokenHash: "do-not-return", nested: { authToken: "hidden" } }, 80);
  assert(preview.includes("hello"), "payload preview should include safe fields");
  assert(!preview.includes("tokenHash"), "payload preview should omit tokenHash key");
  assert(!preview.includes("do-not-return"), "payload preview should omit sensitive values");
  assert(preview.length <= 80, "payload preview should respect max length");

  assert(parseIotPublishPayload("{\"hello\":\"world\"}").hello === "world", "valid object JSON should parse");
  assertThrows("invalid JSON", () => parseIotPublishPayload("{"));
  assertThrows("array JSON", () => parseIotPublishPayload("[]"));

  assert(DEFAULT_IOT_TOPIC_PREFIX === "nodevision/iot/", "default IoT topic prefix mismatch");

  const garden = mapGardenBed1Payload([
    {
      topic: "nodevision/iot/garden/bed1/moisture",
      timestamp: "2026-05-31T12:00:00.000Z",
      payload: { moisture: 812, threshold: 600, pumpOn: true },
    },
  ]);
  assert(garden?.moisture === 812, "garden moisture should map");
  assert(garden?.threshold === 600, "garden threshold should map");
  assert(garden?.pumpOn === true, "garden pump state should map");
  assert(garden?.timestamp === "2026-05-31T12:00:00.000Z", "garden timestamp should map");

  console.log("PASS");
}

main();
