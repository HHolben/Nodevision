// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/directoryContents/DirectoryContentsDialog.mjs
// This module prompts for directory contents rendering choices before insertion.

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function addOptions(select, options) {
  options.forEach(([value, label]) => select.appendChild(makeOption(value, label)));
}

function labelFor(text, control) {
  const label = document.createElement("label");
  label.htmlFor = control.id;
  label.textContent = text;
  label.style.cssText = "display:block;font-weight:600;margin:10px 0 4px;";
  return label;
}

function createSelect(id, options) {
  const select = document.createElement("select");
  select.id = id;
  select.style.cssText = "box-sizing:border-box;width:100%;";
  addOptions(select, options);
  return select;
}

function createCheckbox(id) {
  const label = document.createElement("label");
  label.style.cssText = "display:flex;align-items:center;gap:8px;margin:12px 0;";
  const input = document.createElement("input");
  input.id = id;
  input.type = "checkbox";
  input.checked = true;
  label.append(input, document.createTextNode("Make items hyperlinks"));
  return { label, input };
}

function makeButton(text, type = "button") {
  const button = document.createElement("button");
  button.type = type;
  button.textContent = text;
  button.style.cssText = "padding:6px 10px;border:1px solid #777;background:#f6f6f6;cursor:pointer;";
  return button;
}

const ORDERED_LIST_STYLES = new Set(["decimal", "lower-alpha", "upper-alpha", "lower-roman", "upper-roman"]);
const UNORDERED_LIST_STYLES = new Set(["disc", "circle", "square", "none"]);

function updateStyleAvailability(layout, listStyle, tableStyle) {
  const asTable = layout.value === "table";
  if (layout.value === "ordered" && !ORDERED_LIST_STYLES.has(listStyle.value)) {
    listStyle.value = "decimal";
  }
  if (layout.value === "unordered" && !UNORDERED_LIST_STYLES.has(listStyle.value)) {
    listStyle.value = "disc";
  }
  listStyle.disabled = asTable;
  tableStyle.disabled = !asTable;
}

export function showDirectoryContentsDialog({ directoryPath = "", entryCount = 0 } = {}) {
  return new Promise((resolve) => {
    const ids = {
      layout: makeId("nv-dir-layout"),
      listStyle: makeId("nv-dir-list-style"),
      tableStyle: makeId("nv-dir-table-style"),
      links: makeId("nv-dir-links"),
    };
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:32000;display:flex;align-items:center;justify-content:center;";

    const form = document.createElement("form");
    form.style.cssText = "box-sizing:border-box;width:min(440px,92vw);background:#fff;border:1px solid #777;border-radius:6px;padding:14px;font:13px sans-serif;color:#111;box-shadow:0 8px 28px rgba(0,0,0,.22);";
    const title = document.createElement("div");
    title.textContent = "Insert Directory Contents";
    title.style.cssText = "font-weight:700;margin-bottom:8px;";
    const summary = document.createElement("div");
    summary.textContent = `${directoryPath || "Notebook root"} - ${entryCount} visible item${entryCount === 1 ? "" : "s"}`;
    summary.style.cssText = "color:#555;margin-bottom:8px;";

    const layout = createSelect(ids.layout, [
      ["unordered", "Unordered list"],
      ["ordered", "Ordered list"],
      ["table", "HTML table cells"],
    ]);
    const listStyle = createSelect(ids.listStyle, [
      ["disc", "Disc"],
      ["circle", "Circle"],
      ["square", "Square"],
      ["none", "No marker"],
      ["decimal", "Decimal"],
      ["lower-alpha", "Lower alpha"],
      ["upper-alpha", "Upper alpha"],
      ["lower-roman", "Lower roman"],
      ["upper-roman", "Upper roman"],
    ]);
    const tableStyle = createSelect(ids.tableStyle, [
      ["plain", "Plain"],
      ["bordered", "Bordered"],
      ["compact", "Compact"],
    ]);
    const links = createCheckbox(ids.links);
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-top:12px;";
    const cancel = makeButton("Cancel");
    const insert = makeButton("Insert", "submit");
    actions.append(cancel, insert);

    form.append(title, summary, labelFor("Layout", layout), layout);
    form.append(labelFor("List style", listStyle), listStyle);
    form.append(labelFor("Table style", tableStyle), tableStyle, links.label, actions);
    overlay.appendChild(form);
    document.body.appendChild(overlay);
    updateStyleAvailability(layout, listStyle, tableStyle);

    const finish = (value) => {
      overlay.remove();
      document.removeEventListener("keydown", onKeyDown);
      resolve(value);
    };
    const values = () => ({
      layout: layout.value,
      listStyle: listStyle.value,
      tableStyle: tableStyle.value,
      hyperlinks: links.input.checked,
    });
    const onKeyDown = (event) => {
      if (event.key === "Escape") finish(null);
    };

    layout.addEventListener("change", () => updateStyleAvailability(layout, listStyle, tableStyle));
    cancel.addEventListener("click", () => finish(null));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish(null);
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      finish(values());
    });
    document.addEventListener("keydown", onKeyDown);
    setTimeout(() => layout.focus(), 0);
  });
}
