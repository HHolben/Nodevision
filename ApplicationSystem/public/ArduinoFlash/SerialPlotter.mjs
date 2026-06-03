// Nodevision/ApplicationSystem/public/ArduinoFlash/SerialPlotter.mjs
// Parses common Arduino Serial Plotter text formats and renders a lightweight live canvas plot.

const MAX_POINTS = 180;

export function parseSerialPlotLine(line = "") {
  const text = String(line || "").trim();
  if (!text) return [];
  const parts = text.split(/[,\t ]+/).map((part) => part.trim()).filter(Boolean);
  const values = [];
  parts.forEach((part, index) => {
    const labelMatch = part.match(/^([^:]+):(-?\d+(?:\.\d+)?(?:e[-+]?\d+)?)$/i);
    if (labelMatch) {
      values.push({ label: labelMatch[1].trim(), value: Number(labelMatch[2]) });
      return;
    }
    if (/^-?\d+(?:\.\d+)?(?:e[-+]?\d+)?$/i.test(part)) {
      values.push({ label: `value${index + 1}`, value: Number(part) });
    }
  });
  return values.filter((item) => Number.isFinite(item.value));
}

export class SerialPlotter {
  constructor(canvas) {
    this.canvas = canvas;
    this.series = new Map();
    this.colors = ["#0a84ff", "#34a853", "#fbbc04", "#ea4335", "#7b61ff", "#00a7a7"];
  }

  pushLine(line) {
    const values = parseSerialPlotLine(line);
    values.forEach(({ label, value }) => {
      if (!this.series.has(label)) this.series.set(label, []);
      const points = this.series.get(label);
      points.push(value);
      if (points.length > MAX_POINTS) points.shift();
    });
    if (values.length) this.draw();
  }

  clear() {
    this.series.clear();
    this.draw();
  }

  draw() {
    const canvas = this.canvas;
    const ctx = canvas?.getContext?.("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fbfbfb";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#e3e3e3";
    ctx.lineWidth = 1 * dpr;
    for (let i = 1; i < 4; i += 1) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const all = Array.from(this.series.values()).flat();
    if (!all.length) {
      ctx.fillStyle = "#777";
      ctx.font = `${12 * dpr}px sans-serif`;
      ctx.fillText("Waiting for numeric serial output...", 10 * dpr, 22 * dpr);
      return;
    }

    let min = Math.min(...all);
    let max = Math.max(...all);
    if (min === max) {
      min -= 1;
      max += 1;
    }

    let colorIndex = 0;
    for (const [label, points] of this.series) {
      const color = this.colors[colorIndex % this.colors.length];
      colorIndex += 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      points.forEach((value, index) => {
        const x = points.length <= 1 ? 0 : (index / (MAX_POINTS - 1)) * width;
        const y = height - ((value - min) / (max - min)) * height;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = `${11 * dpr}px sans-serif`;
      ctx.fillText(label, 10 * dpr, (16 + (colorIndex - 1) * 14) * dpr);
    }
  }
}
