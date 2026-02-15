// Nodevision/public/SettingsGameControls.js
// This is a description of module purpose
(function() {

  // Poll every 50ms until the content frame exists
  const checkContainer = setInterval(() => {
    const contentFrame = document.getElementById("content-frame-container");
    if (contentFrame) {
      clearInterval(checkContainer);
      initGamepadUI(contentFrame);
    }
  }, 50);

  async function initGamepadUI(container) {
    // Clear existing content
    container.innerHTML = "";

    // --- Create container for game controls ---
    const ui = document.createElement("div");
    ui.style.padding = "10px";
    ui.style.color = "#0f0";
    ui.style.fontFamily = "monospace";
    ui.style.background = "#111";
    ui.style.height = "100%";
    ui.style.overflowY = "auto";

    const title = document.createElement("h1");
    title.textContent = "Gamepad Calibration";
    title.style.color = "#0ff";
    ui.appendChild(title);

    const instructions = document.createElement("p");
    instructions.textContent = "Click 'Set' next to an action, then press a button or move a stick to bind it.";
    ui.appendChild(instructions);

    // --- Bindings Section ---
    const bindingsDiv = document.createElement("div");
    ui.appendChild(bindingsDiv);

    const statusDiv = document.createElement("div");
    statusDiv.style.marginTop = "10px";
    statusDiv.textContent = "No gamepad detected.";
    ui.appendChild(statusDiv);

    const axesDiv = document.createElement("div");
    axesDiv.style.marginTop = "10px";
    ui.appendChild(axesDiv);

    const buttonsDiv = document.createElement("div");
    buttonsDiv.style.marginTop = "10px";
    ui.appendChild(buttonsDiv);

    // --- Save Button ---
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save Settings";
    saveBtn.style.marginTop = "10px";
    saveBtn.onclick = () => saveBindings();
    ui.appendChild(saveBtn);

    container.appendChild(ui);

    // --- Calibration logic ---
    let gamepadIndex = null;

    const actions = [
      "Move Forward",
      "Move Backward",
      "Move Left",
      "Move Right",
      "Look (Yaw)",
      "Look (Pitch)",
      "Jump",
      "Use",
      "Attack",
      "Inspect/Modify",
      "Cycle Camera",
      "Fly",
      "Open Inventory",
      "Pause"
    ];

    const bindings = {};
    actions.forEach(a => bindings[a] = "Not Set");

    let waitingForAction = null;

    function renderBindings() {
      bindingsDiv.innerHTML = "";
      actions.forEach(action => {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.marginBottom = "6px";

        const label = document.createElement("span");
        label.textContent = `${action}: ${bindings[action]}`;
        label.style.minWidth = "150px";
        row.appendChild(label);

        const btn = document.createElement("button");
        btn.textContent = "Set";
        btn.onclick = () => {
          waitingForAction = action;
          label.style.color = "#ff0";
        };
        row.appendChild(btn);

        bindingsDiv.appendChild(row);
      });
    }

    renderBindings();

    // --- Detect already-connected gamepads ---
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        gamepadIndex = gamepads[i].index;
        statusDiv.textContent = `Gamepad connected: ${gamepads[i].id}`;
        updateLoop();
        break;
      }
    }

    // --- Listen for gamepad connect/disconnect events ---
    window.addEventListener("gamepadconnected", (e) => {
      gamepadIndex = e.gamepad.index;
      statusDiv.textContent = `Gamepad connected: ${e.gamepad.id}`;
      updateLoop();
    });

    window.addEventListener("gamepaddisconnected", (e) => {
      if (e.gamepad.index === gamepadIndex) {
        gamepadIndex = null;
        statusDiv.textContent = "Gamepad disconnected.";
        axesDiv.textContent = "";
        buttonsDiv.textContent = "";
      }
    });

    // --- Update loop for displaying axes/buttons & capturing bindings ---
    function updateLoop() {
      if (gamepadIndex === null) return;

      const gp = navigator.getGamepads()[gamepadIndex];
      if (gp) {
        // Check for calibration input
        if (waitingForAction) {
          gp.buttons.forEach((b, i) => {
            if (b.pressed) {
              bindings[waitingForAction] = `Button ${i}`;
              waitingForAction = null;
              renderBindings();
            }
          });

          gp.axes.forEach((a, i) => {
            if (Math.abs(a) > 0.5) {
              bindings[waitingForAction] = `Axis ${i}`;
              waitingForAction = null;
              renderBindings();
            }
          });
        }

        axesDiv.textContent = gp.axes.map((a, i) => `Axis ${i}: ${a.toFixed(2)}`).join("\n");
        buttonsDiv.innerHTML = gp.buttons.map((b, i) =>
          `Button ${i}: ${b.pressed ? "<span style='color:#ff0'>[PRESSED]</span>" : ""}`
        ).join("<br>");
      }

      requestAnimationFrame(updateLoop);
    }

    // --- Load saved bindings (does not block gamepad detection) ---
    try {
      const res = await fetch("/api/load-gamepad-settings");
      if (res.ok) {
        const savedBindings = await res.json();
        actions.forEach(a => {
          if (savedBindings[a]) bindings[a] = savedBindings[a];
        });
        renderBindings();
      } else {
        console.warn("No saved gamepad settings found:", res.status);
      }
    } catch (err) {
      console.warn("Error fetching saved gamepad settings:", err);
    }

    // --- Save bindings ---
    function saveBindings() {
      fetch("/api/save-gamepad-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bindings)
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) alert("Gamepad settings saved successfully!");
        else alert("Error saving settings: " + data.error);
      })
      .catch(err => {
        console.error(err);
        alert("Error saving settings. See console.");
      });
    }

  }

})();
