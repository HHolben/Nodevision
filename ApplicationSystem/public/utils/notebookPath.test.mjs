import { normalizeNotebookRelativePath, toNotebookAssetUrl } from "./notebookPath.mjs";

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

