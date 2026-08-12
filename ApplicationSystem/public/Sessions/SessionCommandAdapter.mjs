// Nodevision/ApplicationSystem/public/Sessions/SessionCommandAdapter.mjs
// This module adapts the shared Nodevision command dispatcher to the explicit Session-safe command boundary.

import { dispatchNodevisionCommand } from "../Commands/NodevisionCommandDispatcher.mjs";
export {
  getNodevisionCommandDefinitions,
  getSessionSafeCommandDefinitions,
  searchNodevisionCommands,
} from "../Commands/NodevisionCommandRegistry.mjs";

export async function runNodevisionCommand(commandId, args = [], context = {}) {
  return dispatchNodevisionCommand(commandId, args, {
    ...context,
    source: "session",
    requireSessionSafe: true,
  });
}
