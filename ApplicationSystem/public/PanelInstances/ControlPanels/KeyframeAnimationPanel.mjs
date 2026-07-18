// Nodevision/ApplicationSystem/public/PanelInstances/ControlPanels/KeyframeAnimationPanel.mjs
// Control panel for setting GLB object keyframes from the layers list.

function getContext() {
  return window.KeyframeAnimationContext || null;
}

function numericTime(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n * 1000) / 1000);
}

function formatNumber(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function formatTime(value) {
  return formatNumber(value, 3) + "s";
}

function formatPosition(pos = {}) {
  return [pos.x, pos.y, pos.z].map((value) => formatNumber(value, 2)).join(", ");
}

function styleButton(button, variant = "plain") {
  Object.assign(button.style, {
    height: "26px",
    padding: "0 9px",
    border: variant === "primary" ? "1px solid #255fb8" : "1px solid #c3cad6",
    borderRadius: "5px",
    background: variant === "primary" ? "#2f6fdd" : "#ffffff",
    color: variant === "primary" ? "#ffffff" : "#172033",
    font: "600 11px/1 system-ui, sans-serif",
    cursor: "pointer",
    whiteSpace: "nowrap",
  });
  return button;
}

function createButton(label, variant = "plain") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  return styleButton(button, variant);
}

function render(panel) {
  const ctx = getContext();
  panel.innerHTML = "";
  panel.tabIndex = 0;
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", "KeyframeAnimation panel");
  Object.assign(panel.style, {
    display: "flex",
    flexDirection: "column",
    minHeight: "0",
    height: "100%",
    overflow: "hidden",
    borderTop: "1px solid #cfd7e3",
    background: "#f6f8fb",
    color: "#172033",
    font: "12px/1.35 system-ui, -apple-system, Segoe UI, sans-serif",
  });

  if (!ctx?.getState) {
    const message = document.createElement("div");
    message.textContent = "Open a GLB editor to set layer keyframes.";
    Object.assign(message.style, {
      padding: "12px",
      color: "#7a2632",
      font: "12px/1.35 system-ui, sans-serif",
    });
    panel.appendChild(message);
    return;
  }

  const state = ctx.getState() || {};
  const layers = Array.isArray(state.layers) ? state.layers : [];
  const keyframes = Array.isArray(state.keyframes) ? state.keyframes : [];
  const selectedUuids = new Set(Array.isArray(state.selectedUuids) ? state.selectedUuids : []);
  const currentTime = numericTime(state.currentTime, 0);
  const keyframeCountByUuid = new Map();
  keyframes.forEach((keyframe) => keyframeCountByUuid.set(keyframe.uuid, (keyframeCountByUuid.get(keyframe.uuid) || 0) + 1));

  const header = document.createElement("div");
  Object.assign(header.style, {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "7px 10px 6px",
    borderBottom: "1px solid #dfe4ec",
    minWidth: "0",
  });

  const title = document.createElement("div");
  title.textContent = "KeyframeAnimation";
  Object.assign(title.style, {
    font: "700 12px/1.25 system-ui, sans-serif",
    whiteSpace: "nowrap",
  });
  header.appendChild(title);

  const meta = document.createElement("div");
  meta.textContent = layers.length + " layer" + (layers.length === 1 ? "" : "s") + " / " + keyframes.length + " keyframe" + (keyframes.length === 1 ? "" : "s");
  Object.assign(meta.style, {
    color: "#606a7a",
    font: "500 11px/1.25 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  });
  header.appendChild(meta);

  const spacer = document.createElement("div");
  spacer.style.flex = "1 1 auto";
  header.appendChild(spacer);

  const timeLabel = document.createElement("label");
  Object.assign(timeLabel.style, {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    whiteSpace: "nowrap",
    color: "#4b5565",
    font: "600 11px/1.2 system-ui, sans-serif",
  });
  timeLabel.textContent = "Time";
  const timeInput = document.createElement("input");
  timeInput.type = "number";
  timeInput.min = "0";
  timeInput.step = "0.1";
  timeInput.value = String(currentTime);
  Object.assign(timeInput.style, {
    width: "78px",
    height: "24px",
    boxSizing: "border-box",
    border: "1px solid #c3cad6",
    borderRadius: "4px",
    padding: "0 6px",
    font: "11px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  });
  timeInput.addEventListener("change", () => ctx.setCurrentTime?.(numericTime(timeInput.value, currentTime)));
  timeLabel.appendChild(timeInput);
  header.appendChild(timeLabel);

  const setSelected = createButton("Set Selected", "primary");
  setSelected.disabled = selectedUuids.size === 0;
  setSelected.style.opacity = selectedUuids.size === 0 ? "0.55" : "1";
  setSelected.addEventListener("click", () => ctx.setKeyframesForSelected?.(numericTime(timeInput.value, currentTime)));
  header.appendChild(setSelected);

  const close = createButton("Close");
  close.addEventListener("click", () => ctx.hidePanel?.());
  header.appendChild(close);
  panel.appendChild(header);

  const body = document.createElement("div");
  Object.assign(body.style, {
    flex: "1 1 auto",
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1.15fr) minmax(220px, 0.85fr)",
    gap: "10px",
    minHeight: "0",
    padding: "9px 10px 10px",
    overflow: "hidden",
  });
  panel.appendChild(body);

  const layerPane = createPane("Layers");
  const keyframePane = createPane("Keyframes");
  body.appendChild(layerPane.wrap);
  body.appendChild(keyframePane.wrap);

  if (!layers.length) {
    appendEmpty(layerPane.content, "No layers are available for keyframing.");
  } else {
    layers.forEach((layer) => {
      const selected = selectedUuids.has(layer.uuid);
      const count = keyframeCountByUuid.get(layer.uuid) || layer.keyframeCount || 0;
      const row = document.createElement("div");
      Object.assign(row.style, {
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        gap: "8px",
        padding: "6px 7px",
        borderBottom: "1px solid #ebedf2",
        background: selected ? "#eaf1ff" : "#ffffff",
        cursor: "pointer",
        minWidth: "0",
      });
      row.addEventListener("click", () => ctx.selectLayer?.(layer.uuid, { focus: true }));

      const info = document.createElement("div");
      Object.assign(info.style, { minWidth: "0" });
      const name = document.createElement("div");
      name.textContent = layer.label || "Layer";
      Object.assign(name.style, {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        font: "700 12px/1.2 system-ui, sans-serif",
      });
      info.appendChild(name);
      const sub = document.createElement("div");
      sub.textContent = (layer.type || "Object3D") + " / " + formatPosition(layer.pos) + " / " + count + " key" + (count === 1 ? "" : "s");
      Object.assign(sub.style, {
        color: "#667085",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        font: "500 10px/1.25 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      });
      info.appendChild(sub);
      row.appendChild(info);

      const keyButton = createButton("Key", selected ? "primary" : "plain");
      keyButton.addEventListener("click", (event) => {
        event.stopPropagation();
        ctx.setKeyframe?.(layer.uuid, numericTime(timeInput.value, currentTime));
      });
      row.appendChild(keyButton);
      layerPane.content.appendChild(row);
    });
  }

  if (!keyframes.length) {
    appendEmpty(keyframePane.content, "No keyframes have been set.");
  } else {
    keyframes
      .slice()
      .sort((a, b) => a.time - b.time || String(a.label || "").localeCompare(String(b.label || "")))
      .forEach((keyframe) => {
        const row = document.createElement("div");
        Object.assign(row.style, {
          display: "grid",
          gridTemplateColumns: "1fr auto auto",
          alignItems: "center",
          gap: "6px",
          padding: "6px 7px",
          borderBottom: "1px solid #ebedf2",
          background: selectedUuids.has(keyframe.uuid) ? "#fff7e8" : "#ffffff",
          minWidth: "0",
        });

        const info = document.createElement("div");
        Object.assign(info.style, { minWidth: "0" });
        const name = document.createElement("div");
        name.textContent = formatTime(keyframe.time) + " / " + (keyframe.label || "Layer");
        Object.assign(name.style, {
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          font: "700 12px/1.2 system-ui, sans-serif",
        });
        info.appendChild(name);
        const sub = document.createElement("div");
        sub.textContent = keyframe.type || "Object3D";
        Object.assign(sub.style, {
          color: "#667085",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          font: "500 10px/1.25 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        });
        info.appendChild(sub);
        row.appendChild(info);

        const apply = createButton("Apply");
        apply.addEventListener("click", () => ctx.applyKeyframe?.(keyframe.id));
        row.appendChild(apply);

        const del = createButton("Delete");
        del.addEventListener("click", () => ctx.deleteKeyframe?.(keyframe.id));
        row.appendChild(del);
        keyframePane.content.appendChild(row);
      });
  }
}

function createPane(titleText) {
  const wrap = document.createElement("section");
  Object.assign(wrap.style, {
    display: "flex",
    flexDirection: "column",
    minHeight: "0",
    minWidth: "0",
    border: "1px solid #d8dee8",
    borderRadius: "6px",
    background: "#ffffff",
    overflow: "hidden",
  });
  const title = document.createElement("div");
  title.textContent = titleText;
  Object.assign(title.style, {
    flex: "0 0 auto",
    padding: "6px 8px",
    borderBottom: "1px solid #e3e7ef",
    background: "#f9fafc",
    font: "700 11px/1.2 system-ui, sans-serif",
    color: "#3c4658",
  });
  wrap.appendChild(title);
  const content = document.createElement("div");
  Object.assign(content.style, {
    flex: "1 1 auto",
    minHeight: "0",
    overflow: "auto",
  });
  wrap.appendChild(content);
  return { wrap, content };
}

function appendEmpty(container, text) {
  const empty = document.createElement("div");
  empty.textContent = text;
  Object.assign(empty.style, {
    padding: "10px",
    color: "#667085",
    font: "12px/1.4 system-ui, sans-serif",
  });
  container.appendChild(empty);
}

export async function setupPanel(panel) {
  if (!panel) throw new Error("Panel container required.");
  if (typeof panel.__nvCleanupKeyframeAnimationPanel === "function") panel.__nvCleanupKeyframeAnimationPanel();
  const rerender = () => render(panel);
  render(panel);
  window.addEventListener("nv-keyframe-animation-changed", rerender);
  window.addEventListener("nv-glb-layers-changed", rerender);
  panel.__nvCleanupKeyframeAnimationPanel = () => {
    window.removeEventListener("nv-keyframe-animation-changed", rerender);
    window.removeEventListener("nv-glb-layers-changed", rerender);
  };
  return panel.__nvCleanupKeyframeAnimationPanel;
}

export async function createPanel(panel) {
  return setupPanel(panel);
}

export default setupPanel;
