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

  // === Inject core elements ===
  const canvas = document.createElement('canvas');
  canvas.id = 'three-canvas';
  container.appendChild(canvas);

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

  // === Inject scripts (only once) ===
  const scriptFiles = [
    "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
    "3DWorldScene.js",
    "3DWorldPlayer.js",
    "3DWorldControls.js",
    "3DWorldGame.js"
  ];

  scriptFiles.forEach(src => {
    if (!document.querySelector(`script[src="${src}"]`)) {
      const s = document.createElement('script');
      s.src = src;
      s.defer = true;
      document.body.appendChild(s);
    }
  });

  // === Styles ===
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

  // === Load the selected file automatically ===
  function loadSelectedWorld() {
    const selectedFile = window.currentlySelectedFile; // set by file view
    if (!selectedFile) {
      console.warn("No file selected, use pause menu to load manually.");
      return;
    }

    console.log("3D World will load file:", selectedFile);

    fetch(`/Notebook/${encodeURIComponent(selectedFile)}`)
      .then(res => res.text())
      .then(htmlText => {
        // Parse HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');

        // Extract world data from <script type="application/json" id="world-data">
        const worldScript = doc.querySelector('#world-data');
        if (!worldScript) {
          console.error("No world data found in the file. Use pause menu to load manually.");
          return;
        }

        const worldData = JSON.parse(worldScript.textContent);
        loadWorld(worldData); // existing function from 3DWorldScene.js
        console.log("World loaded from selected file.");
      })
      .catch(err => console.error("Failed to load selected file into 3D world:", err));
  }

  // Wait a short moment to ensure other scripts have initialized
  setTimeout(loadSelectedWorld, 200);
})();
