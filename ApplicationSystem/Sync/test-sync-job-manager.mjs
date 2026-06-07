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
    if (["complete", "completed", "failed", "cancelled"].includes(job.status)) return job;
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
  assert(completeJob?.status === "completed", "Expected job to reach completed status");
  assert(completeJob.filesDone === 1, "Expected filesDone progress");
  assert(completeJob.bytesDone === 10, "Expected bytesDone progress");
  assert(Array.isArray(completeJob.operations) && completeJob.operations.length >= 1, "Expected completed job operations");

  let retryAttempts = 0;
  const startedPausedRetry = manager.startJob({
    scope: "Shared",
    peerUrl: "http://127.0.0.1:3001",
    dryRun: false,
    async run({ onProgress, onFileError }) {
      onProgress({ event: "plan", filesTotal: 1, bytesTotal: 10, filesDone: 0, bytesDone: 0 });
      while (true) {
        onProgress({ event: "file-start", operation: "pull", relativePath: "Shared/retry.bin", currentFile: "Shared/retry.bin" });
        if (retryAttempts === 0) {
          retryAttempts += 1;
          const decision = await onFileError({ operation: "pull", relativePath: "Shared/retry.bin", error: "temporary stream failure", statusCode: 500, retryCount: 0, bytes: 10 });
          if (decision.action === "retry") continue;
        }
        onProgress({ event: "file-complete", operation: "pull", relativePath: "Shared/retry.bin", filesDone: 1, bytesDone: 10, currentFile: null });
        return { operations: { pulled: [{ relativePath: "Shared/retry.bin", bytes: 10 }], pushed: [], conflicts: [] } };
      }
    },
  });
  const pausedRetry = await waitForStatus(manager, startedPausedRetry.jobId, "paused");
  assert(pausedRetry?.currentFile === "Shared/retry.bin", "Expected paused job to retain currentFile");
  assert(pausedRetry?.pausedOperation?.relativePath === "Shared/retry.bin", "Expected paused operation relativePath");
  assert(pausedRetry?.pausedError?.statusCode === 500, "Expected paused error status code");
  assert(manager.retryPausedJob(startedPausedRetry.jobId)?.status === "running", "Expected retry to resume job");
  const retriedComplete = await waitForFinalStatus(manager, startedPausedRetry.jobId);
  assert(retriedComplete?.status === "completed", "Expected retried job to complete");
  assert(retriedComplete.retryCount === 1, "Expected retry count to increment");

  let retryFailAttempts = 0;
  const startedRetryFails = manager.startJob({
    scope: "Shared",
    peerUrl: "http://127.0.0.1:3001",
    dryRun: false,
    async run({ onProgress, onFileError }) {
      onProgress({ event: "plan", filesTotal: 1, bytesTotal: 10, filesDone: 0, bytesDone: 0 });
      while (true) {
        onProgress({ event: "file-start", operation: "pull", relativePath: "Shared/retry-again.bin", currentFile: "Shared/retry-again.bin" });
        retryFailAttempts += 1;
        const decision = await onFileError({ operation: "pull", relativePath: "Shared/retry-again.bin", error: "still failing", statusCode: 401, retryCount: retryFailAttempts - 1, bytes: 10 });
        if (decision.action === "retry") continue;
        if (decision.action === "skip") return { operations: { pulled: [], pushed: [], conflicts: [], skippedOperations: [decision.skippedOperation] } };
        const cancelled = new Error("aborted");
        cancelled.name = "SyncJobCancelledError";
        throw cancelled;
      }
    },
  });
  assert((await waitForStatus(manager, startedRetryFails.jobId, "paused"))?.pausedError?.statusCode === 401, "Expected first retry-fail pause");
  manager.retryPausedJob(startedRetryFails.jobId);
  const pausedAgain = await waitForStatus(manager, startedRetryFails.jobId, "paused");
  assert(pausedAgain?.retryCount === 1, "Expected retry failure to pause again with retry count");
  manager.skipPausedJob(startedRetryFails.jobId);
  const retryFailSkipped = await waitForFinalStatus(manager, startedRetryFails.jobId);
  assert(retryFailSkipped?.status === "completed", "Expected skip after retry failure to complete");
  assert(retryFailSkipped?.filesSkipped === 1, "Expected skipped count after retry failure skip");
  assert(retryFailSkipped?.skippedOperations?.[0]?.relativePath === "Shared/retry-again.bin", "Expected skipped operation path after retry failure");
  assert(String(retryFailSkipped?.skippedOperations?.[0]?.error || "").includes("still failing"), "Expected skipped operation error after retry failure");

  const startedSkip = manager.startJob({
    scope: "Shared",
    peerUrl: "http://127.0.0.1:3001",
    dryRun: false,
    async run({ onProgress, onFileError }) {
      onProgress({ event: "plan", filesTotal: 2, bytesTotal: 20, filesDone: 0, bytesDone: 0 });
      onProgress({ event: "file-start", operation: "push", relativePath: "Shared/bad.bin", currentFile: "Shared/bad.bin" });
      const decision = await onFileError({ operation: "push", relativePath: "Shared/bad.bin", error: "push failed", statusCode: 500, bytes: 10 });
      if (decision.action !== "skip") throw new Error("expected skip");
      onProgress({ event: "file-start", operation: "push", relativePath: "Shared/good.bin", currentFile: "Shared/good.bin" });
      onProgress({ event: "file-complete", operation: "push", relativePath: "Shared/good.bin", filesDone: 1, bytesDone: 10, currentFile: null });
      return {
        partial: true,
        status: "completed_with_skips",
        operations: { pulled: [], pushed: [{ relativePath: "Shared/good.bin", bytes: 10 }], conflicts: [], skippedOperations: [decision.skippedOperation] },
      };
    },
  });
  await waitForStatus(manager, startedSkip.jobId, "paused");
  const skipResponse = manager.skipPausedJob(startedSkip.jobId);
  assert(skipResponse?.filesSkipped === 1, "Expected skip response to record skipped file");
  const skippedComplete = await waitForFinalStatus(manager, startedSkip.jobId);
  assert(skippedComplete?.status === "completed", "Expected skipped job to complete");
  assert(skippedComplete?.filesSkipped === 1, "Expected completed job skipped count");
  assert(skippedComplete?.result?.partial === true, "Expected completed job result partial true");
  assert(skippedComplete?.result?.status === "completed_with_skips", "Expected completed job result skipped status");
  assert(skippedComplete?.skippedOperations?.[0]?.relativePath === "Shared/bad.bin", "Expected final skipped operation path");

  const startedAbort = manager.startJob({
    scope: "Shared",
    peerUrl: "http://127.0.0.1:3001",
    dryRun: false,
    async run({ onProgress, onFileError }) {
      onProgress({ event: "plan", filesTotal: 1, bytesTotal: 10, filesDone: 0, bytesDone: 0 });
      onProgress({ event: "file-start", operation: "pull", relativePath: "Shared/abort.bin", currentFile: "Shared/abort.bin" });
      const decision = await onFileError({ operation: "pull", relativePath: "Shared/abort.bin", error: "fatal file error", statusCode: 500, bytes: 10 });
      if (decision.action === "abort") {
        const cancelled = new Error("aborted");
        cancelled.name = "SyncJobCancelledError";
        throw cancelled;
      }
    },
  });
  await waitForStatus(manager, startedAbort.jobId, "paused");
  const abortResponse = manager.abortJob(startedAbort.jobId);
  assert(abortResponse?.status === "cancelled", "Expected abort response to mark cancelled");
  const abortedJob = await waitForFinalStatus(manager, startedAbort.jobId);
  assert(abortedJob?.status === "cancelled", "Expected aborted job to stay cancelled");
  assert(abortedJob?.pausedOperation?.relativePath === "Shared/abort.bin", "Expected aborted job to preserve paused operation");

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
