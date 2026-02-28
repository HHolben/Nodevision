// CSVeditor.mjs
export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  container.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.id = "editor-root";
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.height = "100%";
  wrapper.style.width = "100%";
  wrapper.style.overflow = "auto";
  container.appendChild(wrapper);

  const tableWrapper = document.createElement("div");
  tableWrapper.style.flex = "1";
  tableWrapper.style.overflow = "auto";
  wrapper.appendChild(tableWrapper);

  const table = document.createElement("table");
  table.style.borderCollapse = "collapse";
  table.style.width = "100%";
  table.style.tableLayout = "fixed";
  tableWrapper.appendChild(table);

  // Helper to create a cell
  function createCell(value = "") {
    const td = document.createElement("td");
    td.contentEditable = "true";
    td.style.border = "1px solid #ccc";
    td.style.padding = "4px";
    td.style.minWidth = "80px";
    td.textContent = value;
    return td;
  }

  // Load CSV data
  try {
    const res = await fetch(`/Notebook/${filePath}`);
    if (!res.ok) throw new Error(res.statusText);
    const csvText = await res.text();

    const rows = csvText.split(/\r?\n/);
    rows.forEach(rowText => {
      const tr = document.createElement("tr");
      const cells = rowText.split(",");
      cells.forEach(cell => tr.appendChild(createCell(cell)));
      table.appendChild(tr);
    });

    // Expose API for saving CSV
    window.getEditorHTML = () => {
      const data = Array.from(table.rows).map(tr =>
        Array.from(tr.cells).map(td => td.textContent).join(",")
      ).join("\n");
      return data;
    };

    window.setEditorHTML = csv => {
      table.innerHTML = "";
      const rows = csv.split(/\r?\n/);
      rows.forEach(rowText => {
        const tr = document.createElement("tr");
        const cells = rowText.split(",");
        cells.forEach(cell => tr.appendChild(createCell(cell)));
        table.appendChild(tr);
      });
    };

    window.saveWYSIWYGFile = async (path) => {
      const content = window.getEditorHTML();
      await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path || filePath, content }),
      });
      console.log("Saved CSV file:", path || filePath);
    };

  } catch (err) {
    wrapper.innerHTML = `<div style="color:red;padding:12px">Failed to load file: ${err.message}</div>`;
    console.error(err);
  }
}
