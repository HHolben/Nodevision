// Nodevision/ApplicationSystem/Sessions/BuiltIn/ImageStitching.NodevisionSession.js
// Built-in Session wrapper for the landmark-based image-grid stitcher.
// @title Image Stitching
// @description Stitch overlapping photographs using grid-neighbor landmark registration and affine alignment.
// @source bundled

run("imageStitcher.open");
wait("session.imageStitcher.finished");
quit();
