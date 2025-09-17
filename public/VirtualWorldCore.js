// Nodevision/public/VirtualWorldCore.js
// Purpose: TODO: Add description of module purpose
export async function initVRWorld(container, options = {}) {
  const { mode = "viewing" } = options;

  // === Load Three.js if not already ===
  if (typeof THREE === "undefined") {
    await new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      s.onload = resolve;
      document.body.appendChild(s);
    });
  }

  // === Keyboard controls ===
  async function loadKeyboardControls() {
    try {
      const res = await fetch("/api/load-gamepad-settings");
      const settings = await res.json();
      const actionKeyMap = {};
      for (const [action, mapping] of Object.entries(settings)) {
        if (mapping.keyboard) actionKeyMap[action] = false;
      }
      return { settings, actionKeyMap };
    } catch {
      return {
        settings: {
          "Move Forward": { keyboard: "w" },
          "Move Backward": { keyboard: "s" },
          "Move Left": { keyboard: "a" },
          "Move Right": { keyboard: "d" },
          "Jump": { keyboard: "space" },
        },
        actionKeyMap: {
          "Move Forward": false,
          "Move Backward": false,
          "Move Left": false,
          "Move Right": false,
          "Jump": false,
        },
      };
    }
  }

  const { settings, actionKeyMap } = await loadKeyboardControls();

  // === Three.js scene setup ===
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ canvas: container.querySelector("canvas") });
  renderer.setSize(container.clientWidth, container.clientHeight);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 7.5);
  scene.add(light);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshStandardMaterial({ color: 0x444444 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  camera.position.set(0, 5, 10);

  const objects = [];
  window.VRWorldContext = { scene, objects, THREE, camera, renderer };

  // === Keyboard listeners ===
  document.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    for (const [action, mapping] of Object.entries(settings)) {
      if (mapping.keyboard && mapping.keyboard.toLowerCase() === key) {
        actionKeyMap[action] = true;
      }
    }
  });
  document.addEventListener("keyup", (e) => {
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

    renderer.render(scene, camera);
  };
  animate();

  console.log(`VR World initialized in ${mode} mode.`);
  return { scene, camera, renderer, objects };
}
