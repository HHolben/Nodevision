// Nodevision/ApplicationSystem/MessageBroker/test-broker-events-route-shape.mjs
// Tests the safe /api/broker/events projection helper used by brokerRoutes.mjs.

import { createBroker } from "./BrokerCore.mjs";
import { listSafeBrokerEvents } from "../server/routes/brokerRoutes.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function serialized(value) {
  return JSON.stringify(value);
}

async function main() {
  const broker = createBroker({ maxEvents: 10 });
  broker.publish("nodevision/sync/job/started", {
    jobId: "job-started-1234567890",
    scope: "Shared",
    status: "running",
    filesDone: 0,
    filesTotal: 2,
    bytesDone: 0,
    bytesTotal: 2048,
    currentFile: "Shared/example.md",
    privateKey: "do-not-return",
    authToken: "do-not-return",
    fileContents: "secret file text",
  });
  broker.publish("nodevision/other/topic", { jobId: "other" });
  broker.publish("nodevision/sync/job/progress", {
    jobId: "job-progress",
    scope: "Shared",
    status: "running",
    filesDone: 1,
    filesTotal: 2,
    bytesDone: 1024,
    bytesTotal: 2048,
    currentFile: "/home/henry/ServerSettings/private.key",
  });

  const filtered = listSafeBrokerEvents(broker, { topicPrefix: "nodevision/sync/", limit: 10 });
  assert(filtered.length === 2, "topicPrefix should return only sync events");
  assert(filtered.every((event) => event.topic.startsWith("nodevision/sync/")), "all returned events should match prefix");
  assert(filtered[0].payload.currentFile === "Shared/example.md", "safe relative currentFile should be retained");
  assert(!("currentFile" in filtered[1].payload), "absolute or ServerSettings currentFile should be removed");

  const limited = listSafeBrokerEvents(broker, { topicPrefix: "nodevision/sync/", limit: 1 });
  assert(limited.length === 1, "limit should cap results");
  assert(limited[0].topic === "nodevision/sync/job/progress", "limit should keep most recent matching event");

  const text = serialized(filtered);
  assert(!text.includes("privateKey"), "privateKey should not be exposed");
  assert(!text.includes("authToken"), "authToken should not be exposed");
  assert(!text.includes("do-not-return"), "sensitive field values should not be exposed");
  assert(!text.includes("ServerSettings"), "ServerSettings paths should not be exposed");
  assert(!text.includes("/home/"), "absolute paths should not be exposed");
  assert(!text.includes("secret file text"), "file contents should not be exposed");

  console.log("PASS");
}

main().catch((err) => {
  console.error("Broker events route shape test failed:", err);
  process.exitCode = 1;
});
