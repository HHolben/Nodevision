import { attachSelectionHandlers } from "./FileManagerSelection.mjs";
import { attachDragDrop } from "./FileManagerDragDrop.mjs";

export function renderFiles(state, files) {
  const list = state.panelElem.querySelector("#file-list");
  list.innerHTML = "";

  files.forEach(file => {
    const li = document.createElement("li");
    const link = document.createElement("a");

    link.textContent = `${file.isDirectory ? "📁" : "🖹"} ${file.name}`;
    link.href = "#";
    link.dataset.fullPath =
      state.currentPath ? `${state.currentPath}/${file.name}` : file.name;

    li.appendChild(link);
    list.appendChild(li);

    attachSelectionHandlers(state, link);
    attachDragDrop(state, link, file);
  });
}
