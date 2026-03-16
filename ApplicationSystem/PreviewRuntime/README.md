# Preview Runtime (Local Development Only)

This subsystem provides a **development-only** preview runtime for running simple notebook code files from Nodevision:
- Python (`.py`)
- Java (`.java`)
- C++ (`.cpp`)

## Important security warning
This preview runtime uses a **local runner** that executes code on the host using `child_process.spawn()`.

It is **NOT** a hardened sandbox and is **NOT safe** for untrusted or hostile notebooks.

The main Nodevision server **never executes user code**; it forwards jobs to this **separate Preview Runtime service process**.

Future versions may replace the local runner with a stronger isolation boundary (e.g. Firecracker microVMs).

## How it works
1. UI calls `POST /api/preview/run` with `{ filePath, language }` (and optional `timeoutMs`).
2. Nodevision main server validates the path is under `Notebook/`, reads the file, and forwards `{ language, source:{ filePath, content } }` to Preview Runtime.
3. Preview Runtime stages an ephemeral workspace under `workspaceRoot` (default `/tmp/nodevision-preview`), writes the file there, runs it, captures stdout/stderr, and deletes the workspace.

## Starting the Preview Runtime service
Set a shared token for authentication:
- `export NODEVISION_PREVIEW_RUNTIME_TOKEN="dev-secret"`

Start the service (from repo root):
- `node ApplicationSystem/PreviewRuntime/previewRuntimeServer.js`

## Nodevision connection
Nodevision main server forwards requests to:
- `http://127.0.0.1:4010/v1`

Ensure Nodevision main server has the same token in its environment:
- `export NODEVISION_PREVIEW_RUNTIME_TOKEN="dev-secret"`

## Configuration
`ApplicationSystem/PreviewRuntime/previewConfig.js` defaults:
- `workspaceRoot`: `/tmp/nodevision-preview`
- `timeoutMs`: `5000`
- `stdoutLimit`: `100000`
- `stderrLimit`: `100000`

Override via env vars:
- `NODEVISION_PREVIEW_RUNTIME_HOST`, `NODEVISION_PREVIEW_RUNTIME_PORT`
- `NODEVISION_PREVIEW_WORKSPACE_ROOT`
- `NODEVISION_PREVIEW_TIMEOUT_MS`
- `NODEVISION_PREVIEW_STDOUT_LIMIT`, `NODEVISION_PREVIEW_STDERR_LIMIT`
- Tool paths: `NODEVISION_PREVIEW_PYTHON3`, `NODEVISION_PREVIEW_JAVAC`, `NODEVISION_PREVIEW_JAVA`, `NODEVISION_PREVIEW_GPP`

