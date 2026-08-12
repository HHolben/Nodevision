// Nodevision/ApplicationSystem/public/Commands/CommandErrors.mjs
// This module defines safe, metadata-rich errors for shared Nodevision command dispatch.

export const COMMAND_ERROR_CODES = Object.freeze({
  UNKNOWN_COMMAND: "UNKNOWN_COMMAND",
  COMMAND_NOT_SESSION_SAFE: "COMMAND_NOT_SESSION_SAFE",
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
  COMMAND_EXECUTION_FAILED: "COMMAND_EXECUTION_FAILED",
  UNKNOWN_EVENT: "UNKNOWN_EVENT",
});

export class NodevisionCommandError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "NodevisionCommandError";
    this.code = code;
    Object.assign(this, details);
  }
}

export function commandError(code, message, details = {}) {
  return new NodevisionCommandError(code, message, details);
}

export function wrapCommandFailure(err, commandId) {
  if (err instanceof NodevisionCommandError) return err;
  return commandError(
    COMMAND_ERROR_CODES.COMMAND_EXECUTION_FAILED,
    `Command ${commandId} failed: ${err?.message || err}`,
    { commandId, cause: err },
  );
}
