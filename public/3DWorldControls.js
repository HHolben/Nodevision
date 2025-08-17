// Nodevision/public/3DWorldControls.js
(function() {
  // === Scoped Variables ===
  const defaultKeys = { w: "w", a: "a", s: "s", d: "d", j: "j", q: "q" };
  let keys = { w: false, a: false, s: false, d: false, j: false, q: false };
  let isPaused = false;
  let yaw = 0, pitch = 0;
  const mouseSensitivity = 0.0015;
  let targetYaw = 0;
  let targetPitch = 0;
  const smoothingFactor = 0.1;

  // Gamepad state
  let gamepadIndex = null;

  // Saved bindings
  let savedBindings = null; // wait until loaded

  // Load saved bindings from server
  fetch("/api/load-gamepad-settings")
    .then(res => res.json())
    .then(json => {
      savedBindings = json || {};
      console.log("✅ Loaded gamepad bindings from JSON:");
      console.table(savedBindings);
    })
    .catch(err => {
      console.warn("No saved gamepad settings found:", err);
      savedBindings = {}; // fallback
    });

  // Mouse Lock
  document.body.addEventListener("click", () => document.body.requestPointerLock());
  document.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement) {
      targetYaw -= event.movementX * mouseSensitivity;
      targetPitch -= event.movementY * mouseSensitivity;
      targetPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetPitch));
    }
  });

  // Gamepad connect/disconnect
  window.addEventListener("gamepadconnected", e => { gamepadIndex = e.gamepad.index; });
  window.addEventListener("gamepaddisconnected", e => { if(gamepadIndex === e.gamepad.index) gamepadIndex = null; });

  // === Helpers ===
  function parseBinding(gp, binding) {
    if (!binding) return false;
    if (binding.startsWith("Button")) {
      const index = parseInt(binding.split(" ")[1]);
      return gp.buttons[index]?.pressed;
    } else if (binding.startsWith("Axis")) {
      const index = parseInt(binding.split(" ")[1]);
      const val = gp.axes[index] || 0;
      return Math.abs(val) > 0.5;
    }
    return false;
  }

  function getAxisValue(gp, binding, deadzone) {
    if (!binding || !binding.startsWith("Axis")) return 0;
    const index = parseInt(binding.split(" ")[1], 10);
    const val = gp.axes[index] || 0;
    return Math.abs(val) > deadzone ? val : 0;
  }

  let lastButtonStates = [];
  let lastAxisStates = [];

  function handleGamepadInput() {
    if (gamepadIndex === null) return; // No gamepad connected
    if (!savedBindings) return;       // wait until JSON is loaded

    const gp = navigator.getGamepads()[gamepadIndex];
    if (!gp) return;

    // --- Debugging: log changes only ---
    const buttonsPressed = gp.buttons.map(b => b.pressed);
    const axesValues = gp.axes.map(a => a.toFixed(2));

    if (buttonsPressed.toString() !== lastButtonStates.toString()) {
      console.log("Buttons pressed:", buttonsPressed);
      lastButtonStates = buttonsPressed;
    }

    if (axesValues.toString() !== lastAxisStates.toString()) {
      console.log("Axes values:", axesValues);
      lastAxisStates = axesValues;
    }

    // --- Apply JSON bindings ---
    const move = { w: false, a: false, s: false, d: false, j: false };

    // Movement
    if (savedBindings["Move Forward"] && parseBinding(gp, savedBindings["Move Forward"])) move.w = true;
    if (savedBindings["Move Backward"] && parseBinding(gp, savedBindings["Move Backward"])) move.s = true;
    if (savedBindings["Move Left"] && parseBinding(gp, savedBindings["Move Left"])) move.a = true;
    if (savedBindings["Move Right"] && parseBinding(gp, savedBindings["Move Right"])) move.d = true;
    if (savedBindings["Jump"] && parseBinding(gp, savedBindings["Jump"])) move.j = true;

    // Camera look
    if (savedBindings["Look (Yaw)"]) {
      targetYaw -= getAxisValue(gp, savedBindings["Look (Yaw)"], 0.1) * 0.04;
    }
    if (savedBindings["Look (Pitch)"]) {
      targetPitch -= getAxisValue(gp, savedBindings["Look (Pitch)"], 0.1) * 0.04;
      targetPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetPitch));
    }

    // Pause
    if (savedBindings["Pause"] && parseBinding(gp, savedBindings["Pause"]) && !isPaused) togglePause();

    // --- Apply movement ---
    updatePlayerMovement(move);
  }

  // Animate loop
  function animate() {
    requestAnimationFrame(animate);
    if (!isPaused) {
      handleGamepadInput();
      yaw += (targetYaw - yaw) * smoothingFactor;
      pitch += (targetPitch - pitch) * smoothingFactor;

      player.rotation.y = yaw;
      camera.rotation.x = pitch;
    }
    renderer.render(scene, camera);
  }
  animate();

  // Pause
  function togglePause() {
    isPaused = !isPaused;
    document.exitPointerLock();
    document.getElementById("pause-menu").style.display = isPaused ? "block" : "none";
  }

  // Keyboard
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") togglePause();
    else {
      for (const k in defaultKeys) {
        const mapped = savedBindings?.[k] || defaultKeys[k];
        if (event.key.toLowerCase() === mapped?.toLowerCase()) {
          if (k === "j") event.preventDefault();
          keys[k] = true;
        }
      }
    }
  });

  document.addEventListener("keyup", (event) => {
    for (const k in defaultKeys) {
      const mapped = savedBindings?.[k] || defaultKeys[k];
      if (event.key.toLowerCase() === mapped?.toLowerCase()) keys[k] = false;
    }
  });

})();
