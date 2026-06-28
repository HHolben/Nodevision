// Nodevision/ApplicationSystem/Sync/test-offline-sync-inbox.mjs
// Focused tests for direct mounted-folder Offline Package handoff and receiver inbox behavior.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ensureDeviceIdentity } from "./DeviceIdentity.mjs";
import { addTrustedPeer } from "./TrustedPeers.mjs";
import { saveSyncScopes } from "./SyncScopes.mjs";
import { saveSyncProtection } from "./SyncProtection.mjs";
import {
  OFFLINE_SYNC_INBOX_MARKER_FILENAME,
  OFFLINE_SYNC_INBOX_MARKER_KIND,
  ensureOfflineSyncInbox,
  getOfflineSyncInboxDir,
  importOfflineInboxPackage,
  listOfflineSyncInbox,
  previewOfflineInboxPackage,
  previewOfflinePushPackage,
  pushOfflinePackageToMountedReceiver,
  resolveOfflineInboxPackagePath,
  validateReceiverDropPath,
} from "./OfflineSyncInbox.mjs";

const writeFile = async (root, relativePath, content) => {
  const target = path.resolve(root, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
};

const pathExists = async (target) => {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
};

async function main() {
  const sourceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-offline-push-source-"));
  const destRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-offline-push-dest-"));
  const sourceNotebook = path.join(sourceRoot, "Notebook");
  const destNotebook = path.join(destRoot, "Notebook");
  await saveSyncScopes(["SyncTest", "Shared"], { runtimeRoot: sourceRoot });
  await saveSyncScopes(["SyncTest", "Shared"], { runtimeRoot: destRoot });
  await writeFile(sourceNotebook, "Shared/a.txt", "from mounted push");

  const sourceIdentity = await ensureDeviceIdentity({ runtimeRoot: sourceRoot });
  await addTrustedPeer({
    deviceId: sourceIdentity.deviceId,
    deviceName: sourceIdentity.deviceName,
    publicKey: sourceIdentity.publicKey,
  }, { runtimeRoot: destRoot });

  const inbox = await ensureOfflineSyncInbox({ runtimeRoot: destRoot });
  assert.equal(await pathExists(inbox.inboxDir), true, "receiver inbox directory should be created");
  assert.equal(await pathExists(inbox.importedDir), true, "Imported directory should be created");
  assert.equal(inbox.marker.kind, OFFLINE_SYNC_INBOX_MARKER_KIND, "marker should identify the inbox");
  assert.equal(await pathExists(path.join(inbox.inboxDir, OFFLINE_SYNC_INBOX_MARKER_FILENAME)), true, "marker file should exist");
  assert.equal(getOfflineSyncInboxDir({ runtimeRoot: destRoot }), inbox.inboxDir);

  const validDrop = await validateReceiverDropPath(inbox.inboxDir);
  assert.equal(validDrop.ok, true);
  assert.equal(validDrop.writable, true);
  assert.equal(validDrop.marker.kind, OFFLINE_SYNC_INBOX_MARKER_KIND);

  await assert.rejects(
    () => validateReceiverDropPath(path.join(destRoot, "missing-inbox")),
    /does not exist/,
    "missing receiver drop path should be rejected",
  );

  if (process.platform !== "win32") {
    const readOnlyDrop = path.join(destRoot, "readonly-drop");
    await fs.mkdir(readOnlyDrop, { recursive: true });
    await fs.chmod(readOnlyDrop, 0o555);
    try {
      await assert.rejects(
        () => validateReceiverDropPath(readOnlyDrop),
        /not writable/,
        "non-writable receiver drop path should be rejected",
      );
    } finally {
      await fs.chmod(readOnlyDrop, 0o755).catch(() => {});
    }
  }

  const plainDrop = path.join(destRoot, "plain-drop");
  await fs.mkdir(plainDrop, { recursive: true });
  const plainPreview = await previewOfflinePushPackage({ runtimeRoot: sourceRoot, scope: "Shared", receiverDropPath: plainDrop });
  assert.equal(plainPreview.ok, true);
  assert.equal(plainPreview.warnings.length, 1, "plain writable folders should be allowed with a warning");
  assert.equal(plainPreview.estimatedFileCount, 1);

  const pushPreview = await previewOfflinePushPackage({ runtimeRoot: sourceRoot, scope: "Shared", receiverDropPath: inbox.inboxDir });
  assert.equal(pushPreview.ok, true);
  assert.equal(pushPreview.receiver.deviceId, inbox.marker.deviceId);
  assert.equal(pushPreview.estimatedFileCount, 1);
  assert.equal(pushPreview.estimatedByteCount > 0, true);

  const written = await pushOfflinePackageToMountedReceiver({ runtimeRoot: sourceRoot, scope: "Shared", receiverDropPath: inbox.inboxDir });
  assert.equal(written.ok, true);
  assert.match(written.packageFilename, /\.nodevisionsync\.zip$/);
  assert.equal(await pathExists(written.packagePath), true, "final package should be present");
  assert.equal(await pathExists(`${written.packagePath}.json`), true, "sidecar status file should be present");
  const inboxNames = await fs.readdir(inbox.inboxDir);
  assert.equal(inboxNames.some((name) => name.endsWith(".tmp")), false, "temporary package should be renamed away");

  await fs.writeFile(path.join(inbox.inboxDir, ".incoming.fake.nodevisionsync.zip.tmp"), "partial");
  await fs.writeFile(path.join(inbox.inboxDir, ".hidden.nodevisionsync.zip"), "hidden");
  await fs.writeFile(path.join(inbox.inboxDir, "unknown.txt"), "unknown");
  const listed = await listOfflineSyncInbox({ runtimeRoot: destRoot });
  assert.equal(listed.packages.length, 1, "listing should ignore tmp, hidden, and unknown files");
  assert.equal(listed.packages[0].filename, written.packageFilename);
  assert.equal(listed.packages[0].scope, "Shared");
  assert.equal(listed.packages[0].sourceDevice.deviceId, sourceIdentity.deviceId);

  await assert.rejects(
    () => resolveOfflineInboxPackagePath({ runtimeRoot: destRoot, filename: "../evil.nodevisionsync.zip" }),
    /Unsupported|Unsafe|escaped/,
    "inbox filename traversal should be rejected",
  );

  const inboxPreview = await previewOfflineInboxPackage({ runtimeRoot: destRoot, filename: written.packageFilename, targetScope: "Shared" });
  assert.equal(inboxPreview.ok, true);
  assert.equal(inboxPreview.counts.created, 1);
  assert.equal(await pathExists(path.join(destNotebook, "Shared", "a.txt")), false, "preview must not apply files");

  await saveSyncProtection({ protectedFromPeerWrites: true }, { runtimeRoot: destRoot });
  const protectedImport = await importOfflineInboxPackage({ runtimeRoot: destRoot, filename: written.packageFilename, targetScope: "Shared" });
  assert.equal(protectedImport.ok, false);
  assert.equal(protectedImport.imported, false);
  assert.equal(protectedImport.reason, "protected_mode");
  assert.equal(await pathExists(path.join(inbox.inboxDir, written.packageFilename)), true, "blocked imports should leave package pending");
  await saveSyncProtection({ protectedFromPeerWrites: false }, { runtimeRoot: destRoot });

  const imported = await importOfflineInboxPackage({ runtimeRoot: destRoot, filename: written.packageFilename, targetScope: "Shared" });
  assert.equal(imported.ok, true);
  assert.equal(imported.imported, true);
  assert.equal(await fs.readFile(path.join(destNotebook, "Shared", "a.txt"), "utf8"), "from mounted push");
  assert.equal(await pathExists(path.join(inbox.inboxDir, written.packageFilename)), false, "imported package should leave inbox root");
  assert.equal(imported.movedTo.includes(`${path.sep}Imported${path.sep}`), true, "imported package should move to Imported");

  const afterImportList = await listOfflineSyncInbox({ runtimeRoot: destRoot });
  assert.equal(afterImportList.packages.length, 0, "imported package should no longer be pending");

  console.log("PASS");
}

main().catch((err) => {
  console.error("Offline sync inbox test failed:", err);
  process.exitCode = 1;
});
