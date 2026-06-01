// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/IoTDashboardHelpers.mjs
// Pure helper functions for the IoT Dashboard panel.

export const DEFAULT_IOT_TOPIC_PREFIX = "nodevision/iot/";
export const GARDEN_BED_1_TOPIC = "nodevision/iot/garden/bed1/moisture";

function scrubPreviewValue(value, depth = 0) {
  if (depth > 3) return "[truncated]";
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.length > 240 ? value.slice(0, 240) + "..." : value;
  if (Array.isArray(value)) return value.slice(0, 12).map((item) => scrubPreviewValue(item, depth + 1));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value).slice(0, 30)) {
      if (/privatekey|token|tokenhash|auth|secret/i.test(String(key || ""))) continue;
      out[key] = scrubPreviewValue(item, depth + 1);
    }
    return out;
  }
  return undefined;
}

export function truncatePayloadPreview(value, maxLength = 220) {
  let text = "";
  try {
    text = JSON.stringify(scrubPreviewValue(value));
  } catch {
    text = String(value ?? "");
  }
  if (!text || text === undefined) return "";
  return text.length > maxLength ? text.slice(0, Math.max(0, maxLength - 3)) + "..." : text;
}

export function parseIotPublishPayload(text) {
  const parsed = JSON.parse(String(text || ""));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Payload must be a JSON object.");
  }
  return parsed;
}

export function getDefaultIotTopicPrefix() {
  return DEFAULT_IOT_TOPIC_PREFIX;
}

function decodePayload(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function mapGardenBed1Payload(retainedMessages = []) {
  const message = (Array.isArray(retainedMessages) ? retainedMessages : []).find((item) => String(item?.topic || "") === GARDEN_BED_1_TOPIC);
  if (!message) return null;
  const payload = decodePayload(message.payload);
  if (!payload) return null;
  return {
    moisture: payload.moisture,
    threshold: payload.threshold,
    pumpOn: payload.pumpOn,
    timestamp: message.timestamp || payload.timestamp || null,
  };
}
