// Nodevision/ApplicationSystem/Sessions/BuiltIn/UppercaseHandwriting.NodevisionSession.js
// This Session opens a local uppercase handwriting experiment and restores the workspace after the user finishes testing single capital letters.
// @title Uppercase Handwriting A–Z
// @description Draw and recognize one capital letter locally, inspect candidates, and save failed drawings as regression fixtures.
// @source bundled

run("uppercaseHandwriting.open");
wait("uppercaseHandwriting.finished");
