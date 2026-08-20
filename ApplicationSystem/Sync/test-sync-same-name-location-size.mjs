// Nodevision/ApplicationSystem/Sync/test-sync-same-name-location-size.mjs
// This script verifies that the optional same-name/location/size sync skip only applies when file name, containing directory, and byte size all match.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { saveSyncScopes } from "./SyncScopes.mjs";
import { runScopeSyncTwoWay } from "./sync-scope-two-way.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

async function writeScopedFile(notebookDir, relativePath, content) {
  const filePath = path.resolve(notebookDir, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

function remoteManifest(scope, remoteFiles) {
  return {
    scope,
    generatedAt: "2026-01-01T00:00:00.000Z",
    files: remoteFiles.map((entry) => ({
      relativePath: entry.relativePath,
      size: Buffer.byteLength(entry.content),
      mtimeMs: 1,
      sha256: sha256(entry.content),
      transferMode: "json",
      tooLargeForJson: false,
    })),
  };
}

async function main() {
  const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-same-name-location-size-all-"));
  try {
    const scope = "Shared";
    const notebookDir = path.resolve(runtimeRoot, "Notebook");
    await saveSyncScopes([scope], { runtimeRoot });

    const localSameNameDifferentLocation = "Shared/photos/same-size.jpg";
    const remoteSameNameDifferentLocation = "Shared/archive/same-size.jpg";
    const localSameLocationDifferentName = "Shared/photos/local-name.jpg";
    const remoteSameLocationDifferentName = "Shared/photos/remote-name.jpg";

    await writeScopedFile(notebookDir, localSameNameDifferentLocation, "local");
    await writeScopedFile(notebookDir, localSameLocationDifferentName, "abcde");

    const remoteFiles = [
      { relativePath: remoteSameNameDifferentLocation, content: "remot" },
      { relativePath: remoteSameLocationDifferentName, content: "vwxyz" },
    ];
    const transport = {
      kind: "test-transport",
      async listFiles(requestedScope) {
        assert(requestedScope === scope, "Expected dry-run to request the Shared scope");
        return remoteManifest(scope, remoteFiles);
      },
    };

    const dryRun = await runScopeSyncTwoWay({ scope, runtimeRoot, dryRun: true, transport, skipSameNameLocationSize: true });
    assert(dryRun.operations.skipped.sameNameLocationSize.length === 0, "Expected no skip unless name, location, and size all match");
    assert(dryRun.operations.wouldPush.includes(localSameNameDifferentLocation), "Expected same-name/same-size local file in a different location to remain a push");
    assert(dryRun.operations.wouldPull.includes(remoteSameNameDifferentLocation), "Expected same-name/same-size remote file in a different location to remain a pull");
    assert(dryRun.operations.wouldPush.includes(localSameLocationDifferentName), "Expected same-location/same-size local file with a different name to remain a push");
    assert(dryRun.operations.wouldPull.includes(remoteSameLocationDifferentName), "Expected same-location/same-size remote file with a different name to remain a pull");

    console.log("PASS");
  } finally {
    await fs.rm(runtimeRoot, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("Same name/location/size sync test failed:", err);
  process.exitCode = 1;
});
