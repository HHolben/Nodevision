// Nodevision/public/SwitchToVirtualWorldViewing.js
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

  // === Initialize scene after Three.js is loaded ===
  const waitForThree = () => {
    if (typeof THREE === "undefined") {
      setTimeout(waitForThree, 100);
      return;
    }

    loadKeyboardControls().then(({ settings, actionKeyMap }) => {
      // === Scene setup ===
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

      // 🔑 Expose VR world context globally for editCallbacks.js
      window.VRWorldContext = { scene, objects, THREE };

      // === Hook toolbar buttons to editCallbacks ===
      import('/ToolbarCallbacks/editCallbacks.js').then(({ editCallbacks }) => {
        document.getElementById('vr-btn-cube').onclick = editCallbacks.vrAddCube;
        document.getElementById('vr-btn-sphere').onclick = editCallbacks.vrAddSphere;
        document.getElementById('vr-btn-delete').onclick = editCallbacks.vrDeleteObject;
      }).catch(err => {
        console.error("Failed to load editCallbacks:", err);
      });

      // === Keyboard event listeners dynamically mapped ===
      document.addEventListener('keydown', e => {
        const key = e.key.toLowerCase();
        for (const [action, mapping] of Object.entries(settings)) {
          if (mapping.keyboard && mapping.keyboard.toLowerCase() === key) {
            actionKeyMap[action] = true;
          }
        }
      });

      document.addEventListener('keyup', e => {
        const key = e.key.toLowerCase();
        for (const [action, mapping] of Object.entries(settings)) {
          if (mapping.keyboard && mapping.keyboard.toLowerCase() === key) {
            actionKeyMap[action] = false;
          }
        }
      });

      // === Animation loop ===
      const animate = () => {
        requestAnimationFrame(animate);

        if (actionKeyMap["Move Forward"]) camera.position.z -= 0.1;
        if (actionKeyMap["Move Backward"]) camera.position.z += 0.1;
        if (actionKeyMap["Move Left"]) camera.position.x -= 0.1;
        if (actionKeyMap["Move Right"]) camera.position.x += 0.1;
        if (actionKeyMap["Jump"]) camera.position.y += 0.1;
        if (actionKeyMap["Pause"]) console.log("Pause action triggered");

        renderer.render(scene, camera);
      };

      animate();
    });
  };

  waitForThree();
})();
