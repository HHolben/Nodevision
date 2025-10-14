// Nodevision/public/PanelInstances/InfoPanels/FileManagerCore.mjs
// Core logic for enhanced File Manager panel with breadcrumbs, drag/drop, and back navigation

// Fetch directory contents from the server
// Fetch directory contents from the server
export async function fetchDirectoryContents(path, callback, errorElem, loadingElem) {
  try {
    if (loadingElem) loadingElem.style.display = "block";

    const cleanPath = path.replace(/^\/+/, ''); // remove leading slashes
    const response = await fetch(`/api/files?path=${encodeURIComponent(cleanPath)}`);
    if (!response.ok) throw new Error(`Failed to fetch directory: ${path}`);

    const data = await response.json();
    console.log("Fetched directory contents:", data);

    // Call callback only if it's a function
    if (typeof callback === "function") {
      callback(data, path);
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

// Generate breadcrumbs
function renderBreadcrumbs(currentPath) {
  const pathElem = document.getElementById("fm-path");
  pathElem.innerHTML = "";

  const segments = currentPath.split("/").filter(Boolean);
  const rootLink = document.createElement("a");
  rootLink.href = "#";
  rootLink.textContent = "Notebook";
  rootLink.addEventListener("click", () => fetchDirectoryContents("", displayFiles, document.getElementById("error"), document.getElementById("loading")));
  pathElem.appendChild(rootLink);

  let cumulativePath = "";
  segments.forEach(seg => {
    pathElem.appendChild(document.createTextNode(" / "));
    cumulativePath += "/" + seg;
    const link = document.createElement("a");
    link.href = "#";
    link.textContent = seg;
    link.addEventListener("click", () => fetchDirectoryContents(cumulativePath, displayFiles, document.getElementById("error"), document.getElementById("loading")));
    pathElem.appendChild(link);
  });
}

// Display files in the panel
export function displayFiles(files, currentPath) {
  const listElem = document.getElementById("file-list");
  if (!Array.isArray(files)) {
    listElem.innerHTML = "<li>Invalid data received.</li>";
    return;
  }

  listElem.innerHTML = "";

  // ".." entry to go up one level
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
      fetchDirectoryContents(newPath, displayFiles, document.getElementById("error"), document.getElementById("loading"));
    });
    li.appendChild(link);
    listElem.appendChild(li);
  }

  renderBreadcrumbs(currentPath);

  files.forEach(f => {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = "#";
    link.textContent = f.name;
    link.classList.add(f.isDirectory ? "folder" : "file");

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
          fetchDirectoryContents(currentPath, displayFiles, document.getElementById("error"), document.getElementById("loading"));
        } catch (err) {
          console.error("Failed to move file:", err);
        }
      });
    }

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

// Move files/directories on the server
export async function moveFileOrDirectory(src, dest) {
  const res = await fetch("/api/files/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ src, dest }),
  });
  return res.json();
}

// Initialize File Manager panel
export function initFileView(initialPath = '') {
  const loadingElem = document.getElementById("loading");
  const errorElem = document.getElementById("error");
  fetchDirectoryContents(initialPath, displayFiles, errorElem, loadingElem);
}

// Create a new empty file in the current directory
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

    // Refresh the current view
    const loadingElem = document.getElementById("loading");
    const errorElem = document.getElementById("error");
    await fetchDirectoryContents(cleanPath, displayFiles, errorElem, loadingElem);

    return result;
  } catch (err) {
    console.error(err);
    throw err;
  }
}
