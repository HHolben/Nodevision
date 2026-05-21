// Nodevision/ApplicationSystem/MessageBroker/test-topic-matcher.mjs
// Tests for internal MQTT-style topic validation and filter matching.

import { topicMatchesFilter, validateTopicFilter, validateTopicName } from "./TopicMatcher.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectThrow(label, fn) {
  let didThrow = false;
  try {
    fn();
  } catch {
    didThrow = true;
  }
  assert(didThrow, `${label} should throw`);
}

async function main() {
  assert(topicMatchesFilter("garden/bed1/moisture", "garden/bed1/moisture"), "exact match failed");
  assert(topicMatchesFilter("garden/bed1/moisture", "garden/+/moisture"), "+ wildcard match failed");
  assert(topicMatchesFilter("garden/bed1/moisture", "garden/#"), "# wildcard match failed");
  assert(!topicMatchesFilter("garden/bed1/moisture", "garden/bed2/+"), "unexpected wildcard match");
  assert(topicMatchesFilter("nodevision/sync/events", "nodevision/#"), "nodevision # match failed");

  expectThrow("invalid # placement", () => validateTopicFilter("garden/#/moisture"));
  expectThrow("wildcards in publish topic", () => validateTopicName("garden/+/moisture"));
  expectThrow("$ publish topic", () => validateTopicName("$SYS/status"));
  expectThrow("$ topic filter", () => validateTopicFilter("$SYS/#"));

  console.log("PASS");
}

main().catch((err) => {
  console.error("Topic matcher test failed:", err);
  process.exitCode = 1;
});
