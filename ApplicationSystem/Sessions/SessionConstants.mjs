// Nodevision/ApplicationSystem/Sessions/SessionConstants.mjs
// This module defines shared constants for Nodevision Session files, storage limits, and the constrained browser protocol used by the Session feature.

export const NODEVISION_SESSION_EXTENSION = ".NodevisionSession";
export const NODEVISION_SESSION_SCRIPT_EXTENSION = ".NodevisionSession.js";
export const NODEVISION_SESSION_API_VERSION = 1;
export const MAX_SESSION_SOURCE_BYTES = 256 * 1024;
export const DEFAULT_SESSION_SOURCE = `// @title New Session
// @description A user-owned Nodevision Session.

let message = "Hello from a Nodevision Session.";
run("overlay.show", message);
wait("session.continue");
`;

