// Nodevision/ApplicationSystem/public/FileViewNavigation/FileViewVisitHistory.test.mjs
// This test validates in-memory FileView back and forward visit stack behavior for the navigation sub-toolbar.

import assert from "node:assert/strict";
import {
  commitFileViewHistoryMove,
  getFileViewHistoryState,
  getFileViewHistoryTarget,
  recordFileViewVisit,
} from "./FileViewVisitHistory.mjs";

recordFileViewVisit("Intro.html", { replace: true });
recordFileViewVisit("Chapter1.html");
recordFileViewVisit("Chapter2.php");

assert.equal(getFileViewHistoryState().currentPath, "Chapter2.php");
assert.equal(getFileViewHistoryTarget("back"), "Chapter1.html");
assert.equal(commitFileViewHistoryMove("back", "Chapter1.html"), true);
assert.equal(getFileViewHistoryState().currentPath, "Chapter1.html");
assert.equal(getFileViewHistoryTarget("forward"), "Chapter2.php");
assert.equal(commitFileViewHistoryMove("forward", "Chapter2.php"), true);
assert.equal(getFileViewHistoryState().currentPath, "Chapter2.php");

recordFileViewVisit("Appendix.html");
assert.equal(getFileViewHistoryTarget("forward"), "");

console.log("FileViewVisitHistory tests passed.");
