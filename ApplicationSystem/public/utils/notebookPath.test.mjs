// Nodevision/ApplicationSystem/public/utils/notebookPath.test.mjs
// Verifies Notebook path normalization, served URLs, and portable HTML reference resolution.
import {
  getRelativeNotebookReference,
  normalizeNotebookFilePath,
  normalizeNotebookRelativePath,
  resolveNotebookReference,
  splitNotebookReferenceSuffix,
  toNotebookAssetUrl,
  toNotebookDeploymentUrl,
  toPhpDeploymentUrl,
} from "./notebookPath.mjs";

const test = globalThis.Deno?.test
  ? globalThis.Deno.test.bind(globalThis.Deno)
  : (name, fn) => {
      try {
        fn();
        console.log(`ok - ${name}`);
      } catch (err) {
        console.error(`not ok - ${name}`);
        console.error(err);
        if (globalThis.process) globalThis.process.exitCode = 1;
      }
    };

function assertEquals(actual, expected, message = "Values differ") {
  if (actual !== expected) {
    throw new Error(`${message}\nactual:   ${actual}\nexpected: ${expected}`);
  }
}

function assertRelativeRoundTrip(sourcePath, targetPath, expectedReference) {
  const actualReference = getRelativeNotebookReference({ sourcePath, targetPath });
  assertEquals(actualReference, expectedReference, `relative reference for ${sourcePath} -> ${targetPath}`);

  const { pathPart } = splitNotebookReferenceSuffix(targetPath);
  const resolved = resolveNotebookReference({ sourcePath, reference: actualReference });
  assertEquals(resolved, normalizeNotebookRelativePath(pathPart), `reverse resolution for ${actualReference}`);
}

test("normalizeNotebookRelativePath strips Notebook prefix + query/hash", () => {
  assertEquals(
    normalizeNotebookRelativePath("Notebook/music/song.mid?cache=1#t=0"),
    "music/song.mid",
  );
  assertEquals(
    normalizeNotebookRelativePath("/Notebook/music/song.midi"),
    "music/song.midi",
  );
});

test("normalizeNotebookRelativePath normalizes slashes", () => {
  assertEquals(
    normalizeNotebookRelativePath("\\\\Notebook\\foo\\bar.mid"),
    "foo/bar.mid",
  );
  assertEquals(
    normalizeNotebookRelativePath("///Notebook///foo//bar.mid"),
    "foo/bar.mid",
  );
});

test("toNotebookAssetUrl encodes path segments", () => {
  assertEquals(
    toNotebookAssetUrl("my files/Track #1.mid"),
    "/Notebook/my%20files/Track%20%231.mid",
  );
});

test("deployment helpers derive from the provided origin", () => {
  assertEquals(
    toNotebookDeploymentUrl("Notebook/my files/A.php", { origin: "http://10.0.0.5:3001" }),
    "http://10.0.0.5:3001/Notebook/my%20files/A.php",
  );
  assertEquals(
    toPhpDeploymentUrl("/php/my files/A.php?x=1", { origin: "http://10.0.0.5:3001/" }),
    "http://10.0.0.5:3001/php/my%20files/A.php",
  );
});

test("getRelativeNotebookReference handles same directory", () => {
  assertRelativeRoundTrip("Notes/Page.html", "Notes/Image.png", "Image.png");
});

test("getRelativeNotebookReference handles child directory", () => {
  assertRelativeRoundTrip("Notes/Page.html", "Notes/Images/Image.png", "Images/Image.png");
});

test("getRelativeNotebookReference handles parent directory", () => {
  assertRelativeRoundTrip("Notes/Subfolder/Page.html", "Notes/Image.png", "../Image.png");
});

test("getRelativeNotebookReference handles distant sibling directories", () => {
  assertRelativeRoundTrip("Notes/Engineering/Page.html", "Media/Images/Image.png", "../../Media/Images/Image.png");
});

test("getRelativeNotebookReference handles deep nesting", () => {
  assertRelativeRoundTrip(
    "Collection1/AreaA/RangeB/Notes/Page.html",
    "Collection3/Atlases/Images/Map.png",
    "../../../../Collection3/Atlases/Images/Map.png",
  );
});

test("getRelativeNotebookReference encodes spaces and reverses to decoded path", () => {
  assertRelativeRoundTrip(
    "My Notes/Page One.html",
    "Media/My Images/Test Image.png",
    "../Media/My%20Images/Test%20Image.png",
  );
});

test("getRelativeNotebookReference handles unicode filenames", () => {
  assertRelativeRoundTrip(
    "Notes/日誌/Page.html",
    "Media/Imágenes/測試.png",
    "../../Media/Im%C3%A1genes/%E6%B8%AC%E8%A9%A6.png",
  );
});

test("normalizeNotebookFilePath preserves legal filename suffix characters", () => {
  assertEquals(normalizeNotebookFilePath("Media/Images/Chart #1%.png"), "Media/Images/Chart #1%.png");
});

test("getRelativeNotebookReference preserves query and fragment suffix for HTML", () => {
  const reference = getRelativeNotebookReference({
    sourcePath: "Notes/Page.html",
    targetPath: "Media/Images/Chart #1%.png",
    suffix: "?mode=full#figure",
  });
  assertEquals(reference, "../Media/Images/Chart%20%231%25.png?mode=full#figure");
  assertEquals(
    resolveNotebookReference({ sourcePath: "Notes/Page.html", reference }),
    "Media/Images/Chart #1%.png",
  );
});

test("resolveNotebookReference ignores non-Notebook URLs", () => {
  for (const reference of [
    "https://example.com/",
    "mailto:someone@example.com",
    "tel:+15551234567",
    "data:image/png;base64,AAAA",
    "blob:http://localhost/id",
    "#fragment",
  ]) {
    assertEquals(resolveNotebookReference({ sourcePath: "Notes/Page.html", reference }), null, reference);
  }
});

test("resolveNotebookReference rejects traversal outside Notebook", () => {
  assertEquals(resolveNotebookReference({ sourcePath: "Notes/Page.html", reference: "../../outside.txt" }), null);
});
