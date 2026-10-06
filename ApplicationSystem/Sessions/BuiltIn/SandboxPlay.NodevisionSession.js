// Nodevision/ApplicationSystem/Sessions/BuiltIn/SandboxPlay.NodevisionSession.js
// This built-in Session opens the selected HTML world with temporary authoring restrictions while retaining normal movement and gameplay interaction.
// @title Sandbox — Play
// @description Explore the same Virtual World with authoring disabled for this Session.
// @source bundled
run("sandbox.open", "play");
wait("sandbox.finished");
