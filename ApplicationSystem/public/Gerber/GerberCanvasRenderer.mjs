// Nodevision/ApplicationSystem/public/Gerber/GerberCanvasRenderer.mjs
// Canvas renderer shared by Gerber and Excellon viewer/editor panels.

const LIGHT_THEME = {
  background: "#f6f5ef",
  majorGrid: "rgba(48, 52, 59, 0.18)",
  minorGrid: "rgba(48, 52, 59, 0.08)",
  copper: "#b56d1f",
  copperFill: "rgba(181, 109, 31, 0.38)",
  clear: "#f6f5ef",
  drill: "#1f6f8f",
  drillFill: "#f6f5ef",
  slot: "#1f6f8f",
  selected: "#db3b3b",
  text: "#30343b",
  axis: "rgba(31, 111, 143, 0.45)",
};

const DARK_THEME = {
  background: "#151917",
  majorGrid: "rgba(210, 217, 207, 0.18)",
  minorGrid: "rgba(210, 217, 207, 0.08)",
  copper: "#f0a737",
  copperFill: "rgba(240, 167, 55, 0.42)",
  clear: "#151917",
  drill: "#62c7d9",
  drillFill: "#151917",
  slot: "#62c7d9",
  selected: "#ff5a52",
  text: "#dce3dd",
  axis: "rgba(98, 199, 217, 0.5)",
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distancePointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function niceStep(raw) {
  const exponent = Math.floor(Math.log10(Math.max(raw, 0.000001)));
  const base = raw / (10 ** exponent);
  const niceBase = base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10;
  return niceBase * (10 ** exponent);
}

function apertureSize(aperture = {}, fallback = 0.1) {
  if (Number.isFinite(aperture.diameter) && aperture.diameter > 0) {
    return { width: aperture.diameter, height: aperture.diameter };
  }
  return {
    width: aperture.width || fallback,
    height: aperture.height || aperture.width || fallback,
  };
}

function effectiveWidth(shape) {
  if (Number.isFinite(shape.width) && shape.width > 0) return shape.width;
  if (Number.isFinite(shape.diameter) && shape.diameter > 0) return shape.diameter;
  const size = apertureSize(shape.aperture, 0.1);
  return Math.max(size.width, size.height, 0.1);
}

export function createGerberCanvasView(host, initialModel = null, options = {}) {
  host.innerHTML = "";
  host.style.position = host.style.position || "relative";
  host.style.overflow = "hidden";
  host.style.minHeight = host.style.minHeight || "220px";

  const canvas = document.createElement("canvas");
  canvas.style.cssText = [
    "display:block",
    "width:100%",
    "height:100%",
    "min-height:220px",
    "cursor:grab",
    "touch-action:none",
  ].join(";");
  host.appendChild(canvas);

  const state = {
    model: initialModel,
    themeName: options.theme || "dark",
    scale: 1,
    panX: 0,
    panY: 0,
    padding: options.padding || 32,
    dragging: false,
    dragX: 0,
    dragY: 0,
    selectedShape: null,
  };

  const ctx = canvas.getContext("2d");

  function theme() {
    return state.themeName === "light" ? LIGHT_THEME : DARK_THEME;
  }

  function clientSize() {
    return {
      width: Math.max(1, canvas.clientWidth || host.clientWidth || 1),
      height: Math.max(1, canvas.clientHeight || host.clientHeight || 1),
    };
  }

  function resizeCanvas() {
    const { width, height } = clientSize();
    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.max(1, Math.floor(width * dpr));
    const targetHeight = Math.max(1, Math.floor(height * dpr));
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function bounds() {
    return state.model?.bounds || { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1, empty: true };
  }

  function fitToView() {
    resizeCanvas();
    const { width, height } = clientSize();
    const b = bounds();
    const contentWidth = Math.max(b.width, 0.000001);
    const contentHeight = Math.max(b.height, 0.000001);
    const availableWidth = Math.max(20, width - state.padding * 2);
    const availableHeight = Math.max(20, height - state.padding * 2);
    state.scale = clamp(Math.min(availableWidth / contentWidth, availableHeight / contentHeight), 0.0001, 250000);
    state.panX = 0;
    state.panY = 0;
    draw();
  }

  function worldToScreen(x, y) {
    const b = bounds();
    const { height } = clientSize();
    return {
      x: state.padding + (x - b.minX) * state.scale + state.panX,
      y: height - state.padding - (y - b.minY) * state.scale + state.panY,
    };
  }

  function screenToWorld(x, y) {
    const b = bounds();
    const { height } = clientSize();
    return {
      x: ((x - state.padding - state.panX) / state.scale) + b.minX,
      y: (((height - state.padding + state.panY) - y) / state.scale) + b.minY,
    };
  }

  function clear() {
    const { width, height } = clientSize();
    const colors = theme();
    ctx.save();
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function drawText(message) {
    const { width, height } = clientSize();
    const colors = theme();
    ctx.save();
    ctx.fillStyle = colors.text;
    ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, width / 2, height / 2);
    ctx.restore();
  }

  function drawGrid() {
    const model = state.model;
    if (!model || model.bounds?.empty) return;

    const colors = theme();
    const { width, height } = clientSize();
    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(width, height);
    const minX = Math.min(topLeft.x, bottomRight.x);
    const maxX = Math.max(topLeft.x, bottomRight.x);
    const minY = Math.min(topLeft.y, bottomRight.y);
    const maxY = Math.max(topLeft.y, bottomRight.y);
    const minorStep = niceStep(48 / state.scale);
    const majorStep = minorStep * 5;

    ctx.save();
    ctx.lineWidth = 1;

    const drawLines = (step, color) => {
      ctx.strokeStyle = color;
      ctx.beginPath();
      for (let x = Math.floor(minX / step) * step; x <= maxX; x += step) {
        const a = worldToScreen(x, minY);
        const b = worldToScreen(x, maxY);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      for (let y = Math.floor(minY / step) * step; y <= maxY; y += step) {
        const a = worldToScreen(minX, y);
        const b = worldToScreen(maxX, y);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    };

    if ((maxX - minX) / minorStep < 180 && (maxY - minY) / minorStep < 180) {
      drawLines(minorStep, colors.minorGrid);
    }
    if ((maxX - minX) / majorStep < 180 && (maxY - minY) / majorStep < 180) {
      drawLines(majorStep, colors.majorGrid);
    }

    const origin = worldToScreen(0, 0);
    ctx.strokeStyle = colors.axis;
    ctx.beginPath();
    ctx.moveTo(0, origin.y);
    ctx.lineTo(width, origin.y);
    ctx.moveTo(origin.x, 0);
    ctx.lineTo(origin.x, height);
    ctx.stroke();
    ctx.restore();
  }

  function strokePolyline(points, width, color) {
    if (!points || points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = clamp(width * state.scale, 1, 96);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const first = worldToScreen(points[0].x, points[0].y);
    ctx.moveTo(first.x, first.y);
    for (let index = 1; index < points.length; index += 1) {
      const point = worldToScreen(points[index].x, points[index].y);
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawSegment(shape, color) {
    const a = worldToScreen(shape.x1, shape.y1);
    const b = worldToScreen(shape.x2, shape.y2);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = clamp(effectiveWidth(shape) * state.scale, 1, 96);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawRegion(shape, colors) {
    const points = shape.points || [];
    if (points.length < 2) return;
    ctx.save();
    ctx.fillStyle = shape.polarity === "clear" ? colors.clear : colors.copperFill;
    ctx.beginPath();
    const first = worldToScreen(points[0].x, points[0].y);
    ctx.moveTo(first.x, first.y);
    for (let index = 1; index < points.length; index += 1) {
      const point = worldToScreen(points[index].x, points[index].y);
      ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawFlash(shape, colors) {
    const point = worldToScreen(shape.x, shape.y);
    const size = apertureSize(shape.aperture, effectiveWidth(shape));
    const widthPx = Math.max(2, size.width * state.scale);
    const heightPx = Math.max(2, size.height * state.scale);

    ctx.save();
    ctx.fillStyle = shape.polarity === "clear" ? colors.clear : colors.copper;
    ctx.strokeStyle = shape === state.selectedShape ? colors.selected : colors.copper;
    ctx.lineWidth = shape === state.selectedShape ? 2 : 1;
    ctx.beginPath();

    if (shape.aperture?.shape === "R") {
      ctx.rect(point.x - widthPx / 2, point.y - heightPx / 2, widthPx, heightPx);
    } else if (shape.aperture?.shape === "O") {
      ctx.ellipse(point.x, point.y, widthPx / 2, heightPx / 2, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(point.x, point.y, Math.max(widthPx, heightPx) / 2, 0, Math.PI * 2);
    }

    ctx.fill();
    if (shape === state.selectedShape) ctx.stroke();
    ctx.restore();
  }

  function drawDrill(shape, colors) {
    const point = worldToScreen(shape.x, shape.y);
    const radius = Math.max(2.5, (shape.diameter * state.scale) / 2);
    ctx.save();
    ctx.fillStyle = colors.drillFill;
    ctx.strokeStyle = shape === state.selectedShape ? colors.selected : colors.drill;
    ctx.lineWidth = shape === state.selectedShape ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawSlot(shape, colors) {
    const a = worldToScreen(shape.x1, shape.y1);
    const b = worldToScreen(shape.x2, shape.y2);
    ctx.save();
    ctx.strokeStyle = colors.slot;
    ctx.lineWidth = clamp(shape.diameter * state.scale, 2, 96);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.strokeStyle = colors.drillFill;
    ctx.lineWidth = Math.max(1, ctx.lineWidth - 3);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawSelection(shape, colors) {
    if (!shape || shape.type === "flash" || shape.type === "drill") return;
    ctx.save();
    ctx.strokeStyle = colors.selected;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    if (shape.type === "segment" || shape.type === "slot") {
      const a = worldToScreen(shape.x1, shape.y1);
      const b = worldToScreen(shape.x2, shape.y2);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    } else if (shape.type === "arc") {
      const points = shape.points || [];
      if (points.length >= 2) {
        ctx.beginPath();
        const first = worldToScreen(points[0].x, points[0].y);
        ctx.moveTo(first.x, first.y);
        for (let index = 1; index < points.length; index += 1) {
          const point = worldToScreen(points[index].x, points[index].y);
          ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawShapes() {
    const model = state.model;
    if (!model) return;
    const colors = theme();
    const shapes = model.shapes || [];

    for (const shape of shapes) {
      if (shape.type === "region") drawRegion(shape, colors);
    }

    for (const shape of shapes) {
      const color = shape.polarity === "clear" ? colors.clear : colors.copper;
      if (shape.type === "segment") drawSegment(shape, color);
      if (shape.type === "arc") strokePolyline(shape.points, effectiveWidth(shape), color);
      if (shape.type === "flash") drawFlash(shape, colors);
    }

    for (const shape of shapes) {
      if (shape.type === "slot") drawSlot(shape, colors);
      if (shape.type === "drill") drawDrill(shape, colors);
    }

    drawSelection(state.selectedShape, colors);
  }

  function draw() {
    resizeCanvas();
    clear();
    drawGrid();
    if (!state.model) {
      drawText("No board loaded");
      return;
    }
    drawShapes();
    if (state.model.bounds?.empty) drawText(state.model.sourceEmpty ? "Empty board" : "Blank board");
  }

  function zoomAt(clientX, clientY, factor) {
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const before = screenToWorld(sx, sy);
    state.scale = clamp(state.scale * factor, 0.0001, 250000);
    const after = worldToScreen(before.x, before.y);
    state.panX += sx - after.x;
    state.panY += sy - after.y;
    draw();
  }

  function hitTest(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const shapes = state.model?.shapes || [];
    let best = null;
    let bestDistance = 10;

    for (const shape of shapes) {
      let distance = Number.POSITIVE_INFINITY;
      if (shape.type === "segment" || shape.type === "slot") {
        const a = worldToScreen(shape.x1, shape.y1);
        const b = worldToScreen(shape.x2, shape.y2);
        distance = distancePointToSegment(sx, sy, a.x, a.y, b.x, b.y);
      } else if (shape.type === "arc") {
        const points = shape.points || [];
        for (let index = 1; index < points.length; index += 1) {
          const a = worldToScreen(points[index - 1].x, points[index - 1].y);
          const b = worldToScreen(points[index].x, points[index].y);
          distance = Math.min(distance, distancePointToSegment(sx, sy, a.x, a.y, b.x, b.y));
        }
      } else if (shape.type === "flash" || shape.type === "drill") {
        const p = worldToScreen(shape.x, shape.y);
        distance = Math.hypot(sx - p.x, sy - p.y);
      }

      if (distance < bestDistance) {
        best = shape;
        bestDistance = distance;
      }
    }

    return best;
  }

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    state.dragging = true;
    state.dragX = event.clientX;
    state.dragY = event.clientY;
    canvas.style.cursor = "grabbing";
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.dragging) return;
    state.panX += event.clientX - state.dragX;
    state.panY += event.clientY - state.dragY;
    state.dragX = event.clientX;
    state.dragY = event.clientY;
    draw();
  });

  canvas.addEventListener("pointerup", (event) => {
    canvas.releasePointerCapture(event.pointerId);
    state.dragging = false;
    canvas.style.cursor = "grab";
  });

  canvas.addEventListener("click", (event) => {
    const shape = hitTest(event.clientX, event.clientY);
    state.selectedShape = shape;
    draw();
    host.dispatchEvent(new CustomEvent("nodevision:gerber-shape-selected", {
      bubbles: true,
      detail: { shape },
    }));
  });

  let resizeObserver = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => draw());
    resizeObserver.observe(host);
  } else {
    window.addEventListener("resize", draw);
  }

  requestAnimationFrame(fitToView);

  return {
    canvas,
    draw,
    fit: fitToView,
    zoomIn() {
      const rect = canvas.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.2);
    },
    zoomOut() {
      const rect = canvas.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / 1.2);
    },
    setTheme(name) {
      state.themeName = name === "light" ? "light" : "dark";
      draw();
    },
    setModel(model) {
      state.model = model;
      state.selectedShape = null;
      fitToView();
    },
    selectedShape() {
      return state.selectedShape;
    },
    destroy() {
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener("resize", draw);
    },
  };
}
