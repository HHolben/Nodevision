// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/PhpEditorDashboard.mjs
// This module mounts PHP runtime dashboard widgets and draws sampled waveforms.
import { ensureDefaultWidgets } from './PhpEditorState.mjs';

export function drawWave(canvas, values, color = "#39f08c") {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#121212";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * w;
    const y = h / 2 - v * (h * 0.45);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

export function mountDashboardWidgets(state, host) {
  host.innerHTML = "";
  ensureDefaultWidgets(state);
  const widgetRefs = [];
  state.dashboard.widgets.forEach((widget) => {
    const card = document.createElement("div");
    card.className = "nv-php-widget";
    const title = document.createElement("h4");
    title.textContent = `${widget.type} (${widget.source})`;
    card.appendChild(title);

    const ref = { widget, card };
    if (widget.type === "oscilloscope" || widget.type === "graph") {
      const canvas = document.createElement("canvas");
      canvas.width = 260;
      canvas.height = 80;
      canvas.className = widget.type === "oscilloscope" ? "nv-php-oscilloscope" : "nv-php-graph";
      ref.canvas = canvas;
      card.appendChild(canvas);
    } else if (widget.type === "gauge") {
      const meter = document.createElement("meter");
      meter.min = 0;
      meter.max = 100;
      meter.value = 0;
      meter.className = "nv-php-meter";
      ref.meter = meter;
      card.appendChild(meter);
      const valueLabel = document.createElement("div");
      valueLabel.textContent = "0";
      ref.valueLabel = valueLabel;
      card.appendChild(valueLabel);
    } else if (widget.type === "led") {
      const led = document.createElement("div");
      led.className = "nv-php-led";
      ref.led = led;
      card.appendChild(led);
    }
    host.appendChild(card);
    widgetRefs.push(ref);
  });
  return widgetRefs;
}
