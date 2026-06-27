// Nodevision/ApplicationSystem/Sync/test-local-sync-package-transport.mjs
// Focused tests for offline sync package preview/import result alignment, trust, signatures, path safety, protected mode, and conflict handling.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import {
  applyLocalSyncPackage,
  createLocalSyncPackage,
  inspectLocalSyncPackage,
  LOCAL_SYNC_PACKAGE_KIND,
  normalizePackageRelativePath,
} from "./LocalSyncPackageTransport.mjs";
import { ensureDeviceIdentity, signMessage } from "./DeviceIdentity.mjs";
import { addTrustedPeer } from "./TrustedPeers.mjs";
import { saveSyncProtection } from "./SyncProtection.mjs";
import { saveSyncScopes } from "./SyncScopes.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

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

const rewritePackageManifest = async (packageBuffer, mutate, signingRuntimeRoot = null) => {
  const zip = await JSZip.loadAsync(packageBuffer);
  const manifest = JSON.parse(await zip.file("sync-manifest.json").async("string"));
  await mutate(manifest, zip);
  zip.file("sync-manifest.json", JSON.stringify(manifest, null, 2) + "\n");
  if (signingRuntimeRoot) {
    const signature = await signMessage(manifest, { runtimeRoot: signingRuntimeRoot });
    zip.file("signatures/manifest.sig", JSON.stringify(signature, null, 2) + "\n");
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
};

const addZipEntry = async (packageBuffer, entryName, content = "evil") => {
  const zip = await JSZip.loadAsync(packageBuffer);
  zip.file(entryName, content);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
};

async function main() {
  assert.equal(normalizePackageRelativePath("Shared/file.txt", "Shared"), "Shared/file.txt");
  assert.throws(() => normalizePackageRelativePath("../file.txt", "Shared"));
  assert.throws(() => normalizePackageRelativePath("/Shared/file.txt", "Shared"));
  assert.throws(() => normalizePackageRelativePath("C:\Users\Henry\evil.txt", "Shared"));
  assert.throws(() => normalizePackageRelativePath("Shared/%2e%2e/evil.txt", "Shared"));
  assert.throws(() => normalizePackageRelativePath("Shared/../file.txt", "Shared"));
  assert.throws(() => normalizePackageRelativePath("Other/file.txt", "Shared"));

  const sourceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-sync-package-source-"));
  const destRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-sync-package-dest-"));
  const sourceNotebook = path.join(sourceRoot, "Notebook");
  const destNotebook = path.join(destRoot, "Notebook");
  await saveSyncScopes(["SyncTest", "Shared"], { runtimeRoot: sourceRoot });
  await saveSyncScopes(["SyncTest", "Shared"], { runtimeRoot: destRoot });
  await writeFile(sourceNotebook, "Shared/a.txt", "from source");

  const sourceIdentity = await ensureDeviceIdentity({ runtimeRoot: sourceRoot });
  const exported = await createLocalSyncPackage({ runtimeRoot: sourceRoot, scope: "Shared" });
  assert.equal(exported.ok, true);
  assert.equal(exported.manifest.kind, LOCAL_SYNC_PACKAGE_KIND);
  assert.equal(exported.filesExported, 1);
  assert.ok(Buffer.isBuffer(exported.packageBuffer));

  const untrustedPreview = await inspectLocalSyncPackage({ packageBuffer: exported.packageBuffer, runtimeRoot: destRoot, targetScope: "Shared" });
  assert.equal(untrustedPreview.ok, false);
  assert.equal(untrustedPreview.status, "blocked");
  assert.equal(untrustedPreview.reason, "untrusted_peer");
  assert.equal(untrustedPreview.counts.created, 1);

  const untrustedImport = await applyLocalSyncPackage({ packageBuffer: exported.packageBuffer, runtimeRoot: destRoot, targetScope: "Shared" });
  assert.equal(untrustedImport.ok, false);
  assert.equal(untrustedImport.status, "blocked");
  assert.equal(await pathExists(path.join(destNotebook, "Shared", "a.txt")), false);

  await addTrustedPeer({
    deviceId: sourceIdentity.deviceId,
    deviceName: sourceIdentity.deviceName,
    publicKey: sourceIdentity.publicKey,
  }, { runtimeRoot: destRoot });

  const preview = await inspectLocalSyncPackage({ packageBuffer: exported.packageBuffer, runtimeRoot: destRoot, targetScope: "Shared" });
  assert.equal(preview.ok, true);
  assert.equal(preview.scope, "Shared");
  assert.equal(preview.trusted, true);
  assert.equal(preview.signatureVerified, true);
  assert.equal(preview.counts.created, 1);
  assert.equal(preview.counts.wouldCreate, 1);
  assert.equal(await pathExists(path.join(destNotebook, "Shared", "a.txt")), false, "preview must not modify files");

  await saveSyncProtection({ protectedFromPeerWrites: true }, { runtimeRoot: destRoot });
  const protectedImport = await applyLocalSyncPackage({ packageBuffer: exported.packageBuffer, runtimeRoot: destRoot, targetScope: "Shared" });
  assert.equal(protectedImport.ok, false);
  assert.equal(protectedImport.reason, "protected_mode");
  assert.equal(protectedImport.protectedMode.blocked, true);
  await saveSyncProtection({ protectedFromPeerWrites: false }, { runtimeRoot: destRoot });

  const imported = await applyLocalSyncPackage({ packageBuffer: exported.packageBuffer, runtimeRoot: destRoot, targetScope: "Shared" });
  assert.equal(imported.ok, true);
  assert.equal(imported.status, "completed");
  assert.equal(imported.counts.created, 1);
  assert.equal(imported.operations.pulled[0].relativePath, "Shared/a.txt");
  assert.equal(await fs.readFile(path.join(destNotebook, "Shared", "a.txt"), "utf8"), "from source");

  await writeFile(destNotebook, "Shared/a.txt", "local edit");
  const conflictPreview = await inspectLocalSyncPackage({ packageBuffer: exported.packageBuffer, runtimeRoot: destRoot, targetScope: "Shared" });
  assert.equal(conflictPreview.counts.conflicts, 1);
  assert.equal(conflictPreview.conflicts[0].reason, "missing_base_hash");
  const conflicted = await applyLocalSyncPackage({ packageBuffer: exported.packageBuffer, runtimeRoot: destRoot, targetScope: "Shared" });
  assert.equal(conflicted.counts.conflicts, 1);
  assert.equal(await fs.readFile(path.join(destNotebook, "Shared", "a.txt"), "utf8"), "local edit");
  const conflictPath = path.join(destNotebook, conflicted.conflicts[0].conflictRelativePath);
  assert.equal(await fs.readFile(conflictPath, "utf8"), "from source");

  await writeFile(sourceNotebook, "Shared/update.txt", "new version");
  const updatePackageRaw = await createLocalSyncPackage({ runtimeRoot: sourceRoot, scope: "Shared" });
  await writeFile(destNotebook, "Shared/update.txt", "old version");
  const updatePackage = await rewritePackageManifest(updatePackageRaw.packageBuffer, (manifest) => {
    const entry = manifest.manifest.files.find((file) => file.relativePath === "Shared/update.txt");
    entry.baseSha256 = sha256("old version");
  }, sourceRoot);
  const updatePreview = await inspectLocalSyncPackage({ packageBuffer: updatePackage, runtimeRoot: destRoot, targetScope: "Shared" });
  assert.equal(updatePreview.counts.updated, 1);
  const updated = await applyLocalSyncPackage({ packageBuffer: updatePackage, runtimeRoot: destRoot, targetScope: "Shared" });
  assert.equal(updated.counts.updated, 1);
  assert.equal(await fs.readFile(path.join(destNotebook, "Shared", "update.txt"), "utf8"), "new version");

  const wrongScopePreview = await inspectLocalSyncPackage({ packageBuffer: exported.packageBuffer, runtimeRoot: destRoot, targetScope: "SyncTest" });
  assert.equal(wrongScopePreview.ok, false);
  assert.equal(wrongScopePreview.reason, "target_scope_mismatch");
  const wrongScopeImport = await applyLocalSyncPackage({ packageBuffer: exported.packageBuffer, runtimeRoot: destRoot, targetScope: "SyncTest" });
  assert.equal(wrongScopeImport.ok, false);
  assert.equal(wrongScopeImport.reason, "target_scope_mismatch");

  const invalidSignature = await rewritePackageManifest(exported.packageBuffer, (manifest) => {
    manifest.exportedAt = new Date(Date.parse(manifest.exportedAt) + 1000).toISOString();
  });
  const invalidSignaturePreview = await inspectLocalSyncPackage({ packageBuffer: invalidSignature, runtimeRoot: destRoot, targetScope: "Shared" });
  assert.equal(invalidSignaturePreview.ok, false);
  assert.equal(invalidSignaturePreview.reason, "invalid_signature");
  const invalidSignatureImport = await applyLocalSyncPackage({ packageBuffer: invalidSignature, runtimeRoot: destRoot, targetScope: "Shared" });
  assert.equal(invalidSignatureImport.ok, false);
  assert.equal(invalidSignatureImport.reason, "invalid_signature");

  const absolutePathPackage = await rewritePackageManifest(exported.packageBuffer, (manifest) => {
    manifest.manifest.files[0].relativePath = "/absolute/path.txt";
  });
  const absolutePreview = await inspectLocalSyncPackage({ packageBuffer: absolutePathPackage, runtimeRoot: destRoot, targetScope: "Shared" });
  assert.equal(absolutePreview.ok, false);
  assert.equal(absolutePreview.packageValid, false);

  const windowsPathPackage = await rewritePackageManifest(exported.packageBuffer, (manifest) => {
    manifest.manifest.files[0].relativePath = "C:\Users\Henry\evil.txt";
  });
  const windowsPreview = await inspectLocalSyncPackage({ packageBuffer: windowsPathPackage, runtimeRoot: destRoot, targetScope: "Shared" });
  assert.equal(windowsPreview.ok, false);
  assert.equal(windowsPreview.packageValid, false);

  const traversalEntryPackage = await addZipEntry(exported.packageBuffer, "../evil.txt", "evil");
  const traversalPreview = await inspectLocalSyncPackage({ packageBuffer: traversalEntryPackage, runtimeRoot: destRoot, targetScope: "Shared" });
  assert.equal(traversalPreview.ok, false);
  assert.equal(traversalPreview.packageValid, false);

  await writeFile(sourceNotebook, "Shared/partial-a.txt", "partial a");
  await writeFile(sourceNotebook, "Shared/partial-b.txt", "partial b");
  const partialPackage = await createLocalSyncPackage({ runtimeRoot: sourceRoot, scope: "Shared" });
  await fs.mkdir(path.join(destNotebook, "Shared", "partial-b.txt"), { recursive: true });
  const partialImport = await applyLocalSyncPackage({ packageBuffer: partialPackage.packageBuffer, runtimeRoot: destRoot, targetScope: "Shared" });
  assert.equal(partialImport.partial, true);
  assert.equal(partialImport.counts.blocked >= 1, true);
  assert.equal(partialImport.counts.created >= 1, true);
  assert.equal(Array.isArray(partialImport.blocked), true);
  assert.equal(Array.isArray(partialImport.skippedOperations), true);

  console.log("PASS");
}

main().catch((err) => {
  console.error("Local sync package transport test failed:", err);
  process.exitCode = 1;
});
