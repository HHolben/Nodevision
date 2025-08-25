//Nodevision/public/SwitchToVirtualWorldViewing.js
(function () {
  console.log("SwitchToVirtualWorldViewing.js loaded");

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

  // === Toolbar (Hotbar) ===
  const toolbar = document.createElement('div');
  toolbar.id = 'vr-toolbar';
  toolbar.innerHTML = `
    <div id="hotbar">
      <button data-item="cube">Cube</button>
      <button data-item="sphere">Sphere</button>
      <button data-item="delete">Delete</button>
    </div>
  `;
  toolbar.style.cssText = `
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    background: rgba(0,0,0,0.6);
    padding: 8px;
    border-radius: 5px;
    z-index: 100;
  `;
  container.appendChild(toolbar);

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

      // Build action → key map
      const actionKeyMap = {};
      if (settings && typeof settings === "object") {
        for (const [action, mapping] of Object.entries(settings)) {
          if (mapping.keyboard) {
            actionKeyMap[action] = false; // initialize state
          }
        }
      }

      return { settings, actionKeyMap };
    } catch (err) {
      console.error("Failed to load keyboard controls:", err);
      // Fallback default actions
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

      // === Hotbar actions ===
      document.querySelectorAll('#hotbar button').forEach(btn => {
        btn.addEventListener('click', () => {
          const item = btn.dataset.item;
          if (item === "cube") {
            const geo = new THREE.BoxGeometry();
            const mat = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
            const cube = new THREE.Mesh(geo, mat);
            cube.position.set(Math.random()*4-2,1,Math.random()*4-2);
            scene.add(cube);
            objects.push(cube);
          } else if (item === "sphere") {
            const geo = new THREE.SphereGeometry(0.5, 32, 32);
            const mat = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
            const sphere = new THREE.Mesh(geo, mat);
            sphere.position.set(Math.random()*4-2,1,Math.random()*4-2);
            scene.add(sphere);
            objects.push(sphere);
          } else if (item === "delete") {
            const obj = objects.pop();
            if (obj) scene.remove(obj);
          }
        });
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
