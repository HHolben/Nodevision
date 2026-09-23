// Nodevision/ApplicationSystem/Sessions/BuiltIn/SketchFocus.NodevisionSession.js
// This built-in Session launches a sparse full-screen graphite sketching surface and then saves an interoperable drawing file into the user's Notebook.
// @title Sketch Focus Session
// @description A distraction-free graphite sketching Session for stylus and touchscreen drawing on subtle gray-white paper.
// @source bundled

run("sketchFocus.open");
wait("sketchFocus.finished");
