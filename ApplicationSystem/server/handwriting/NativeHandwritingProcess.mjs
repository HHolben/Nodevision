// Nodevision/ApplicationSystem/server/handwriting/NativeHandwritingProcess.mjs
// This module launches the experimental handwriting executable without a shell and converts process failures into structured fallback-safe results.

import { spawn } from "node:child_process";
import { NATIVE_HANDWRITING_LIMITS } from "./NativeHandwritingConfig.mjs";
import { responseError } from "./NativeHandwritingProtocol.mjs";

function minimalChildEnv() {
  if (process.platform === "win32") {
    return {
      SystemRoot: process.env.SystemRoot || "",
      PATH: process.env.PATH || "",
    };
  }
  return {};
}

export async function runNativeJson(executablePath, args, stdinText, timeoutMs) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let finished = false;
    let killedForSize = false;
    const child = spawn(executablePath, args, {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: minimalChildEnv(),
    });
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill("SIGKILL");
      resolve(responseError("NATIVE_TIMEOUT", "The native handwriting engine timed out."));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
      if (Buffer.byteLength(stdout, "utf8") > NATIVE_HANDWRITING_LIMITS.maxResponseBytes && !finished) {
        killedForSize = true;
        finished = true;
        child.kill("SIGKILL");
        clearTimeout(timer);
        resolve(responseError("INVALID_NATIVE_RESPONSE", "The native handwriting engine returned too much output."));
      }
    });
    child.stderr.on("data", (chunk) => {
      if (Buffer.byteLength(stderr, "utf8") < NATIVE_HANDWRITING_LIMITS.maxStderrBytes) stderr += chunk.toString("utf8");
    });
    child.stdin.on("error", () => {});
    child.on("error", () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(responseError("NATIVE_UNAVAILABLE", "The native handwriting engine could not be started."));
    });
    child.on("close", (code, signal) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (killedForSize) return;
      if (code !== 0) {
        resolve(responseError("RECOGNITION_FAILED", "The native handwriting engine exited before returning a valid result.", { diagnostics: stderr ? "stderr" : "" }));
        return;
      }
      resolve({ ok: true, stdout, stderr, signal });
    });
    child.stdin.end(stdinText);
  });
}
