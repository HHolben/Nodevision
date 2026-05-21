// Nodevision/ApplicationSystem/MessageBroker/TopicMatcher.mjs
// Internal MQTT-style topic validation and filter matching for Nodevision's event broker benchmark.

function assertNonemptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a nonempty string`);
  }
}

function splitLevels(value, label) {
  const levels = value.split("/");
  if (levels.some((level) => level.length === 0)) {
    throw new Error(`${label} must not contain empty topic levels`);
  }
  return levels;
}

export function validateTopicName(topic) {
  assertNonemptyString(topic, "Topic name");
  if (topic.startsWith("$")) {
    throw new Error("Topic names starting with $ are not supported yet");
  }
  if (topic.includes("+") || topic.includes("#")) {
    throw new Error("Publish topic names must not contain wildcards");
  }
  splitLevels(topic, "Topic name");
  return topic;
}

export function validateTopicFilter(filter) {
  assertNonemptyString(filter, "Topic filter");
  if (filter.startsWith("$")) {
    throw new Error("Topic filters starting with $ are not supported yet");
  }

  const levels = splitLevels(filter, "Topic filter");
  for (let index = 0; index < levels.length; index += 1) {
    const level = levels[index];
    if (level.includes("+") && level !== "+") {
      throw new Error("+ wildcard must occupy an entire topic filter level");
    }
    if (level.includes("#")) {
      if (level !== "#") {
        throw new Error("# wildcard must occupy an entire topic filter level");
      }
      if (index !== levels.length - 1) {
        throw new Error("# wildcard must be the final topic filter level");
      }
    }
  }
  return filter;
}

export function topicMatchesFilter(topic, filter) {
  validateTopicName(topic);
  validateTopicFilter(filter);

  const topicLevels = topic.split("/");
  const filterLevels = filter.split("/");

  for (let index = 0; index < filterLevels.length; index += 1) {
    const filterLevel = filterLevels[index];
    const topicLevel = topicLevels[index];

    if (filterLevel === "#") return true;
    if (topicLevel === undefined) return false;
    if (filterLevel === "+") continue;
    if (filterLevel !== topicLevel) return false;
  }

  return topicLevels.length === filterLevels.length;
}
