// Nodevision/ApplicationSystem/MessageBroker/test-sync-broker-events.mjs
// Tests sync lifecycle publishing through the internal MQTT-style broker.

import { createSyncJobManager } from "../Sync/SyncJobManager.mjs";
import { getBroker, resetBrokerForTests } from "./BrokerSingleton.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForFinalStatus(manager, jobId, timeoutMs = 3000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const job = manager.getJobStatus(jobId);
    if (job && ["complete", "completed", "failed", "cancelled"].includes(job.status)) return job;
    await delay(20);
  }
  return manager.getJobStatus(jobId);
}

async function waitForStatus(manager, jobId, expectedStatus, timeoutMs = 3000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const job = manager.getJobStatus(jobId);
    if (job?.status === expectedStatus) return job;
    await delay(20);
  }
  return manager.getJobStatus(jobId);
}

function assertSafePayload(payload) {
  const serialized = JSON.stringify(payload);
  assert(!serialized.includes("privateKey"), "payload should not expose private keys");
  assert(!serialized.includes("authToken"), "payload should not expose auth tokens");
  assert(!serialized.includes("ServerSettings"), "payload should not expose ServerSettings paths");
  assert(!serialized.includes("/home/"), "payload should not expose absolute paths");
  assert(!serialized.includes("secret-token"), "payload should strip URL tokens");
  assert(Object.prototype.hasOwnProperty.call(payload, "jobId"), "payload should include jobId");
}

async function main() {
  resetBrokerForTests();
  const firstBroker = getBroker();
  assert(firstBroker === getBroker(), "getBroker should return a singleton instance");
  resetBrokerForTests();
  const broker = getBroker();
  assert(firstBroker !== broker, "resetBrokerForTests should reset the singleton");

  const received = [];
  broker.subscribe("nodevision/sync/#", (message) => received.push(message));
  const manager = createSyncJobManager({ broker });

  const startedComplete = manager.startJob({
    scope: "Shared",
    peerUrl: "http://user:pass@127.0.0.1:3001/sync?token=secret-token#frag",
    async run({ onProgress }) {
      onProgress({ event: "plan", filesTotal: 1, bytesTotal: 10, filesDone: 0, bytesDone: 0, currentFile: "/home/henry/ServerSettings/private.key" });
      onProgress({ event: "file-complete", operation: "pull", relativePath: "Shared/a.bin", filesDone: 1, bytesDone: 10, currentFile: "Shared/a.bin" });
      return { operations: { pulled: [{ relativePath: "Shared/a.bin", bytes: 10 }], pushed: [], conflicts: [] } };
    },
  });

  const completeJob = await waitForFinalStatus(manager, startedComplete.jobId);
  assert(completeJob?.status === "completed", "job should complete");

  const started = received.find((message) => message.topic === "nodevision/sync/job/started");
  const progress = received.find((message) => message.topic === "nodevision/sync/job/progress");
  const completed = received.find((message) => message.topic === "nodevision/sync/job/completed");
  assert(started, "started event should publish");
  assert(progress, "progress event should publish");
  assert(completed, "completed event should publish");
  assert(completed.retained === false, "live completed callback should not be marked retained");
  assertSafePayload(started.payload);
  assertSafePayload(progress.payload);
  assertSafePayload(completed.payload);

  const lateMessages = [];
  broker.subscribe("nodevision/sync/job/#", (message) => lateMessages.push(message));
  assert(lateMessages.some((message) => message.topic === "nodevision/sync/job/started" && message.retained), "late subscribers should see retained started state");
  assert(lateMessages.some((message) => message.topic === "nodevision/sync/job/completed" && message.retained), "late subscribers should see retained completed state");
  assert(lateMessages.some((message) => message.topic === `nodevision/sync/job/${startedComplete.jobId}/state` && message.retained), "late subscribers should see retained per-job state");

  const startedFailed = manager.startJob({
    scope: "Shared",
    peerUrl: "http://127.0.0.1:3001",
    async run() {
      throw new Error("intentional failure with authToken=secret-token");
    },
  });
  const failedJob = await waitForFinalStatus(manager, startedFailed.jobId);
  assert(failedJob?.status === "failed", "job should fail");
  const failed = received.find((message) => message.topic === "nodevision/sync/job/failed" && message.payload.jobId === startedFailed.jobId);
  assert(failed, "failed event should publish");
  assertSafePayload(failed.payload);

  const startedCancelled = manager.startJob({
    scope: "Shared",
    peerUrl: "http://127.0.0.1:3001",
    async run({ isCancelled }) {
      while (!isCancelled()) await delay(10);
      const err = new Error("cancelled");
      err.name = "SyncJobCancelledError";
      throw err;
    },
  });
  await delay(20);
  manager.cancelJob(startedCancelled.jobId);
  const cancelledJob = await waitForFinalStatus(manager, startedCancelled.jobId);
  assert(cancelledJob?.status === "cancelled", "job should cancel");
  const cancelled = received.find((message) => message.topic === "nodevision/sync/job/cancelled" && message.payload.jobId === startedCancelled.jobId);
  assert(cancelled, "cancelled event should publish");
  assertSafePayload(cancelled.payload);

  let pauseAttempts = 0;
  const startedPaused = manager.startJob({
    scope: "Shared",
    peerUrl: "http://127.0.0.1:3001",
    async run({ onProgress, onFileError }) {
      onProgress({ event: "plan", filesTotal: 1, bytesTotal: 10, filesDone: 0, bytesDone: 0 });
      while (true) {
        onProgress({ event: "file-start", operation: "pull", relativePath: "Shared/pause.bin", currentFile: "Shared/pause.bin" });
        pauseAttempts += 1;
        const decision = await onFileError({ operation: "pull", relativePath: "Shared/pause.bin", error: "stream failed", statusCode: 500, retryCount: pauseAttempts - 1, bytes: 10 });
        if (decision.action === "retry") continue;
        if (decision.action === "skip") return { partial: true, operations: { pulled: [], pushed: [], conflicts: [], skippedOperations: [decision.skippedOperation] } };
      }
    },
  });
  assert((await waitForStatus(manager, startedPaused.jobId, "paused"))?.status === "paused", "paused job should pause on file error");
  manager.retryPausedJob(startedPaused.jobId);
  assert((await waitForStatus(manager, startedPaused.jobId, "paused"))?.status === "paused", "retried job should pause again on repeated file error");
  manager.skipPausedJob(startedPaused.jobId);
  const skippedJob = await waitForFinalStatus(manager, startedPaused.jobId);
  assert(skippedJob?.filesSkipped === 1, "paused skipped job should record skipped file");
  const paused = received.find((message) => message.topic === "nodevision/sync/job/paused" && message.payload.jobId === startedPaused.jobId);
  const retried = received.find((message) => message.topic === "nodevision/sync/job/retried" && message.payload.jobId === startedPaused.jobId);
  const skipped = received.find((message) => message.topic === "nodevision/sync/job/skipped" && message.payload.jobId === startedPaused.jobId);
  assert(paused, "paused event should publish");
  assert(retried, "retried event should publish");
  assert(skipped, "skipped event should publish");
  assertSafePayload(paused.payload);
  assertSafePayload(retried.payload);
  assertSafePayload(skipped.payload);

  console.log("PASS");
}

main().catch((err) => {
  console.error("Sync broker events test failed:", err);
  process.exitCode = 1;
});
