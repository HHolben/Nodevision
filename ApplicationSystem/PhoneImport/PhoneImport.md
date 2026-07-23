# Nodevision Phone Import MVP

## Scope

This first phase supports importing Messages from an existing local, unencrypted Apple iPhone backup directory. The importer reads only local backup files and writes selected conversations into the Nodevision Notebook as ordinary HTML documents.

Supported in this phase:

- Existing iTunes, Finder, or libimobiledevice backup directories
- Unencrypted backups
- `HomeDomain/Library/SMS/sms.db`
- SMS, MMS, and iMessage records present in `sms.db`
- Basic conversations, participants, message direction, service, text, timestamps, and attachments
- Attachment files that can be resolved through `Manifest.db`

Not supported in this phase:

- USB phone detection
- Pairing, Trust prompts, or live device acquisition
- Running `idevicebackup2`
- Encrypted backups or password handling
- Restores, phone writes, or phone deletes
- Contacts as a separate artifact
- Photos outside Messages attachments
- Notes, calendar, call history, app documents, iCloud downloads, and contact-page merging

Encrypted backups stop before any Messages parsing with this user-facing message:

> This backup is encrypted. Encrypted iPhone backups are not supported by this version of the importer.

## Backup Directory Expectations

The validator accepts either an individual device-backup directory containing `Manifest.db`, or a parent directory containing exactly one child backup directory. If a parent contains multiple backups, the user must select a specific device backup folder.

`Manifest.db` is required. `Manifest.plist`, `Info.plist`, and `Status.plist` are read when present. They are not modified. XML and common binary plist values are parsed for encryption and device metadata.

## Manifest Lookup

Files are resolved through `Manifest.db`; no known backup hashes are hardcoded. Messages are located with:

- domain: `HomeDomain`
- relative path: `Library/SMS/sms.db`

Attachment filenames from `sms.db` are normalized to `Library/SMS/Attachments/...` under `HomeDomain`, then resolved through `Manifest.db`. Absolute paths from the database are never followed directly.

## SQLite Reading

The server uses the host `sqlite3` command with argument arrays and `-readonly` because Nodevision does not currently ship a JavaScript SQLite dependency. The importer copies `sms.db` into a private temporary workspace before reading and resolves sidecars through the manifest when present:

- `Library/SMS/sms.db-wal`
- `Library/SMS/sms.db-shm`

Before querying Messages data, the reader inspects `sqlite_master` and `PRAGMA table_info(...)`. Missing optional tables or columns are warnings. A missing `message` table aborts parsing.

## Date Handling

Timestamps are normalized by testing plausible combinations of Apple epoch, Unix epoch, seconds, milliseconds, microseconds, and nanoseconds. Normalized values are stored as ISO 8601 UTC strings. The original source timestamp and detected unit/epoch are preserved in message metadata when available.

## Output Format

Imports default under:

```text
Notebook/Imports/Phones/<Device Name>/<Import Date>/
```

The generated structure is:

```text
Import Report.html
Device Information.json
Conversations.html
Messages/
  Conversation-001.html
  Conversation-002.html
  Attachments/
    Attachment-001-0001.jpg
Source Metadata/
  ImportManifest.json
```

Conversation filenames are neutral and collision-safe. Full phone numbers are not used in generated filenames. `Conversations.html` links to each generated conversation file. Each conversation HTML document contains readable semantic markup plus an embedded `nodevision-message-archive` JSON script for future search, graph, timeline, contact-linking, and re-import work.

## Privacy And Security Model

Phone backups may contain highly private data. The panel requires acknowledgement before import and warns that imported files become ordinary Notebook files.

Security constraints implemented in this phase:

- No live phone communication or restore operations
- Canonical validation of selected backup directories
- Revalidation of the server-stored backup reference before import
- Read-only SQLite access to `Manifest.db` and copied `sms.db`
- No direct serving of source backup files
- No raw source paths in normal job status responses
- Existing SyncProtection write-protection settings block Phone Import writes unless protection is disabled
- Redacted technical diagnostics returned only inside the panel details section
- Path traversal rejection for backup inputs, Notebook destinations, attachment paths, and generated filenames
- Symlink escape checks when resolving physical backup files and Notebook destinations
- Attachment source paths are resolved only through `Manifest.db`
- Imported text and metadata are HTML escaped
- Attachments are copied, not inlined
- SHA-256 checksums are generated for the copied `sms.db`, attachments, and generated files
- Output is staged outside the Notebook and published only after essential files are created
- Existing destination directories are not overwritten; a collision-safe directory is generated
- Temporary workspaces are private where the filesystem supports POSIX modes and abandoned workspace cleanup is best-effort

The import report includes the source backup path because it is part of provenance and is written only after explicit user import into the Notebook.

## Known iOS Schema Differences

The MVP expects common tables when present:

- `message`
- `handle`
- `chat`
- `chat_message_join`
- `chat_handle_join`
- `attachment`
- `message_attachment_join`

The reader adapts when optional columns such as `subject`, `associated_message_guid`, `associated_message_type`, `service`, or attachment metadata are absent. Rich iMessage payloads not represented as plain text are recorded with placeholders where practical.

## Manual Test Procedure

Use only a disposable or test backup.

1. Start Nodevision normally.
2. Open `File -> Import -> From Phone`.
3. Enter the absolute path to an existing unencrypted iPhone backup directory, or to a parent containing one backup.
4. Click `Scan Backup`.
5. Confirm device metadata and conversation preview appear without message bodies.
6. Filter, sort, select all/none, and select one or more conversations.
7. Confirm the destination under `/Notebook/Imports/Phones`.
8. Acknowledge the privacy warning.
9. Click `Import Selected`.
10. Open the generated `Conversations.html` and `Import Report.html` links.
11. Confirm attachments are copied under `Messages/Attachments` and missing attachments show `[Attachment unavailable]`.
12. Confirm the original backup directory timestamps and contents are unchanged.
13. Test an encrypted backup and confirm the encrypted-backup message appears without partial parsing.

## Future Phases

The service boundaries are intended to allow later providers and artifact importers without coupling the panel directly to Messages parsing:

```text
PhoneAcquisitionProvider
  ExistingBackupProvider
  LibimobiledeviceBackupProvider

PhoneArtifactImporter
  IOSMessagesImporter
  IOSContactsImporter
  IOSPhotosImporter
  IOSNotesImporter
  IOSCallHistoryImporter
```

Live acquisition, encrypted backup support, incremental merges, contact linking, and additional artifact types are intentionally out of scope for this phase.
