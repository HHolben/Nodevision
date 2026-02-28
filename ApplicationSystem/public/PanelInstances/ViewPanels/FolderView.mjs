// Nodevision/public/PanelInstances/ViewPanels/FolderView.mjs
// This module defines a panel that shows information about selected folders,
// including folder size and which users/devices have permissions to read,
// write, or edit its contents.

export default class FolderViewPanel {
  constructor(containerEl) {
    this.containerEl = containerEl;
    this.currentFolder = null;
    this.folderInfo = null;
    this.init();
  }

  init() {
    this.containerEl.innerHTML = `
      <div class="folder-view-header">
        <h2 id="folder-name">Select a folder...</h2>
      </div>
      <div class="folder-view-content">
        <div class="folder-size">
          <strong>Folder Size:</strong>
          <span id="folder-size-value">—</span>
        </div>
        <div class="folder-permissions">
          <strong>Permissions:</strong>
          <ul id="permissions-list"></ul>
        </div>
      </div>
    `;
  }

  async loadFolder(folderPath) {
    this.currentFolder = folderPath;
    document.getElementById("folder-name").textContent = folderPath;
    await this.fetchFolderInfo(folderPath);
    this.render();
  }

  async fetchFolderInfo(folderPath) {
    try {
      const response = await fetch(`/folder/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: folderPath })
      });

      if (!response.ok) throw new Error("Failed to fetch folder info");
      this.folderInfo = await response.json();
    } catch (err) {
      console.error("Error fetching folder info:", err);
      this.folderInfo = null;
    }
  }

  render() {
    const sizeEl = document.getElementById("folder-size-value");
    const permList = document.getElementById("permissions-list");

    if (!this.folderInfo) {
      sizeEl.textContent = "Error";
      permList.innerHTML = `<li>Unable to load permissions</li>`;
      return;
    }

    // Render Folder Size
    sizeEl.textContent = this.folderInfo.size || "0 B";

    // Render Permissions
    permList.innerHTML = "";
    if (this.folderInfo.permissions && this.folderInfo.permissions.length > 0) {
      this.folderInfo.permissions.forEach(p => {
        const li = document.createElement("li");
        li.textContent = `${p.device || p.user} — ${p.access}`;
        permList.appendChild(li);
      });
    } else {
      permList.innerHTML = `<li>No permissions assigned</li>`;
    }
  }
}