// Nodevision/public/PanelInstances/ViewPanels/ViewSCAD.mjs
// Purpose: Render and display OpenSCAD (.scad) files in a Nodevision view panel using Three.js + CSG

import * as THREE from '/lib/three/three.module.js';
import { OrbitControls } from '/lib/three/OrbitControls.js';


// --------------------------------------------------
// Nodevision FileView entry point
// --------------------------------------------------
export async function renderFile(panel, filePath, instanceVars = {}) {
  const resolvedPath =
    typeof filePath === "string"
      ? filePath
      : filePath?.path || filePath?.filePath || "";

  if (!resolvedPath.endsWith(".scad")) {
    panel.innerHTML = `<p>No SCAD file selected.</p>`;
    return;
  }


  const serverBase = "/Notebook";

  console.log("ViewSCAD: renderFile", filePath);

  // Guard
  if (!filePath || !filePath.endsWith(".scad")) {
    panel.innerHTML = `<p>No SCAD file selected.</p>`;
    return;
  }

  // Reset panel
  panel.innerHTML = `
    <div class="scad-toolbar" style="display:flex;justify-content:space-between;margin-bottom:10px;">
      <div class="scad-filename" style="font-weight:bold;">${filePath}</div>
      <button id="resetViewBtn" style="padding:4px 8px;">Reset View</button>
    </div>

    <div id="scad-viewer"
         style="width:100%;height:400px;border:1px solid #ccc;position:relative;">
      <div id="loading"
           style="position:absolute;top:50%;left:50%;
           transform:translate(-50%,-50%);
           background:rgba(255,255,255,0.8);
           padding:10px;border-radius:4px;">
        Loading...
      </div>
    </div>

    <pre id="scad-code"
         style="white-space:pre-wrap;font-family:monospace;
         background:#f9f9f9;border:1px solid #ccc;
         padding:10px;margin-top:10px;
         max-height:300px;overflow:auto;"></pre>
  `;

  const viewer = panel.querySelector("#scad-viewer");
  const codePre = panel.querySelector("#scad-code");
  const resetViewBtn = panel.querySelector("#resetViewBtn");
  const loading = panel.querySelector("#loading");

  // --------------------------------------------------
  // Three.js state (scoped per render)
  // --------------------------------------------------
  let scene, camera, renderer, controls, resultMesh;
  let resizeObserver;

  const initialCameraPosition = new THREE.Vector3(100, 100, 100);
  const initialCameraTarget = new THREE.Vector3(0, 0, 0);

  // --------------------------------------------------
  // Load SCAD source
  // --------------------------------------------------
  try {
    const response = await fetch(`${serverBase}/${filePath}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const scadText = await response.text();
    codePre.textContent = scadText;

    setupScene();
    renderPlaceholderModel(scadText);

    loading.remove();
  } catch (err) {
    console.error("ViewSCAD error:", err);
    viewer.innerHTML = `
      <div style="color:red;padding:20px;text-align:center;">
        Error loading or rendering SCAD file:<br>
        ${err.message}
      </div>
    `;
  }

  // --------------------------------------------------
  // Scene setup
  // --------------------------------------------------
  function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // Helpers
    scene.add(new THREE.GridHelper(50, 50));
    scene.add(new THREE.AxesHelper(25));

    camera = new THREE.PerspectiveCamera(
      45,
      viewer.clientWidth / viewer.clientHeight,
      0.1,
      1000
    );
    camera.position.copy(initialCameraPosition);
    camera.lookAt(initialCameraTarget);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(viewer.clientWidth, viewer.clientHeight);
    viewer.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.copy(initialCameraTarget);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(1, 1, 1);
    scene.add(dirLight);

    // Animation loop
    const animate = () => {
      if (!renderer) return;
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handling
    resizeObserver = new ResizeObserver(() => {
      if (!renderer) return;
      const { clientWidth, clientHeight } = viewer;
      if (clientWidth && clientHeight) {
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(clientWidth, clientHeight);
      }
    });
    resizeObserver.observe(viewer);

    // Reset view
    resetViewBtn.onclick = () => {
      camera.position.copy(initialCameraPosition);
      controls.target.copy(initialCameraTarget);
      controls.update();
    };
  }

  // --------------------------------------------------
  // Placeholder geometry
  // --------------------------------------------------
  function renderPlaceholderModel(scadText) {
    if (resultMesh) scene.remove(resultMesh);

    const geometry = new THREE.BoxGeometry(10, 10, 10);
    const material = new THREE.MeshStandardMaterial({
      color: 0x1976d2,
      metalness: 0.3,
      roughness: 0.7
    });

    resultMesh = new THREE.Mesh(geometry, material);
    scene.add(resultMesh);

    console.log(
      "Rendered SCAD placeholder, source length:",
      scadText.length
    );
  }

  // --------------------------------------------------
  // Optional cleanup hook (if FileView supports it)
  // --------------------------------------------------
  panel._dispose = () => {
    resizeObserver?.disconnect();
    renderer?.dispose();
    controls?.dispose();
    panel.innerHTML = "";
  };
}
