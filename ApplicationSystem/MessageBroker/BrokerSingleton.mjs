// Nodevision/ApplicationSystem/MessageBroker/BrokerSingleton.mjs
// Shared internal MQTT-style broker instance for Nodevision subsystems.

import { createBroker } from "./BrokerCore.mjs";

let broker = null;

export function getBroker() {
  if (!broker) {
    broker = createBroker({ maxEvents: 1000 });
  }
  return broker;
}

export function resetBrokerForTests() {
  broker = null;
}
