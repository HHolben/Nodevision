// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/STLeditor.mjs
// Provides an STL editing environment inside a Nodevision editor panel.

import { renderSTL } from "../../ViewPanels/FileViewers/ViewSTL.mjs";

// Stores per-file transform state
const editorState = new Map();

/**
 * Nodevision graphical editor entry point.
 */
export async function renderEditor(filePath, container, iframe, serverBase = "") {
  try {
    console.log(filePath)
    container.innerHTML = "";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.height = "100%";
    container.style.position = "relative";

    // --- TOOLBAR --------------------------------------------------------------
    const toolbar = createToolbar();
    container.appendChild(toolbar);

    // --- VIEWPORT -------------------------------------------------------------
    const viewport = document.createElement("div");
    viewport.style.flex = "1";
    viewport.style.position = "relative";
    container.appendChild(viewport);

    // Ensure default transform state exists
    if (!editorState.has(filePath)) {
      editorState.set(filePath, {
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1,
      });
    }

    // Load STL viewer
    await loadModel();

    // ──────────────────────────────────────────────────────────────────────────
    // INTERNAL FUNCTIONS
    // ──────────────────────────────────────────────────────────────────────────

    async function loadModel(keepTransforms = true) {
      try {
        console.log(`[STLeditor] Loading STL: ${filePath}`);
await renderSTL(filePath, viewport, "/Notebook"); // Don't prepend slash to filePath

        const canvas = viewport.querySelector("canvas");
        const scene = canvas?.rendererScene;

        if (!scene) {
          console.warn("[STLeditor] Scene not found in renderer.");
          return;
        }

        const mesh = scene.children.find(o => o.userData?.isModel);
        if (!mesh) {
          console.warn("[STLeditor] Model mesh not found in scene.");
          return;
        }

        if (keepTransforms) applyStoredTransforms(mesh);
      } catch (err) {
        console.error(`[STLeditor] Error loading model for ${filePath}:`, err);
      }
    }

    function currentMesh() {
      try {
        const canvas = viewport.querySelector("canvas");
        const scene = canvas?.rendererScene;
        return scene?.children.find(o => o.userData?.isModel) || null;
      } catch (err) {
        console.error("[STLeditor] Error retrieving current mesh:", err);
        return null;
      }
    }

    function applyStoredTransforms(mesh = currentMesh()) {
      try {
        if (!mesh) return;
        const t = editorState.get(filePath);
        mesh.rotation.set(t.rotation.x, t.rotation.y, t.rotation.z);
        mesh.scale.set(t.scale, t.scale, t.scale);
      } catch (err) {
        console.error("[STLeditor] Error applying transforms:", err);
      }
    }

    function updateRotation(rx, ry, rz) {
      try {
        const st = editorState.get(filePath);
        st.rotation.x += rx;
        st.rotation.y += ry;
        st.rotation.z += rz;
        applyStoredTransforms();
      } catch (err) {
        console.error("[STLeditor] Error updating rotation:", err);
      }
    }

    function updateScale(multiplier) {
      try {
        const st = editorState.get(filePath);
        st.scale *= multiplier;
        applyStoredTransforms();
      } catch (err) {
        console.error("[STLeditor] Error updating scale:", err);
      }
    }

    function resetModel() {
      try {
        editorState.set(filePath, {
          rotation: { x: 0, y: 0, z: 0 },
          scale: 1,
        });
        loadModel(false); // reload, drop transforms
      } catch (err) {
        console.error("[STLeditor] Error resetting model:", err);
      }
    }

    function recenterModel() {
      try {
        loadModel(false); // reload fresh
      } catch (err) {
        console.error("[STLeditor] Error recentering model:", err);
      }
    }

    async function saveSTL() {
      try {
        const mesh = currentMesh();
        if (!mesh) return alert("No model loaded.");

        const exporter = new STLExporter();
        const stlData = exporter.parse(mesh);

        const resp = await fetch(`${serverBase}/saveSTL`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: filePath, data: stlData }),
        });

        if (!resp.ok) throw new Error(`Server returned ${resp.status}`);

        alert("STL saved successfully!");
      } catch (err) {
        console.error(`[STLeditor] Error saving STL (${filePath}):`, err);
        alert("Failed to save STL. See console for details.");
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TOOLBAR UI
    // ──────────────────────────────────────────────────────────────────────────

    function createToolbar() {
      const bar = document.createElement("div");
      bar.style.display = "flex";
      bar.style.gap = "8px";
      bar.style.padding = "6px";
      bar.style.background = "#eee";
      bar.style.borderBottom = "1px solid #ccc";

      bar.append(
        button("Recenter", recenterModel),
        button("Rotate X", () => updateRotation(Math.PI / 12, 0, 0)),
        button("Rotate Y", () => updateRotation(0, Math.PI / 12, 0)),
        button("Rotate Z", () => updateRotation(0, 0, Math.PI / 12)),
        button("Scale +", () => updateScale(1.1)),
        button("Scale –", () => updateScale(0.9)),
        button("Reset", resetModel),
        button("Save", saveSTL)
      );

      return bar;
    }

    function button(label, action) {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.padding = "4px 10px";
      b.style.border = "1px solid #999";
      b.style.background = "#fafafa";
      b.style.cursor = "pointer";
      b.addEventListener("click", action);
      return b;
    }

  } catch (err) {
    console.error(`[STLeditor] Critical error initializing editor for ${filePath}:`, err);
    container.innerHTML = `<em>Error initializing STL editor. Check console for details.</em>`;
  }
}
