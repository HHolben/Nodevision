// Nodevision/public/SwitchToVirtualWorldViewing.js

(function () {
  console.log("SwitchToVirtualWorldViewing.js loaded");

  // === Centralized mode state ===
  if (window.AppState && typeof window.AppState.setMode === 'function') {
    window.AppState.setMode('VR World Editing');
  } else {
    window.currentMode = 'VR World Editing';
  }

  const container = document.getElementById('content-frame-container');
  if (!container) {
    console.error("Right pane container not found.");
    return;
  }

  container.innerHTML = ''; // Clear container

  // === Canvas for 3D world ===
  const canvas = document.createElement('canvas');
  canvas.id = 'three-canvas';
  container.appendChild(canvas);

  // === Load Three.js if needed ===
  if (!document.querySelector('script[src*="three.min.js"]')) {
    const s = document.createElement('script');
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    s.defer = true;
    document.body.appendChild(s);
  }

  // === Load PointerLockControls if needed ===
  if (!document.querySelector('script[src*="PointerLockControls.js"]')) {
    const s2 = document.createElement('script');
    s2.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/PointerLockControls.js';
    s2.defer = true;
    document.body.appendChild(s2);
  }

  // === Load user keyboard controls from server ===
  async function loadKeyboardControls() {
    try {
      const res = await fetch('/api/load-gamepad-settings');
      const settings = await res.json();

      const actionKeyMap = {};
      if (settings && typeof settings === "object") {
        for (const [action, mapping] of Object.entries(settings)) {
          if (mapping.keyboard) actionKeyMap[action] = false;
        }
      }
      return { settings, actionKeyMap };
    } catch (err) {
      console.error("Failed to load keyboard controls:", err);
      return {
        settings: {
          "Move Forward": { keyboard: "w" },
          "Move Backward": { keyboard: "s" },
          "Move Left": { keyboard: "a" },
          "Move Right": { keyboard: "d" },
          "Jump": { keyboard: "space" },
          "Pause": { keyboard: "escape" }
        },
        actionKeyMap: {
          "Move Forward": false,
          "Move Backward": false,
          "Move Left": false,
          "Move Right": false,
          "Jump": false,
          "Pause": false
        }
      };
    }
  }

  // === Extract world JSON from HTML ===
  function extractWorldFromHTML(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");
    const script = doc.querySelector('script[type="application/json"]');
    if (!script) return null;
    try {
      return JSON.parse(script.textContent.trim());
    } catch (e) {
      console.error("Invalid world JSON:", e);
      return null;
    }
  }

  // === Load world into scene ===
  async function loadWorldFromFile(filePath) {
    console.log("Loading World from")
    
    try {


      
      const res = await fetch(filePath);
      const text = await res.text();
      const worldData = extractWorldFromHTML(text);

      
console.log("World objects array:", worldData.objects);
if (!worldData) {
  console.warn("No world data found in file:", filePath);
  return;
}



      const { scene, THREE, objects } = window.VRWorldContext;

      // Clear old objects
      objects.forEach(obj => scene.remove(obj));
      objects.length = 0;

      // Add objects from world
      for (const objDef of worldData.objects) {
        let mesh;
        if (objDef.type === "box") {
          const geo = new THREE.BoxGeometry(...objDef.size);
          const mat = new THREE.MeshStandardMaterial({ color: objDef.color || "#888888" });
          mesh = new THREE.Mesh(geo, mat);
        }
        if (objDef.type === "sphere") {
          const geo = new THREE.SphereGeometry(objDef.size[0], 32, 32);
          const mat = new THREE.MeshStandardMaterial({ color: objDef.color || "#888888" });
          mesh = new THREE.Mesh(geo, mat);
        }

        if (mesh) {
          mesh.position.set(...objDef.position);
          scene.add(mesh);
          objects.push(mesh);
        }
      }
    } catch (err) {
      console.error("Failed to load world:", err);
    }
  }
window.loadVirtualWorld = loadWorldFromFile;

  // === Initialize scene after Three.js & controls are loaded ===
  const waitForThree = () => {
    if (typeof THREE === "undefined" || typeof THREE.PointerLockControls === "undefined") {
      setTimeout(waitForThree, 100);
      return;
    }

    loadKeyboardControls().then(({ settings, actionKeyMap }) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ canvas });
      renderer.setSize(container.clientWidth, container.clientHeight);

      const light = new THREE.DirectionalLight(0xffffff, 1);
      light.position.set(5, 10, 7.5);
      scene.add(light);

      const groundGeo = new THREE.PlaneGeometry(50, 50);
      const groundMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);

      camera.position.set(0, 5, 10);

      const objects = [];

      // 🔑 Expose VR world context globally
      window.VRWorldContext = { scene, objects, THREE, camera, renderer, loadWorldFromFile };


      // 🔹 Debug: Load TestWorld.html directly into VR scene
(async () => {
    try {
        const res = await fetch('/Notebook/TestWorld.html');
        const text = await res.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/html");
        const scriptTag = doc.querySelector('script[type="application/json"]');
        if (!scriptTag) {
            console.warn('No world JSON script found in TestWorld.html');
            return;
        }

        const worldData = JSON.parse(scriptTag.textContent.trim());
        console.log('World objects JSON:', worldData.objects);

        // Optional: put objects into the scene immediately
        const { scene, THREE, objects } = window.VRWorldContext;
        objects.forEach(obj => scene.remove(obj));
        objects.length = 0;

        for (const objDef of worldData.objects) {
            let mesh;
            if (objDef.type === "box") {
                const geo = new THREE.BoxGeometry(...objDef.size);
                const mat = new THREE.MeshStandardMaterial({ color: objDef.color || "#888888" });
                mesh = new THREE.Mesh(geo, mat);
            } else if (objDef.type === "sphere") {
                const geo = new THREE.SphereGeometry(objDef.size[0], 32, 32);
                const mat = new THREE.MeshStandardMaterial({ color: objDef.color || "#888888" });
                mesh = new THREE.Mesh(geo, mat);
            }

            if (mesh) {
                mesh.position.set(...objDef.position);
                scene.add(mesh);
                objects.push(mesh);
            }
        }

        console.log(`Loaded ${objects.length} objects into VR scene.`);
    } catch (err) {
        console.error('Error loading TestWorld.html into VR scene:', err);
    }
})();


      // === Toolbar buttons for editing ===
      import('/ToolbarCallbacks/editCallbacks.js').then(({ editCallbacks }) => {
        const cubeBtn = document.getElementById('vr-btn-cube');
        if (cubeBtn) cubeBtn.onclick = editCallbacks.vrAddCube;
        const sphereBtn = document.getElementById('vr-btn-sphere');
        if (sphereBtn) sphereBtn.onclick = editCallbacks.vrAddSphere;
        const delBtn = document.getElementById('vr-btn-delete');
        if (delBtn) delBtn.onclick = editCallbacks.vrDeleteObject;
      }).catch(err => console.error("Failed to load editCallbacks:", err));

      // === PointerLockControls ===
      const controls = new THREE.PointerLockControls(camera, renderer.domElement);

      const info = document.createElement('div');
      info.style.position = 'absolute';
      info.style.top = '10px';
      info.style.left = '10px';
      info.style.color = 'white';
      info.style.background = 'rgba(0,0,0,0.5)';
      info.style.padding = '5px 10px';
      info.textContent = 'Click canvas to enter VR editing. Move mouse to look around.';
      container.appendChild(info);

      canvas.addEventListener('click', () => controls.lock());
      controls.addEventListener('lock', () => info.style.display = 'none');
      controls.addEventListener('unlock', () => info.style.display = 'block');

      container.style.position = 'relative';

      // === Crosshair ===
      const crosshair = document.createElement('div');
      crosshair.id = 'crosshair';
      crosshair.style.position = 'absolute';
      crosshair.style.top = '50%';
      crosshair.style.left = '50%';
      crosshair.style.transform = 'translate(-50%, -50%)';
      crosshair.style.width = '20px';
      crosshair.style.height = '20px';
      crosshair.style.border = '2px solid white';
      crosshair.style.borderRadius = '50%';
      crosshair.style.pointerEvents = 'none';
      crosshair.style.zIndex = '10';
      container.appendChild(crosshair);

      // === Keyboard movement ===
      document.addEventListener('keydown', e => {
        const key = e.key.toLowerCase();
        for (const [action, mapping] of Object.entries(settings)) {
          if (mapping.keyboard && mapping.keyboard.toLowerCase() === key) actionKeyMap[action] = true;
        }
      });

      document.addEventListener('keyup', e => {
        const key = e.key.toLowerCase();
        for (const [action, mapping] of Object.entries(settings)) {
          if (mapping.keyboard && mapping.keyboard.toLowerCase() === key) actionKeyMap[action] = false;
        }
      });

      // === Animation loop ===
      const animate = () => {
        requestAnimationFrame(animate);
        const moveSpeed = 0.2;

        if (controls.isLocked) {
          if (actionKeyMap["Move Forward"]) controls.moveForward(moveSpeed);
          if (actionKeyMap["Move Backward"]) controls.moveForward(-moveSpeed);
          if (actionKeyMap["Move Left"]) controls.moveRight(-moveSpeed);
          if (actionKeyMap["Move Right"]) controls.moveRight(moveSpeed);
          if (actionKeyMap["Jump"]) camera.position.y += moveSpeed;
        }

        renderer.render(scene, camera);
      };

      animate();
    });
  };

  waitForThree();

  // === Hook into file clicks ===
  document.addEventListener("fileSelected", e => {
    if (window.currentMode === "VR World Editing" && window.VRWorldContext) {
      const filePath = e.detail.filePath;
      console.log("Loading world from file:", filePath);
      window.VRWorldContext.loadWorldFromFile(filePath);
    }
  });

})();
