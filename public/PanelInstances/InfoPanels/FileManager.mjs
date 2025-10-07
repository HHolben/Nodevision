// Nodevision/public/PanelInstances/InfoPanels/FileManager.mjs
// Loads and displays directory contents inside a dynamically created File Manager panel.

export async function createFileManagerPanel(panelElem, panelVars = {}) {
  console.log("Initializing File Manager panel...", panelVars);

  const currentDir = panelVars.currentDirectory || "/Notebook";

  // Create structure inside the panel
  panelElem.innerHTML = `
    <div class="file-manager-container">
      <div class="file-manager-header">
        <strong>Path:</strong> <span id="fm-path">${currentDir}</span>
      </div>
      <div id="fm-loading" style="display:none;">Loading...</div>
      <div id="fm-error" style="color:red;"></div>
      <ul id="fm-file-list" class="file-list"></ul>
    </div>
  `;

  const fileListElem = panelElem.querySelector("#fm-file-list");
  const loadingElem = panelElem.querySelector("#fm-loading");
  const errorElem = panelElem.querySelector("#fm-error");
  const pathElem = panelElem.querySelector("#fm-path");

  // Fetch directory contents and render them
  await fetchDirectoryContents(currentDir, (files) => {
    displayFiles(fileListElem, files, pathElem);
  }, errorElem, loadingElem);
}

export async function fetchDirectoryContents(path, callback, errorElem, loadingElem) {
  try {
    if (loadingElem) loadingElem.style.display = "block";

    const cleanPath = path.replace(/^\/+/, ''); // remove leading slashes for safety
    const response = await fetch(`/api/files?path=${encodeURIComponent(cleanPath)}`);
    if (!response.ok) throw new Error(`Failed to fetch directory: ${path}`);

    const data = await response.json();
    console.log("Fetched directory contents:", data);
    callback(data);
  } catch (err) {
    console.error(err);
    if (errorElem) errorElem.textContent = err.message;
  } finally {
    if (loadingElem) loadingElem.style.display = "none";
  }
}

export function displayFiles(listElem, files, pathElem) {
  if (!Array.isArray(files)) {
    listElem.innerHTML = "<li>Invalid data received.</li>";
    return;
  }

  listElem.innerHTML = "";

  files.forEach((f) => {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = "#";
    link.textContent = f.name;
    link.classList.add(f.isDirectory ? "folder" : "file");

    link.addEventListener("click", async (e) => {
      e.preventDefault();

      if (f.isDirectory) {
        // Navigate into directory
        const newPath = `${pathElem.textContent}/${f.name}`.replace(/\/+/g, "/");
        pathElem.textContent = newPath;
        await fetchDirectoryContents(newPath, (newFiles) => {
          displayFiles(listElem, newFiles, pathElem);
        });
      } else {
        // Load file info
        try {
          const mod = await import("/panels/InfoPanel.mjs");
          mod.updateInfoPanel(f.name);
        } catch (err) {
          console.error("Failed to load InfoPanel module:", err);
        }
      }
    });

    li.appendChild(link);
    listElem.appendChild(li);
  });
}

export async function moveFileOrDirectory(src, dest) {
  const res = await fetch("/api/files/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ src, dest }),
  });
  return res.json();
}
