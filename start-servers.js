// Nodevision/start-servers.js
// Purpose: Launch the Nodevision runtime controller

import { createRuntime } from "./ApplicationSystem/core/runtime.js";

const runtime = createRuntime({
  port: 3000,
  host: "127.0.0.1",
  dev: true,
});

runtime.start().catch((err) => {
  console.error('[start-servers] Failed to start runtime:', err);
  process.exitCode = 1;
});
