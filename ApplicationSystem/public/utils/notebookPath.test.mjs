// Nodevision/ApplicationSystem/public/utils/notebookPath.test.mjs
// This test module verifies Notebook-relative path normalization and asset URL generation helpers.
import {
  normalizeNotebookRelativePath,
  toNotebookAssetUrl,
  toNotebookDeploymentUrl,
  toPhpDeploymentUrl,
} from "./notebookPath.mjs";

function assertEquals(actual, expected, message = "Values differ") {
  if (actual !== expected) {
    throw new Error(`${message}\nactual:   ${actual}\nexpected: ${expected}`);
  }
}

Deno.test("normalizeNotebookRelativePath strips Notebook prefix + query/hash", () => {
  assertEquals(
    normalizeNotebookRelativePath("Notebook/music/song.mid?cache=1#t=0"),
    "music/song.mid",
  );
  assertEquals(
    normalizeNotebookRelativePath("/Notebook/music/song.midi"),
    "music/song.midi",
  );
});

Deno.test("normalizeNotebookRelativePath normalizes slashes", () => {
  assertEquals(
    normalizeNotebookRelativePath("\\\\Notebook\\foo\\bar.mid"),
    "foo/bar.mid",
  );
  assertEquals(
    normalizeNotebookRelativePath("///Notebook///foo//bar.mid"),
    "foo/bar.mid",
  );
});

Deno.test("toNotebookAssetUrl encodes path segments", () => {
  assertEquals(
    toNotebookAssetUrl("my files/Track #1.mid"),
    "/Notebook/my%20files/Track%20%231.mid",
  );
});

Deno.test("deployment helpers derive from the provided origin", () => {
  assertEquals(
    toNotebookDeploymentUrl("Notebook/my files/A.php", { origin: "http://10.0.0.5:3001" }),
    "http://10.0.0.5:3001/Notebook/my%20files/A.php",
  );
  assertEquals(
    toPhpDeploymentUrl("/php/my files/A.php?x=1", { origin: "http://10.0.0.5:3001/" }),
    "http://10.0.0.5:3001/php/my%20files/A.php",
  );
});
