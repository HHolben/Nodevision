// Nodevision/public/SwitchTo3DWorldViewing.js
(function () {
  console.log("SwitchTo3DWorldViewing.js loaded");

  const container = document.getElementById('content-frame-container');
  if (!container) {
    console.error("Right pane container not found.");
    return;
  }

  // Clear the container
  container.innerHTML = '';

  // === Inject the core elements ===
  // Canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'three-canvas';
  container.appendChild(canvas);

  // Pause menu
  const pauseMenu = document.createElement('div');
  pauseMenu.id = 'pause-menu';
  pauseMenu.style.display = 'none';
  pauseMenu.innerHTML = `
    <h2>Paused</h2>
    <label for="world-url">World URL:</label>
    <input type="text" id="world-url" placeholder="Enter world path (e.g., test_world.html)">
    <button id="load-world-btn">Load World</button>
    <button id="resume-btn">Resume</button>
  `;
  container.appendChild(pauseMenu);

  // === Inject the necessary scripts ===
  const scriptFiles = [
    "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
    "3DWorldScene.js",
    "3DWorldPlayer.js",
    "3DWorldControls.js",
    "3DWorldGame.js"
  ];

  scriptFiles.forEach(src => {
    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    document.body.appendChild(s); // append to body so they execute
  });

  // === Inject styles ===
  const style = document.createElement('style');
  style.textContent = `
    body { margin: 0; overflow: hidden; }
    #pause-menu {
      display: none;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 10px;
    }
    #resume-btn {
      background: #4CAF50;
      border: none;
      padding: 10px;
      color: white;
      font-size: 18px;
      cursor: pointer;
      border-radius: 5px;
    }
  `;
  document.head.appendChild(style);

  console.log("3D world elements injected into right pane.");
})();
