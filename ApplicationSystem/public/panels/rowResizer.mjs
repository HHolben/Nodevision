// Nodevision/ApplicationSystem/public/panels/rowResizer.mjs
// This file defines browser-side row Resizer logic for the Nodevision UI. It renders interface components and handles user interactions.

export function makeRowsResizable(workspace, { minHeight = 50 } = {}) {
  if (!workspace) return;

  const rows = Array.from(workspace.querySelectorAll(".panel-row"));

  rows.forEach((row, i) => {
    if (i === rows.length - 1) return; // no divider after last row

    const divider = document.createElement("div");
    divider.className = "row-divider";
    divider.style.touchAction = "none";
    divider.style.userSelect = "none";

    row.insertAdjacentElement("afterend", divider);

    const prevRow = row;
    const nextRow = rows[i + 1];

    let isDragging = false;
    let activePointerId = null;
    let startY = 0;
    let startHeightPrev = 0;
    let startHeightNext = 0;

    divider.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (activePointerId !== null) return;
      isDragging = true;
      activePointerId = e.pointerId;
      startY = e.clientY;
      startHeightPrev = prevRow.offsetHeight;
      startHeightNext = nextRow.offsetHeight;
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      divider.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });

    window.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      if (e.pointerId !== activePointerId) return;
      e.preventDefault();
      const delta = e.clientY - startY;

      let newPrev = startHeightPrev + delta;
      let newNext = startHeightNext - delta;

      if (newPrev < minHeight || newNext < minHeight) return;

      prevRow.style.flex = "none";
      nextRow.style.flex = "none";
      prevRow.style.height = newPrev + "px";
      nextRow.style.height = newNext + "px";
    });

    function stopDragging(e) {
      if (!isDragging) return;
      if (e?.pointerId !== undefined && e.pointerId !== activePointerId) return;
      divider.releasePointerCapture?.(activePointerId);
      isDragging = false;
      activePointerId = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
  });
}
