import { moveFileOrDirectory } from "./FileManagerAPI.mjs";

export function attachDragDrop(state, link, file) {
  if (!file.isDirectory) {
    link.draggable = true;
    link.ondragstart = e =>
      e.dataTransfer.setData("text/plain", link.dataset.fullPath);
  } else {
    link.ondragover = e => e.preventDefault();
    link.ondrop = async e => {
      e.preventDefault();
      await moveFileOrDirectory(
        e.dataTransfer.getData("text/plain"),
        link.dataset.fullPath
      );
      state.refresh();
    };
  }
}
