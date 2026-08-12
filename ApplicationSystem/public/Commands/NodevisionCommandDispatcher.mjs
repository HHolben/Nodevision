// Nodevision/ApplicationSystem/public/Commands/NodevisionCommandDispatcher.mjs
// This module validates and dispatches shared Nodevision commands for toolbar, console, Session, and future callers.

import { COMMAND_ERROR_CODES, commandError, wrapCommandFailure } from "./CommandErrors.mjs";
import { normalizeCommandArguments } from "./CommandValidation.mjs";
import {
  getNodevisionCommandDefinition,
  getNodevisionCommandDefinitions,
  getNodevisionCommandHandler,
  searchNodevisionCommands,
} from "./NodevisionCommandRegistry.mjs";

export async function dispatchNodevisionCommand(commandId, args = [], context = {}) {
  const id = String(commandId || "").trim();
  const definition = getNodevisionCommandDefinition(id);
  if (!definition) {
    throw commandError(COMMAND_ERROR_CODES.UNKNOWN_COMMAND, `Unknown Nodevision command: ${id || "(empty)"}.`, { commandId: id });
  }
  if (context.requireSessionSafe && definition.sessionSafe !== true) {
    throw commandError(COMMAND_ERROR_CODES.COMMAND_NOT_SESSION_SAFE, `Command ${id} is not available to Sessions.`, { commandId: id });
  }
  const handler = await getNodevisionCommandHandler(id);
  if (typeof handler !== "function") {
    throw commandError(COMMAND_ERROR_CODES.UNKNOWN_COMMAND, `Command ${id} has no registered handler.`, { commandId: id });
  }
  const validatedArgs = normalizeCommandArguments(args, definition);
  try {
    return await handler(validatedArgs, { ...context, command: definition, commandId: id });
  } catch (err) {
    throw wrapCommandFailure(err, id);
  }
}

export function installNodevisionCommandGlobal(target = globalThis.window) {
  if (!target) return null;
  target.NodevisionCommands = {
    run: dispatchNodevisionCommand,
    definitions: getNodevisionCommandDefinitions,
    search: searchNodevisionCommands,
  };
  return target.NodevisionCommands;
}

if (typeof window !== "undefined") installNodevisionCommandGlobal(window);
