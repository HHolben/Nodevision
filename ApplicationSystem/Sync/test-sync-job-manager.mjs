// Nodevision/ApplicationSystem/Sync/test-sync-job-manager.mjs
// This script validates sync job lifecycle transitions, failure reporting, and cancellation behavior for in-memory SyncJobManager jobs.

import { createSyncJobManager } from "./SyncJobManager.mjs";

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
    if (!job) return null;
    if (["complete", "failed", "cancelled"].includes(job.status)) return job;
    await delay(20);
  }
  return manager.getJobStatus(jobId);
}

async function main() {
  const manager = createSyncJobManager();

  const startedComplete = manager.startJob({
    scope: "Shared",
    peerUrl: "http://127.0.0.1:3001",
    dryRun: false,
    async run({ onProgress }) {
      onProgress({ event: "plan", filesTotal: 1, bytesTotal: 10, filesDone: 0, bytesDone: 0, currentFile: null });
      onProgress({ event: "file-start", operation: "pull", relativePath: "Shared/a.bin", currentFile: "Shared/a.bin" });
      await delay(30);
      onProgress({ event: "file-complete", operation: "pull", relativePath: "Shared/a.bin", filesDone: 1, bytesDone: 10, currentFile: null });
      return {
        operations: {
          pulled: [{ relativePath: "Shared/a.bin", bytes: 10 }],
          pushed: [],
          conflicts: [],
        },
      };
    },
  });
  assert(startedComplete.status === "queued", "Expected newly started job to be queued");
  const completeJob = await waitForFinalStatus(manager, startedComplete.jobId);
  assert(completeJob?.status === "complete", "Expected job to reach complete status");
  assert(completeJob.filesDone === 1, "Expected filesDone progress");
  assert(completeJob.bytesDone === 10, "Expected bytesDone progress");
  assert(Array.isArray(completeJob.operations) && completeJob.operations.length >= 1, "Expected completed job operations");

  const startedFailed = manager.startJob({
    scope: "Shared",
    peerUrl: "http://127.0.0.1:3001",
    dryRun: false,
    async run({ onProgress }) {
      await delay(10);
      onProgress({ event: "file-error", operation: "pull", relativePath: "Shared/fail.bin", error: "stream auth expired" });
      throw new Error("intentional failure");
    },
  });
  const failedJob = await waitForFinalStatus(manager, startedFailed.jobId);
  assert(failedJob?.status === "failed", "Expected failed status for throwing job");
  assert(Array.isArray(failedJob.errors) && failedJob.errors.some((entry) => String(entry).includes("intentional failure")), "Expected failure error text");
  assert(Array.isArray(failedJob.errors) && failedJob.errors.some((entry) => String(entry).includes("stream auth expired")), "Expected progress error text");

  const startedCancelled = manager.startJob({
    scope: "Shared",
    peerUrl: "http://127.0.0.1:3001",
    dryRun: false,
    async run({ isCancelled, onProgress }) {
      onProgress({ event: "plan", filesTotal: 1, bytesTotal: 100, filesDone: 0, bytesDone: 0, currentFile: "Shared/cancel.bin" });
      while (true) {
        if (isCancelled()) {
          const cancelled = new Error("cancelled");
          cancelled.name = "SyncJobCancelledError";
          throw cancelled;
        }
        await delay(15);
      }
    },
  });
  await delay(40);
  const cancelResponse = manager.cancelJob(startedCancelled.jobId);
  assert(cancelResponse, "Expected cancel response");
  const cancelledJob = await waitForFinalStatus(manager, startedCancelled.jobId);
  assert(cancelledJob?.status === "cancelled", "Expected cancelled status after cancellation");
  assert(manager.cancelJob("missing-job-id") === null, "Expected missing job cancel to return null");

  console.log("PASS");
}

main().catch((err) => {
  console.error("Sync job manager test failed:", err);
  process.exitCode = 1;
});
