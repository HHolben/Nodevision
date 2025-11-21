// Nodevision/public/PanelInstances/ViewPanels/GameViewer.mjs
// This crreates a ViewPanel that displays a JSON-defined 3D world mbedded inside an HTML file (<script type="application/json">).

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

  // --- Load Three.js if not present ---
  function ensureScript(src) {
    return new Promise((resolve) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => {
        console.error("Failed to load", src);
        resolve(); 
      };
      document.body.appendChild(s);
    });
  }

  await ensureScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js");
  await ensureScript("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/PointerLockControls.js");

  // --- Extract JSON world embedded in HTML ---
  function extractWorldFromHTML(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");
    const script = doc.querySelector('script[type="application/json"]');
    if (!script) return null;

    try {
      return JSON.parse(script.textContent.trim());
    } catch (err) {
      console.error("Invalid world JSON", err);
      return null;
    }
  }

  async function loadWorldFromFile(filePath) {
    console.log("Loading world:", filePath);

    try {
      const res = await fetch(filePath);
      const text = await res.text();
      const worldData = extractWorldFromHTML(text);
      if (!worldData || !worldData.objects) {
        console.warn("World has no objects.");
        return;
      }

      const { scene, objects, THREE } = window.VRWorldContext;

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

  // --- Initialize 3D scene once THREE is ready ---
  function initScene() {
    if (typeof THREE === "undefined" || !THREE.PointerLockControls) {
      setTimeout(initScene, 100);
      return;
    }

    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ canvas });
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
    const controls = new THREE.PointerLockControls(camera, renderer.domElement);
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
    document.addEventListener("keydown", e => heldKeys[e.key.toLowerCase()] = true);
    document.addEventListener("keyup", e => heldKeys[e.key.toLowerCase()] = false);

    function animate() {
      requestAnimationFrame(animate);

      if (controls.isLocked) {
        const speed = 0.2;
        if (heldKeys["w"]) controls.moveForward(speed);
        if (heldKeys["s"]) controls.moveForward(-speed);
        if (heldKeys["a"]) controls.moveRight(-speed);
        if (heldKeys["d"]) controls.moveRight(speed);
      }

      renderer.render(scene, camera);
    }

    animate();
  }

  initScene();

  // --- Handle file selection while panel is active ---
  const listener = (e) => {
    if (!window.VRWorldContext) return;
    const filePath = e.detail.filePath;
    window.VRWorldContext.loadWorldFromFile(filePath);
  };

  document.addEventListener("fileSelected", listener);

  // Cleanup if panel is replaced
  panel.cleanup = () => {
    document.removeEventListener("fileSelected", listener);
  };
}