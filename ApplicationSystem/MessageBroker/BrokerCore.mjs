// Nodevision/ApplicationSystem/MessageBroker/BrokerCore.mjs
// Lightweight internal MQTT-style broker core for Nodevision publish/subscribe benchmarks.

import { topicMatchesFilter, validateTopicFilter, validateTopicName } from "./TopicMatcher.mjs";

// Future integration notes:
// - Graph Manager can subscribe to nodevision/graph/# for graph change streams.
// - Sync can publish nodevision/sync/events when peer discovery or sync jobs change.
// - IoT garden controllers can publish nodevision/iot/garden/# state updates.
// - A real MQTT wire protocol can be added later as a bridge over this core.
// Keep payloads small and JSON-serializable; do not publish private keys, Notebook
// contents, or file contents by default.

function clonePayload(value) {
  if (value === undefined) return undefined;
  return structuredClone(value);
}

function cloneMessage(message) {
  if (!message) return null;
  return {
    topic: message.topic,
    payload: clonePayload(message.payload),
    retained: Boolean(message.retained),
    timestamp: message.timestamp,
    publisherId: message.publisherId ?? null,
  };
}

function normalizeMaxEvents(value) {
  if (value === undefined || value === null) return 0;
  const maxEvents = Number(value);
  if (!Number.isInteger(maxEvents) || maxEvents < 0) {
    throw new Error("maxEvents must be a nonnegative integer");
  }
  return maxEvents;
}

export function createBroker(options = {}) {
  const subscribers = new Map();
  const retainedMessages = new Map();
  const eventLog = [];
  const maxEvents = normalizeMaxEvents(options.maxEvents);
  let nextSubscriberId = 1;

  function recordEvent(message) {
    if (maxEvents <= 0) return;
    eventLog.push(cloneMessage(message));
    while (eventLog.length > maxEvents) eventLog.shift();
  }

  function publish(topic, payload, publishOptions = {}) {
    validateTopicName(topic);
    const message = {
      topic,
      payload: clonePayload(payload),
      retained: false,
      timestamp: new Date().toISOString(),
      publisherId: publishOptions.publisherId || null,
    };

    if (publishOptions.retain === true) {
      retainedMessages.set(topic, cloneMessage({ ...message, retained: true }));
    }

    recordEvent(message);

    for (const subscriber of subscribers.values()) {
      if (!topicMatchesFilter(topic, subscriber.topicFilter)) continue;
      subscriber.callback(cloneMessage(message));
    }

    return cloneMessage(message);
  }

  function subscribe(topicFilter, callback, subscribeOptions = {}) {
    validateTopicFilter(topicFilter);
    if (typeof callback !== "function") {
      throw new Error("Subscriber callback must be a function");
    }

    const id = nextSubscriberId;
    nextSubscriberId += 1;
    subscribers.set(id, { topicFilter, callback });

    if (subscribeOptions.replayRetained !== false) {
      for (const retainedMessage of retainedMessages.values()) {
        if (topicMatchesFilter(retainedMessage.topic, topicFilter)) {
          callback(cloneMessage(retainedMessage));
        }
      }
    }

    return () => {
      subscribers.delete(id);
    };
  }

  function getRetained(topic) {
    validateTopicName(topic);
    return cloneMessage(retainedMessages.get(topic) || null);
  }

  function listRetained() {
    return [...retainedMessages.values()].map(cloneMessage);
  }

  function clearRetained(topic) {
    validateTopicName(topic);
    return retainedMessages.delete(topic);
  }

  function listEvents() {
    return eventLog.map(cloneMessage);
  }

  return {
    publish,
    subscribe,
    getRetained,
    listRetained,
    clearRetained,
    listEvents,
  };
}
