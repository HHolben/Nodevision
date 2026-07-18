# Local Sync Package Transport

Nodevision offline sync packages are ZIP files with this inspectable layout:

```text
sync-manifest.json
files/<Notebook-relative scoped path>
tombstones/deleted-files.json
signatures/manifest.sig
```

`sync-manifest.json` has `kind: "NodevisionSyncPackage"` and `schemaVersion: 1`. It records the source device ID/name/public key, scope, export timestamp, sync mode, and a scoped file manifest with relative paths, sizes, hashes, and modification times.

MetaWorld importers or other game-data importers should find character/world data independently from sync packages. For offline sync package import, read `sync-manifest.json`, verify `kind` and `schemaVersion`, verify `signatures/manifest.sig` against the manifest and source public key, then compare the source device against `ServerSettings/Trust/TrustedPeers.json`. Import must reject absolute paths, backslashes, `..`, symlink parent paths, and any path outside the configured Notebook scope before reading or writing files.

## Import/Preview Result Model

Offline Package preview and import now return the same high-level vocabulary as live peer sync jobs. Results include `ok`, `status`, `scope`, `targetScope`, `filesTotal`, `filesDone`, `bytesTotal`, `bytesDone`, `errors`, `skipped`, `skippedOperations`, `conflicts`, `created`, `updated`, `deleted`, `blocked`, `protectedMode`, `trustedPeerFound`, `signatureVerified`, `reason`, and `operations`.

For compatibility with the first package UI, preview also keeps `counts.wouldCreate`, `counts.wouldUpdate`, `counts.wouldSaveConflicts`, `counts.wouldKeepLocal`, `counts.same`, and matching `operations.would...` aliases. Import uses the same plan shape but records the files actually created, updated, skipped, blocked, or copied to `.conflicts`.

Known blocked statuses include:

- `invalid_package`: ZIP, manifest, or package path validation failed.
- `invalid_signature`: the signed manifest cannot be verified.
- `untrusted_peer`: the signature is valid, but the source device is not trusted locally.
- `target_scope_mismatch`: the selected target scope does not match the package scope.
- `scope_not_enabled`: the package scope is not enabled for sync.
- `protected_mode`: local protected mode prevents incoming writes.

The importer is conservative about overwrites. Existing local files are skipped when identical, safely updated only when package metadata includes a `baseSha256` that matches the local hash, and otherwise saved as conflict copies under `.conflicts` without replacing the local edit.

## Manual Test Plan

1. On device A, share a small Notebook folder as a sync scope.
2. On device B, trust device A through the existing peer trust flow.
3. On device A, select `Offline Package`, click `Export Sync Package`, and confirm a `.nodevisionsync` file downloads.
4. Inspect the package and confirm it contains `sync-manifest.json`, `files/`, `tombstones/deleted-files.json`, and `signatures/manifest.sig`.
5. Confirm the manifest paths are relative Notebook paths and include file size, hash, modification time, and optional base-hash metadata.
6. On device B, select the matching scope, choose `Import Sync Package`, and confirm preview shows Created, Updated, Skipped, Conflicts, Blocked, and Errors categories.
7. Confirm preview does not modify Notebook files.
8. Import the package and confirm the same categories appear in the import result.
9. Confirm created files are written only inside the selected Notebook scope.
10. Modify a destination file, import the package again, and confirm the incoming file is copied under `.conflicts` without overwriting the local edit.
11. Attempt import from an untrusted source device and confirm preview/import are blocked as signed but untrusted.
12. Tamper with `sync-manifest.json` after export and confirm preview/import report an invalid or unsigned package.
13. Select the wrong target scope before preview/import and confirm Nodevision blocks the package as a target-scope mismatch.
14. Enable protected mode and confirm package import is blocked with a protected-mode message.
15. Try packages containing `../evil.txt`, `../../somewhere`, `/absolute/path.txt`, `C:\Users\Henry\evil.txt`, URL-encoded traversal, empty paths, or NUL-path attempts and confirm preview/import reject them without writing files.
16. Create a partial failure scenario such as a destination directory where a package file should be written, and confirm import reports partial success with per-file blocked details.
17. Return to `Wireless / LAN` and confirm existing peer discovery, trust, dry-run, push, pull, sync, and large-file HTTP streaming still work.
18. Select `Direct / USB Ethernet` and confirm diagnostics list non-Wi-Fi direct interfaces, IP addresses, listener binding, and candidate peer probe URLs.
19. Confirm the no-interface message appears when the OS has not created a wired direct IPv4 network interface.
