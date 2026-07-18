// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GifTimelinePanel.mjs
// Horizontal frame timeline component for the GIF graphical editor.

const THUMB_WIDTH = 86;
const THUMB_HEIGHT = 58;

export function renderGifTimelinePanel(container, state = {}, actions = {}) {
  if (!container) return;
  const frames = Array.isArray(state.frames) ? state.frames : [];
  const sourceFrames = Array.isArray(state.sourceFrames) ? state.sourceFrames : [];
  const activeIndex = Number.isFinite(Number(state.currentFrameIndex)) ? Number(state.currentFrameIndex) : 0;
  const restoreTimelineFocus = container === document.activeElement || container.contains(document.activeElement);
  let dragSourceIndex = null;
  let suppressClickUntil = 0;

  container.onkeydown = null;
  container.innerHTML = "";
  container.tabIndex = 0;
  container.setAttribute("role", "region");
  container.setAttribute("aria-label", "GIF frame timeline");
  Object.assign(container.style, {
    display: "flex",
    flexDirection: "column",
    minHeight: "0",
    height: "100%",
    overflow: "hidden",
    borderTop: "1px solid #cfd7e3",
    background: "#f6f8fb",
    color: "#172033",
    userSelect: "none",
  });

  const header = document.createElement("div");
  Object.assign(header.style, {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    padding: "7px 10px 6px",
    borderBottom: "1px solid #dfe4ec",
    font: "600 12px/1.3 system-ui, sans-serif",
  });

  const title = document.createElement("div");
  title.textContent = "GIF Timeline";
  title.style.whiteSpace = "nowrap";
  header.appendChild(title);

  const status = document.createElement("div");
  status.textContent = frames.length ? "Frame " + (activeIndex + 1) + " / " + frames.length : "No frames";
  Object.assign(status.style, {
    color: "#5b6473",
    font: "500 11px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  });
  header.appendChild(status);
  container.appendChild(header);

  const list = document.createElement("div");
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "GIF frames");
  Object.assign(list.style, {
    flex: "1 1 auto",
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    gap: "8px",
    overflowX: "auto",
    overflowY: "hidden",
    padding: "9px 10px 10px",
    minHeight: "0",
  });
  container.appendChild(list);

  if (!frames.length) {
    const empty = document.createElement("div");
    empty.textContent = "No GIF frames loaded.";
    Object.assign(empty.style, {
      padding: "8px",
      color: "#667085",
      font: "12px/1.4 system-ui, sans-serif",
    });
    list.appendChild(empty);
    if (restoreTimelineFocus) requestAnimationFrame(() => container.focus({ preventScroll: true }));
    return;
  }

  frames.forEach((frame, index) => {
    const selected = index === activeIndex;
    const card = document.createElement("button");
    card.type = "button";
    card.dataset.frameIndex = String(index);
    card.draggable = true;
    card.title = "Frame " + (index + 1);
    card.setAttribute("role", "option");
    card.setAttribute("aria-selected", selected ? "true" : "false");
    card.setAttribute("aria-label", "Frame " + (index + 1));
    Object.assign(card.style, {
      flex: "0 0 112px",
      width: "112px",
      minWidth: "112px",
      height: "104px",
      boxSizing: "border-box",
      display: "grid",
      gridTemplateRows: "58px 1fr",
      gap: "6px",
      alignItems: "stretch",
      border: selected ? "2px solid #2f6fdd" : "1px solid #cbd3df",
      borderRadius: "6px",
      background: selected ? "#eaf1ff" : "#ffffff",
      color: "#172033",
      padding: selected ? "6px" : "7px",
      cursor: "grab",
      textAlign: "left",
      boxShadow: selected ? "0 0 0 2px rgba(47, 111, 221, 0.16)" : "0 1px 2px rgba(16, 24, 40, 0.05)",
    });

    const thumbWrap = document.createElement("div");
    Object.assign(thumbWrap.style, {
      width: THUMB_WIDTH + "px",
      height: THUMB_HEIGHT + "px",
      justifySelf: "center",
      border: "1px solid #d9dee8",
      borderRadius: "4px",
      background: "linear-gradient(45deg, #eef1f6 25%, transparent 25%), linear-gradient(-45deg, #eef1f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eef1f6 75%), linear-gradient(-45deg, transparent 75%, #eef1f6 75%)",
      backgroundSize: "12px 12px",
      backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
      overflow: "hidden",
    });
    const canvas = document.createElement("canvas");
    canvas.width = THUMB_WIDTH;
    canvas.height = THUMB_HEIGHT;
    Object.assign(canvas.style, {
      display: "block",
      width: "100%",
      height: "100%",
    });
    thumbWrap.appendChild(canvas);
    card.appendChild(thumbWrap);

    const meta = document.createElement("div");
    Object.assign(meta.style, {
      display: "grid",
      gridTemplateColumns: "1fr auto",
      alignItems: "center",
      gap: "6px",
      minWidth: "0",
    });

    const number = document.createElement("div");
    number.textContent = String(index + 1);
    Object.assign(number.style, {
      font: "700 13px/1.1 system-ui, sans-serif",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    });
    meta.appendChild(number);

    const delay = document.createElement("div");
    delay.textContent = String(frame.delayMs || 100) + " ms";
    Object.assign(delay.style, {
      color: "#606a7a",
      font: "500 10px/1.1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      whiteSpace: "nowrap",
    });
    meta.appendChild(delay);
    card.appendChild(meta);

    drawFrameThumbnail(canvas, sourceFrames[index]?.canvas || null);

    card.addEventListener("click", () => {
      if (Date.now() < suppressClickUntil) return;
      actions.selectFrame?.(index);
      card.focus({ preventScroll: true });
    });

    card.addEventListener("dragstart", (event) => {
      dragSourceIndex = index;
      suppressClickUntil = Date.now() + 350;
      card.style.opacity = "0.62";
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
      }
    });

    card.addEventListener("dragend", () => {
      card.style.opacity = "1";
      suppressClickUntil = Date.now() + 200;
      dragSourceIndex = null;
    });

    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      card.style.borderColor = "#2f6fdd";
    });

    card.addEventListener("dragleave", () => {
      card.style.borderColor = selected ? "#2f6fdd" : "#cbd3df";
    });

    card.addEventListener("drop", (event) => {
      event.preventDefault();
      const raw = event.dataTransfer?.getData("text/plain");
      const from = Number.isFinite(Number(raw)) ? Number(raw) : dragSourceIndex;
      card.style.borderColor = selected ? "#2f6fdd" : "#cbd3df";
      if (Number.isFinite(from) && from !== index) actions.moveFrame?.(from, index);
    });

    list.appendChild(card);
  });

  if (restoreTimelineFocus) {
    requestAnimationFrame(() => {
      const activeCard = list.querySelector('[data-frame-index="' + activeIndex + '"]');
      (activeCard || container).focus({ preventScroll: true });
    });
  }

  container.onkeydown = (event) => {
    if (isTextInput(event.target)) return;
    const index = eventFrameIndex(event, activeIndex);
    const isCopy = (event.ctrlKey || event.metaKey) && String(event.key || "").toLowerCase() === "c";
    const isPaste = (event.ctrlKey || event.metaKey) && String(event.key || "").toLowerCase() === "v";
    const isDelete = event.key === "Delete" || event.key === "Backspace";
    if (isCopy) {
      event.preventDefault();
      actions.copyFrame?.(index);
    } else if (isPaste) {
      event.preventDefault();
      actions.pasteFrame?.(index);
    } else if (isDelete) {
      event.preventDefault();
      actions.deleteFrame?.(index);
    }
  };
}

function drawFrameThumbnail(canvas, sourceCanvas) {
  const ctx = canvas?.getContext?.("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!sourceCanvas) return;
  const sourceWidth = Math.max(1, sourceCanvas.width || 1);
  const sourceHeight = Math.max(1, sourceCanvas.height || 1);
  const scale = Math.min(canvas.width / sourceWidth, canvas.height / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const x = Math.floor((canvas.width - width) / 2);
  const y = Math.floor((canvas.height - height) / 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sourceCanvas, x, y, width, height);
}

function eventFrameIndex(event, fallback) {
  const targetCard = event.target?.closest?.("[data-frame-index]");
  const activeCard = document.activeElement?.closest?.("[data-frame-index]");
  const raw = targetCard?.dataset?.frameIndex ?? activeCard?.dataset?.frameIndex;
  const index = Number(raw);
  return Number.isFinite(index) ? index : fallback;
}

function isTextInput(target) {
  const tag = target?.tagName?.toLowerCase?.() || "";
  return tag === "input" || tag === "textarea" || tag === "select" || Boolean(target?.isContentEditable);
}
