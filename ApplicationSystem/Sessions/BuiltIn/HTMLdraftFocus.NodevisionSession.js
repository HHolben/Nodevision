// Nodevision/ApplicationSystem/Sessions/BuiltIn/HTMLdraftFocus.NodevisionSession.js
// This built-in Session launches a locked HTML drafting surface that tracks words added as a focus-game goal while preserving ordinary Notebook documents outside Session state.
// @title HTML Draft Focus Session
// @description A locked-down, gamified HTML drafting Session that blocks deletion, clipboard operations, and cursor navigation while allowing highlight-first bold and strikethrough.
// @source bundled

run("htmlDraftFocus.open");
wait("htmlDraftFocus.finished");

