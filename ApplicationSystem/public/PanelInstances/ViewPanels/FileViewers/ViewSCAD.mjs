// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewSCAD.mjs
// SCAD file viewer with a Three.js viewport, orientation widget, source preview, and STL export.

import * as THREE from "/lib/three/three.module.js";
import { OrbitControls } from "/lib/three/OrbitControls.js";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { ViewportOrientationWidget } from "/Widgets/ViewportOrientationWidget.mjs";
import { exportScadCodeToSTL } from "/ModelExport/STLExport.mjs";

function scadViewerUrl(pathValue = "", serverBase = "/Notebook") {
  const base = String(serverBase || "/Notebook").replace(/\/+$/, "");
  const clean = String(pathValue || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "")
    .replace(/^Notebook\/+/, "");
  const encoded = clean.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `${base}/${encoded}`;
}

function viewportSize(element) {
  const rect = element.getBoundingClientRect?.();
  return {
    width: Math.max(1, rect?.width || element.clientWidth || 1),
    height: Math.max(1, rect?.height || element.clientHeight || 1),
  };
}

export async function renderFile(filePath, panel, iframe, serverBase = "/Notebook") {
  const resolvedPath = typeof filePath === "string" ? filePath : filePath?.path || filePath?.filePath || "";
  if (!resolvedPath.toLowerCase().endsWith(".scad")) {
    panel.innerHTML = "<p>No SCAD file selected.</p>";
    return false;
  }

  if (typeof panel?._dispose === "function") {
    try {
      panel._dispose();
    } catch (err) {
      console.warn("[ViewSCAD] Previous viewer cleanup failed:", err);
    }
  }

  panel.innerHTML = "";
  panel.style.cssText = "display:flex;flex-direction:column;gap:8px;width:100%;height:100%;min-width:0;min-height:420px;overflow:hidden;box-sizing:border-box;padding:8px;";
  window.NodevisionModelExportContext = null;
  updateToolbarState({ currentMode: "SCADviewing", activePanelType: "ViewPanel", selectedFile: resolvedPath, modelCanExportSTL: false });

  const toolbar = document.createElement("div");
  toolbar.style.cssText = "display:flex;align-items:center;gap:8px;min-width:0;";
  const title = document.createElement("div");
  title.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 12px/1.35 system-ui,sans-serif;";
  title.textContent = resolvedPath;
  const resetViewBtn = document.createElement("button");
  resetViewBtn.type = "button";
  resetViewBtn.textContent = "Reset View";
  resetViewBtn.style.cssText = "flex:0 0 auto;padding:4px 8px;";
  toolbar.append(title, resetViewBtn);

  const viewer = document.createElement("div");
  viewer.style.cssText = "flex:1;min-height:300px;min-width:0;width:100%;border:1px solid #ccc;position:relative;overflow:hidden;background:#f0f0f0;";
  const loading = document.createElement("div");
  loading.style.cssText = "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(255,255,255,0.86);padding:10px;border-radius:4px;z-index:2;font:12px system-ui,sans-serif;";
  loading.textContent = "Loading...";
  viewer.appendChild(loading);

  const codePre = document.createElement("pre");
  codePre.style.cssText = "white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f9f9f9;border:1px solid #ccc;padding:10px;margin:0;max-height:220px;overflow:auto;";

  panel.append(toolbar, viewer, codePre);

  let scene = null;
  let camera = null;
  let renderer = null;
  let controls = null;
  let orientationWidget = null;
  let resizeObserver = null;
  let animationFrame = 0;
  let disposed = false;
  let scadText = "";
  const initialCameraPosition = new THREE.Vector3(100, 100, 100);
  const initialCameraTarget = new THREE.Vector3(0, 0, 0);

  function resize() {
    if (!renderer || !camera) return;
    const size = viewportSize(viewer);
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    renderer.setSize(size.width, size.height, false);
  }

  function animate() {
    if (disposed || !renderer || !scene || !camera) return;
    controls?.update();
    renderer.render(scene, camera);
    orientationWidget?.sync?.();
    animationFrame = requestAnimationFrame(animate);
  }

  function renderPlaceholderModel() {
    const geometry = new THREE.BoxGeometry(10, 10, 10);
    const material = new THREE.MeshStandardMaterial({ color: 0x1976d2, metalness: 0.3, roughness: 0.7 });
    scene.add(new THREE.Mesh(geometry, material));
  }

  function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    scene.add(new THREE.GridHelper(50, 50));
    scene.add(new THREE.AxesHelper(25));

    const size = viewportSize(viewer);
    camera = new THREE.PerspectiveCamera(45, size.width / size.height, 0.1, 1000);
    camera.position.copy(initialCameraPosition);
    camera.lookAt(initialCameraTarget);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(size.width, size.height, false);
    viewer.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.copy(initialCameraTarget);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(1, 1, 1);
    scene.add(dirLight);

    orientationWidget = new ViewportOrientationWidget({
      container: viewer,
      THREE,
      camera,
      controls,
      viewAdapter: {
        getCamera: () => camera,
        getControls: () => controls,
        getViewportElement: () => viewer,
        requestRender: () => {
          renderer.render(scene, camera);
          return true;
        },
      },
    });
    orientationWidget.mount();

    resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    if (resizeObserver) resizeObserver.observe(viewer);
    else window.addEventListener("resize", resize);

    resetViewBtn.onclick = () => {
      camera.position.copy(initialCameraPosition);
      controls.target.copy(initialCameraTarget);
      controls.update();
      orientationWidget?.sync?.();
    };

    renderPlaceholderModel();
    animate();
  }

  try {
    const response = await fetch(scadViewerUrl(resolvedPath, serverBase), { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    scadText = await response.text();
    codePre.textContent = scadText;
    setupScene();
    loading.remove();

    const exportToken = Symbol("nv-scad-viewer-export-context");
    window.NodevisionModelExportContext = {
      token: exportToken,
      kind: "scad-viewer",
      filePath: resolvedPath,
      exportSTL: () => exportScadCodeToSTL(scadText, resolvedPath),
    };
    updateToolbarState({ currentMode: "SCADviewing", activePanelType: "ViewPanel", selectedFile: resolvedPath, modelCanExportSTL: true });

    panel._dispose = () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener("resize", resize);
      orientationWidget?.destroy?.();
      controls?.dispose?.();
      renderer?.dispose?.();
      if (window.NodevisionModelExportContext?.token === exportToken) {
        window.NodevisionModelExportContext = null;
        updateToolbarState({ modelCanExportSTL: false });
      }
      panel._dispose = null;
    };
  } catch (err) {
    console.error("[ViewSCAD] Error:", err);
    loading.textContent = "SCAD load failed.";
    const error = document.createElement("div");
    error.style.cssText = "color:#b00020;padding:20px;text-align:center;font:12px system-ui,sans-serif;";
    error.textContent = `Error loading SCAD file: ${err?.message || err}`;
    viewer.appendChild(error);
  }

  return true;
}
