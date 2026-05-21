// Nodevision/ApplicationSystem/public/MetaWorld/MetaWorldUI.mjs
// MetaWorld UI system renders exhibit details, controls, and live readouts.

export class MetaWorldUI {
  constructor({ root, world }) {
    this.root = root;
    this.world = world;
    this.readouts = new Map();
    this.panel = document.createElement("aside");
    this.panel.className = "metaworld-panel";
    this.root.appendChild(this.panel);
    this.showWelcome();
  }

  showWelcome() {
    this.panel.innerHTML = `
      <div class="panel-kicker">${this.world.type}</div>
      <h1>${this.world.name}</h1>
      <p>Select an exhibit to inspect its mechanics.</p>
    `;
  }

  showExhibit(controller) {
    this.readouts.clear();
    const exhibit = controller.definition;
    this.panel.innerHTML = "";
    this.panel.append(this.createText("div", "panel-kicker", "Selected exhibit"));
    this.panel.append(this.createText("h1", "", exhibit.title));
    this.panel.append(this.createText("p", "", exhibit.explanation || "Interactive MetaWorld exhibit."));
    this.panel.append(this.createParameterList(exhibit.parameters));
    const controls = this.createText("div", "control-row", "");
    this.panel.append(controls);
    const readouts = this.createText("div", "readout-list", "");
    this.panel.append(readouts);
    controller.registerUI({
      addButton: (label, action) => controls.append(this.createButton(label, action)),
      addReadout: (id, label, formatter) => {
        const row = this.createText("div", "readout", "");
        row.innerHTML = `<span>${label}</span><strong></strong>`;
        readouts.append(row);
        this.readouts.set(id, { valueNode: row.querySelector("strong"), formatter });
      },
    });
  }

  updateReadout(id, value) {
    const readout = this.readouts.get(id);
    if (!readout) return;
    readout.valueNode.textContent = readout.formatter ? readout.formatter(value) : String(value);
  }

  createParameterList(parameters) {
    const list = this.createText("dl", "parameter-list", "");
    for (const [key, value] of Object.entries(parameters || {})) {
      list.append(this.createText("dt", "", key));
      list.append(this.createText("dd", "", String(value)));
    }
    return list;
  }

  createButton(label, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
  }

  createText(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }
}
