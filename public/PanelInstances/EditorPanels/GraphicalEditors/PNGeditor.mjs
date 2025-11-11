// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/PNGeditor.mjs
// Purpose: Paint-like PNG editor

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  container.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.id = "png-editor-root";
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.height = "100%";
  wrapper.style.width = "100%";
  wrapper.style.overflow = "hidden";
  container.appendChild(wrapper);

  // Toolbar
  const toolbar = document.createElement("div");
  toolbar.style.display = "flex";
  toolbar.style.gap = "8px";
  toolbar.style.padding = "4px";
  toolbar.style.alignItems = "center";
  wrapper.appendChild(toolbar);

  // Color picker
  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = "#000000";
  toolbar.appendChild(colorInput);

  // Brush size
  const brushInput = document.createElement("input");
  brushInput.type = "number";
  brushInput.min = 1;
  brushInput.max = 50;
  brushInput.value = 5;
  brushInput.style.width = "60px";
  toolbar.appendChild(brushInput);

  // Clear button
  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear";
  toolbar.appendChild(clearBtn);

  // Save button
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save PNG";
  toolbar.appendChild(saveBtn);

  // Canvas container
  const canvasWrapper = document.createElement("div");
  canvasWrapper.style.flex = "1";
  canvasWrapper.style.position = "relative";
  wrapper.appendChild(canvasWrapper);

  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvasWrapper.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  // Resize canvas to match wrapper
  function resizeCanvas() {
    canvas.width = canvasWrapper.clientWidth;
    canvas.height = canvasWrapper.clientHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Load existing PNG
  if (filePath) {
    const img = new Image();
    img.src = `/Notebook/${filePath}`;
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  // Drawing state
  let drawing = false;

  function startDraw(e) {
    drawing = true;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }

  function draw(e) {
    if (!drawing) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = colorInput.value;
    ctx.lineWidth = parseInt(brushInput.value, 10);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function endDraw() {
    drawing = false;
  }

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", endDraw);
  canvas.addEventListener("mouseleave", endDraw);

  // Clear canvas
  clearBtn.addEventListener("click", () => ctx.clearRect(0, 0, canvas.width, canvas.height));

  // Save canvas
  saveBtn.addEventListener("click", async () => {
    const dataUrl = canvas.toDataURL("image/png");
    await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath, content: dataUrl }),
    });
    console.log("Saved PNG:", filePath);
  });
}
