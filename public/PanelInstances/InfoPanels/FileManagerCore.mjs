// Nodevision/public/PanelInstances/InfoPanels/FileManagerCore.mjs
// Core logic for enhanced File Manager panel with breadcrumbs, drag/drop, and back navigation

// ------------------------------
// Fetch directory contents
// ------------------------------
export async function fetchDirectoryContents(path, callback, errorElem, loadingElem) {
  try {
    if (loadingElem) loadingElem.style.display = "block";

    // Treat empty or null as root Notebook folder
    const cleanPath = path?.replace(/^\/+/, '') ?? '';
    const response = await fetch(`/api/files?path=${encodeURIComponent(cleanPath)}`);
    if (!response.ok) throw new Error(`Failed to fetch directory: ${path}`);

    const data = await response.json();
    console.log("Fetched directory contents:", data);

    if (typeof callback === "function") {
      callback(data, cleanPath);
    }

    // Update the global current path for toolbar callbacks
    window.currentDirectoryPath = cleanPath;

  } catch (err) {
    console.error(err);
    if (errorElem) errorElem.textContent = err.message;
  } finally {
    if (loadingElem) loadingElem.style.display = "none";
  }
}

// Make globally available
window.fetchDirectoryContents = fetchDirectoryContents;

// ------------------------------
// Breadcrumbs
// ------------------------------
function renderBreadcrumbs(currentPath) {
  const pathElem = document.getElementById("fm-path");
  pathElem.innerHTML = "";

  const segments = currentPath.split("/").filter(Boolean);

  // Root breadcrumb
  const rootLink = document.createElement("a");
  rootLink.href = "#";
  rootLink.textContent = "Notebook";
  rootLink.addEventListener("click", () =>
    fetchDirectoryContents("", displayFiles, document.getElementById("error"), document.getElementById("loading"))
  );
  pathElem.appendChild(rootLink);

  let cumulativePath = "";
  for (const seg of segments) {
    pathElem.appendChild(document.createTextNode(" / "));
    cumulativePath += "/" + seg;
    const link = document.createElement("a");
    link.href = "#";
    link.textContent = seg;
    link.addEventListener("click", () =>
      fetchDirectoryContents(cumulativePath, displayFiles, document.getElementById("error"), document.getElementById("loading"))
    );
    pathElem.appendChild(link);
  }
}

// ------------------------------
// Display files in panel
// ------------------------------
export function displayFiles(files, currentPath) {
  const listElem = document.getElementById("file-list");
  if (!Array.isArray(files)) {
    listElem.innerHTML = "<li>Invalid data received.</li>";
    return;
  }

  listElem.innerHTML = "";

  // ".." entry — only if not at root
  if (currentPath !== "") {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = "#";
    link.textContent = "..";
    link.classList.add("folder");
    link.addEventListener("click", () => {
      const segments = currentPath.split("/").filter(Boolean);
      segments.pop();
      const newPath = segments.join("/");
      window.refreshFileManager(newPath);
    });
    li.appendChild(link);
    listElem.appendChild(li);
  }

  renderBreadcrumbs(currentPath);

  files.forEach(f => {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = "#";
    if(f.isDirectory)
    {
    link.textContent = "📁  "+f.name;

    }
    else
    {
      
    link.textContent = "🖹  "+f.name;


    }
    link.classList.add(f.isDirectory ? "folder" : "file");

    // Drag & drop for files and directories
    if (!f.isDirectory) {
      link.draggable = true;
      link.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", currentPath + "/" + f.name);
      });
    } else {
      link.addEventListener("dragover", (e) => e.preventDefault());
      link.addEventListener("drop", async (e) => {
        e.preventDefault();
        const srcPath = e.dataTransfer.getData("text/plain");
        const destPath = currentPath + "/" + f.name;
        try {
          await moveFileOrDirectory(srcPath, destPath);
          await window.refreshFileManager(currentPath);
        } catch (err) {
          console.error("Failed to move file:", err);
        }
      });
    }

    // Click: open directory or file info
    link.addEventListener("click", async (e) => {
      e.preventDefault();

      if (f.isDirectory) {
        const newPath = `${currentPath}/${f.name}`.replace(/\/+/g, "/");
        await fetchDirectoryContents(newPath, displayFiles, document.getElementById("error"), document.getElementById("loading"));
      } else {
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

// ------------------------------
// Move file/directory
// ------------------------------
export async function moveFileOrDirectory(src, dest) {
  const res = await fetch("/api/files/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ src, dest }),
  });
  return res.json();
}

// ------------------------------
// Initialize panel
// ------------------------------
export function initFileView(initialPath = '') {
  const loadingElem = document.getElementById("loading");
  const errorElem = document.getElementById("error");

  // Root = empty string internally
  window.currentDirectoryPath = initialPath ?? "";

  fetchDirectoryContents(window.currentDirectoryPath, displayFiles, errorElem, loadingElem);
}

// ------------------------------
// Create new file
// ------------------------------
export async function createNewFile(fileName, currentPath = '') {
  if (!fileName) throw new Error("File name is required");

  const cleanPath = currentPath.replace(/^\/+/, '');
  const fullPath = cleanPath ? `${cleanPath}/${fileName}` : fileName;

  try {
    const res = await fetch("/api/files/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fullPath }),
    });

    if (!res.ok) throw new Error(`Failed to create file: ${fileName}`);
    const result = await res.json();
    console.log("Created new file:", result);

    // Refresh view
    await window.refreshFileManager(cleanPath);

    return result;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// ------------------------------
// Global refresh helper
// ------------------------------
window.refreshFileManager = async function (path = '') {
  try {
    const effectivePath = path ?? window.currentDirectoryPath ?? '';
    const loadingElem = document.getElementById("loading");
    const errorElem = document.getElementById("error");

    console.log("Refreshing File Manager view for:", effectivePath);
    await fetchDirectoryContents(effectivePath, displayFiles, errorElem, loadingElem);
  } catch (err) {
    console.error("Failed to refresh File Manager:", err);
  }
};
