// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/FileManagerDependencies.mjs/FileManagerDragDrop.mjs
// This file defines browser-side File Manager Drag Drop logic for the Nodevision UI. It renders interface components and handles user interactions.
import { moveFileOrDirectory } from "./FileManagerAPI.mjs";
import { maybePromptLinkMoveImpact } from "/ToolbarCallbacks/file/linkMoveImpact.mjs";

export function attachDragDrop(state, link, file) {
  if (!file.isDirectory) {
    link.draggable = true;
    link.ondragstart = e =>
      e.dataTransfer.setData("text/plain", link.dataset.fullPath);
  } else {
    link.ondragover = e => e.preventDefault();
    link.ondrop = async e => {
      e.preventDefault();
      const moved = await moveFileOrDirectory(
        e.dataTransfer.getData("text/plain"),
        link.dataset.fullPath
      );
      state.refresh();
      if (moved?.source && moved?.destination) {
        await maybePromptLinkMoveImpact({ oldPath: moved.source, newPath: moved.destination });
      }
    };
  }
}
