// Nodevision/public/ToolbarCallbacks/file/SaveFile.mjs
// Handles saving the currently active file from any supported editor.

export default async function saveFile() {
  const filePath =
    window.currentActiveFilePath ||
    window.filePath ||
    window.selectedFilePath;

  console.log(
    "💾 Saving from source:",
    window.currentActiveFilePath ? "currentActiveFilePath" :
    window.filePath ? "filePath" : "selectedFilePath",
    "→", filePath
  );

  if (!filePath) {
    console.error("Cannot save: filePath is missing.");
    return;
  }

  // 1. SVG editor (Publisher-style)
  const svgEditor = document.getElementById("svg-editor");
  if (svgEditor && typeof window.currentSaveSVG === 'function') {
    console.log("Saving SVG file using Publisher-style editor");
    window.currentSaveSVG();
    return;
  }

  // 2. Legacy SVG editor
  if (svgEditor) {
    console.log("Saving SVG file using legacy direct method");
    const svgContent = svgEditor.outerHTML;

    try {
      const res = await fetch('/api/files/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: svgContent })
      });
      const data = await res.json();

      if (data.success) {
        console.log('SVG file saved successfully:', filePath);
        const messageEl = document.getElementById('svg-message');
        if (messageEl) {
          messageEl.textContent = 'SVG saved successfully!';
          messageEl.style.color = 'green';
        }
      } else {
        console.error('Error saving SVG:', data.error);
      }
    } catch (err) {
      console.error('Error saving SVG file:', err);
    }
    return;
  }
// Nodevision/public/ToolbarCallbacks/file/SaveFile.mjs (Section 3 - Raster Image Editor)

// 3. Raster image editor
if (window.rasterCanvas instanceof HTMLCanvasElement) {
  console.log("Saving raster image file");

  try {
    const canvas = window.rasterCanvas;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const dataURL = canvas.toDataURL("image/png");
    const base64Data = dataURL.replace(/^data:image\/png;base64,/, "");

    // *** FIX: CHANGE ENDPOINT TO THE CORRECT, DYNAMICALLY LOADED /api/save ***
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: filePath,
        content: base64Data,
        encoding: "base64", // Critical for server binary handling
        mimeType: "image/png"
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("🔴 Server Save Failed:", res.status, res.statusText, errorText);
      return;
    }

    const json = await res.json();
    if (json.success) {
      console.log("🟢 Saved PNG successfully:", json.path);
    } else {
      console.error("🔴 Save failed (JSON error):", json.error);
    }

  } catch (err) {
    console.error("🔴 Network/Client Error during save:", err);
  }

  return;
}



  // 4. Code (Monaco) editor
  if (window.monacoEditor && typeof window.monacoEditor.getValue === 'function') {
    const content = window.monacoEditor.getValue();
    try {
      const res = await fetch('/api/files/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content })
      });
      const data = await res.json();
      if (data.success) console.log('Code file saved successfully:', filePath);
      else console.error('Error saving file:', data.error);
    } catch (err) {
      console.error('Error saving code file:', err);
    }
    return;
  }

  // 5. WYSIWYG fallback
  if (typeof window.saveWYSIWYGFile === 'function') {
    console.log("Saving file using WYSIWYG editor");
    window.saveWYSIWYGFile(filePath);
    return;
  }

  console.error("Cannot save: editor state not recognized.");
}
