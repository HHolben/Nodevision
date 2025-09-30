// Nodevision/public/panels/rowResizer.mjs
//This module is used to make horizontal divider bars work.
// Nodevision/public/panels/rowResizer.mjs

export function makeRowsResizable(workspace, { minHeight = 50 } = {}) {
  if (!workspace) return;

  const rows = Array.from(workspace.querySelectorAll(".panel-row"));

  rows.forEach((row, i) => {
    if (i === rows.length - 1) return; // no divider after last row

    const divider = document.createElement("div");
    divider.className = "row-divider";

    row.insertAdjacentElement("afterend", divider);

    const prevRow = row;
    const nextRow = rows[i + 1];

    let isDragging = false;
    let startY = 0;
    let startHeightPrev = 0;
    let startHeightNext = 0;

    divider.addEventListener("mousedown", (e) => {
      isDragging = true;
      startY = e.clientY;
      startHeightPrev = prevRow.offsetHeight;
      startHeightNext = nextRow.offsetHeight;
      document.body.style.cursor = "row-resize";
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const delta = e.clientY - startY;

      let newPrev = startHeightPrev + delta;
      let newNext = startHeightNext - delta;

      if (newPrev < minHeight || newNext < minHeight) return;

      prevRow.style.flex = "none";
      nextRow.style.flex = "none";
      prevRow.style.height = newPrev + "px";
      nextRow.style.height = newNext + "px";
    });

    window.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = "default";
      }
    });
  });
}
