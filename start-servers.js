// Nodevision/start-servers.js
// Purpose: Launch the Nodevision runtime controller

import { createRuntime } from "./ApplicationSystem/core/runtime.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.NODEVISION_ROOT) {
  process.env.NODEVISION_ROOT = path.dirname(fileURLToPath(import.meta.url));
}

const runtime = createRuntime({
  port: 3000,
  host: "127.0.0.1",
  dev: true,
});

runtime.start().catch((err) => {
  console.error('[start-servers] Failed to start runtime:', err);
  process.exitCode = 1;
});
