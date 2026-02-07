// Nodevision/public/PanelInstances/ViewPanels/GameView.mjs
// ViewPanel that displays a JSON-defined 3D world embedded in an HTML file.

import * as THREE from '/lib/three/three.module.js';
import { PointerLockControls } from '/lib/three/PointerLockControls.js';

export async function setupPanel(panel, instanceVars = {}) {
  console.log("GameView.mjs loaded");

  panel.innerHTML = "";
  panel.style.position = "relative";

  // --- Create Three.js canvas ---
  const canvas = document.createElement("canvas");
  canvas.id = "three-canvas";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  panel.appendChild(canvas);

  let pendingWorldPath = null;
  let controlBindings = null;

  const defaultBindings = {
    moveForward: "w",
    moveBackward: "s",
    moveLeft: "a",
    moveRight: "d",
    jump: "space",
    pause: "escape"
  };

  function normalizeKeyName(key) {
    if (!key) return "";
    const normalized = String(key).toLowerCase().trim();
    if (normalized === " ") return "space";
    if (normalized === "spacebar") return "space";
    return normalized;
  }

  function buildBindingsFromScheme(scheme) {
    const getKey = (action, fallback) => {
      const key = scheme?.[action]?.keyboard;
      return normalizeKeyName(key || fallback);
    };

    return {
      moveForward: getKey("Move Forward", defaultBindings.moveForward),
      moveBackward: getKey("Move Backward", defaultBindings.moveBackward),
      moveLeft: getKey("Move Left", defaultBindings.moveLeft),
      moveRight: getKey("Move Right", defaultBindings.moveRight),
      jump: getKey("Jump", defaultBindings.jump),
      pause: getKey("Pause", defaultBindings.pause)
    };
  }

  async function loadControlScheme() {
    if (controlBindings) return;
    controlBindings = { ...defaultBindings };

    try {
      const res = await fetch("/UserSettings/KeyboardAndControlSchemes/GameControllerSettings.json", {
        cache: "no-store"
      });
      if (!res.ok) {
        console.warn("GameView: control scheme load failed:", res.status, res.statusText);
        return;
      }

      const scheme = await res.json();
      controlBindings = buildBindingsFromScheme(scheme);
    } catch (err) {
      console.warn("GameView: failed to load control scheme:", err);
    }
  }

  function normalizeWorldPath(filePath) {
    if (!filePath) return "";
    const normalized = filePath.replace(/\\/g, "/");
    const notebookMarker = "/Notebook/";
    const idx = normalized.indexOf(notebookMarker);
    if (idx !== -1) {
      return normalized.slice(idx + notebookMarker.length);
    }
    return normalized.replace(/^\/+/, "");
  }

  async function loadWorldFromFile(filePath) {
    console.log("Loading world:", filePath);

    try {
      if (!filePath) return;
      if (!window.VRWorldContext) {
        pendingWorldPath = filePath;
        return;
      }

      const worldPath = normalizeWorldPath(filePath);
      const res = await fetch("/api/load-world", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldPath })
      });

      if (!res.ok) {
        console.warn("World load failed:", res.status, res.statusText);
        return;
      }

      const data = await res.json();
      const worldData = data?.worldDefinition || null;
      if (!worldData || !worldData.objects) {
        console.warn("World has no objects.");
        return;
      }

      const { scene, objects } = window.VRWorldContext;

      // Clear previous meshes
      objects.forEach(obj => scene.remove(obj));
      objects.length = 0;

      // Create objects
      for (const def of worldData.objects) {
        let mesh = null;

        if (def.type === "box") {
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(...def.size),
            new THREE.MeshStandardMaterial({ color: def.color || "#888" })
          );
        } else if (def.type === "sphere") {
          mesh = new THREE.Mesh(
            new THREE.SphereGeometry(def.size[0], 32, 32),
            new THREE.MeshStandardMaterial({ color: def.color || "#888" })
          );
        }

        if (mesh) {
          mesh.position.set(...def.position);
          scene.add(mesh);
          objects.push(mesh);
        }
      }
    } catch (err) {
      console.error("Failed to load world:", err);
    }
  }

  // --- Initialize 3D scene ---
  function initScene() {
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(panel.clientWidth, panel.clientHeight);

    const camera = new THREE.PerspectiveCamera(
      75,
      panel.clientWidth / panel.clientHeight,
      0.1,
      1000
    );

    camera.position.set(0, 5, 10);

    // lights
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 7);
    scene.add(light);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({ color: 0x444444 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const objects = [];

    window.VRWorldContext = {
      THREE,
      scene,
      camera,
      renderer,
      objects,
      loadWorldFromFile
    };

    // --- Controls ---
    const controls = new PointerLockControls(camera, renderer.domElement);
    canvas.addEventListener("click", () => controls.lock());

    // Crosshair
    const crosshair = document.createElement("div");
    crosshair.style.position = "absolute";
    crosshair.style.top = "50%";
    crosshair.style.left = "50%";
    crosshair.style.transform = "translate(-50%, -50%)";
    crosshair.style.width = "20px";
    crosshair.style.height = "20px";
    crosshair.style.border = "2px solid white";
    crosshair.style.borderRadius = "50%";
    crosshair.style.pointerEvents = "none";
    crosshair.style.zIndex = "10";
    panel.appendChild(crosshair);

    // movement
    const heldKeys = {};
    document.addEventListener("keydown", e => heldKeys[normalizeKeyName(e.key)] = true);
    document.addEventListener("keyup", e => heldKeys[normalizeKeyName(e.key)] = false);

    function animate() {
      requestAnimationFrame(animate);

      if (controls.isLocked) {
        const speed = 0.2;
        const bindings = controlBindings || defaultBindings;
        if (heldKeys[bindings.moveForward]) controls.moveForward(speed);
        if (heldKeys[bindings.moveBackward]) controls.moveForward(-speed);
        if (heldKeys[bindings.moveLeft]) controls.moveRight(-speed);
        if (heldKeys[bindings.moveRight]) controls.moveRight(speed);
      }

      renderer.render(scene, camera);
    }

    animate();

    const resizeObserver = new ResizeObserver(() => {
      const w = panel.clientWidth;
      const h = panel.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(panel);
    panel._vrResizeObserver = resizeObserver;

    if (pendingWorldPath) {
      loadWorldFromFile(pendingWorldPath);
      pendingWorldPath = null;
    }
  }

  initScene();
  loadControlScheme();

  const initialPath = instanceVars.filePath || window.selectedFilePath;
  if (initialPath) {
    loadWorldFromFile(initialPath);
  } else {
    console.warn("GameView: no file selected. Select a world HTML under /Notebook.");
  }

  // --- Handle file selection while panel is active ---
  const listener = (e) => {
    const filePath = e.detail.filePath;
    loadWorldFromFile(filePath);
  };

  document.addEventListener("fileSelected", listener);

  // Cleanup if panel is replaced
  panel.cleanup = () => {
    document.removeEventListener("fileSelected", listener);
    if (panel._vrResizeObserver) {
      panel._vrResizeObserver.disconnect();
      panel._vrResizeObserver = null;
    }
  };
}
