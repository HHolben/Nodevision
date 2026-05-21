// Nodevision/ApplicationSystem/MessageBroker/demo-sync-events.mjs
// Demonstrates internal sync lifecycle events on the shared MQTT-style broker.

import { getBroker, resetBrokerForTests } from "./BrokerSingleton.mjs";

resetBrokerForTests();
const broker = getBroker();

broker.subscribe("nodevision/sync/#", (message) => {
  const payload = message.payload || {};
  const progress = payload.filesTotal
    ? `${payload.filesDone}/${payload.filesTotal} files, ${payload.bytesDone}/${payload.bytesTotal} bytes`
    : "no progress totals";
  console.log(`${message.timestamp} ${message.topic} ${payload.status} job=${payload.jobId} scope=${payload.scope} ${progress}`);
});

const basePayload = {
  jobId: "demo-sync-job",
  scope: "Shared",
  peerUrl: "http://127.0.0.1:3001/",
  filesDone: 0,
  filesTotal: 2,
  bytesDone: 0,
  bytesTotal: 2048,
  currentFile: null,
};

function publish(topic, payload, options = {}) {
  broker.publish(topic, { ...payload, timestamp: new Date().toISOString() }, options);
}

publish("nodevision/sync/job/started", { ...basePayload, status: "running" }, { retain: true });
publish("nodevision/sync/job/progress", { ...basePayload, status: "running", currentFile: "Shared/a.bin", bytesDone: 512 });
publish("nodevision/sync/job/progress", { ...basePayload, status: "running", filesDone: 1, currentFile: "Shared/b.bin", bytesDone: 1536 });
publish("nodevision/sync/job/completed", { ...basePayload, status: "complete", filesDone: 2, bytesDone: 2048 }, { retain: true });

// Future Graph Manager idea: subscribe to nodevision/sync/# and visualize active
// sync jobs, peer relationships, file transfer activity, failures, and conflicts.
