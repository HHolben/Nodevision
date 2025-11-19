// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditor.mjs
// Purpose: Provide a simple, fully in-panel SVG editor for Nodevision

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  container.innerHTML = "";

  // --------------------------------------------------
  // Create editor root
  // --------------------------------------------------
  const wrapper = document.createElement("div");
  wrapper.id = "editor-root";
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.height = "100%";
  wrapper.style.width = "100%";
  wrapper.style.overflow = "hidden";
  container.appendChild(wrapper);

  // --------------------------------------------------
  // SVG viewport container
  // --------------------------------------------------
  const svgWrapper = document.createElement("div");
  svgWrapper.style.flex = "1";
  svgWrapper.style.overflow = "auto";
  svgWrapper.style.background = "#fff";
  svgWrapper.style.border = "1px solid #ccc";
  wrapper.appendChild(svgWrapper);

  // The editable SVG root
  const svgElem = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svgElem.id = "svg-editor-root";
  svgElem.style.width = "100%";
  svgElem.style.height = "100%";
  svgElem.style.minHeight = "400px";
  svgElem.style.display = "block";
  svgWrapper.appendChild(svgElem);

  // --------------------------------------------------
  // Load SVG file
  // --------------------------------------------------
  try {
    const res = await fetch(`/Notebook/${filePath}`);
    if (!res.ok) throw new Error(res.statusText);

    const svgText = await res.text();

    // Parse SVG
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const loadedSVG = doc.documentElement;

    // Replace root <svg> with loaded content
    svgElem.replaceWith(loadedSVG);
    loadedSVG.id = "svg-editor-root";
    
  } catch (err) {
    wrapper.innerHTML = `<div style="color:red;padding:12px">Failed to load SVG: ${err.message}</div>`;
    console.error(err);
    return;
  }

  const realSVG = document.getElementById("svg-editor-root");

  // --------------------------------------------------
  // Basic selection logic
  // --------------------------------------------------
  let selectedElement = null;

  function select(el) {
    if (selectedElement) {
      selectedElement.style.outline = "";
    }
    selectedElement = el;
    if (selectedElement) {
      selectedElement.style.outline = "2px solid red";
    }
  }

  realSVG.addEventListener("click", (e) => {
    if (e.target instanceof SVGElement) select(e.target);
  });

  // --------------------------------------------------
  // Provide Nodevision-standard WYSIWYG editor hooks
  // --------------------------------------------------
  window.getEditorHTML = () => {
    // Return serialized SVG as string
    return new XMLSerializer().serializeToString(realSVG);
  };

  window.setEditorHTML = (svgString) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const newSVG = doc.documentElement;

    realSVG.replaceWith(newSVG);
    newSVG.id = "svg-editor-root";
  };

  window.saveWYSIWYGFile = async (path) => {
    const content = window.getEditorHTML();
    await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path || filePath, content }),
    });
    console.log("Saved SVG file:", path || filePath);
  };

  console.log("SVG editor loaded for:", filePath);
}
