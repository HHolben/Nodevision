import { formatCoordinates } from "./KMLParser.mjs";

function xmlString(record) {
  try {
    return new XMLSerializer().serializeToString(record.node);
  } catch {
    return "";
  }
}

function field(labelText, control) {
  const label = document.createElement("label");
  label.className = "nv-kml-field";
  const span = document.createElement("span");
  span.textContent = labelText;
  label.append(span, control);
  return label;
}

function textInput(value = "") {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  return input;
}

function textArea(value = "", rows = 4) {
  const input = document.createElement("textarea");
  input.value = value;
  input.rows = rows;
  return input;
}

export function createKMLPropertyPanel(container, { onTextChange, onCoordinatesChange, onOptionChange, onStyleChange }) {
  container.className = "nv-kml-properties";
  let currentRecord = null;

  function render(record) {
    currentRecord = record || null;
    container.innerHTML = "";

    if (!record || record.type !== "placemark") {
      const empty = document.createElement("div");
      empty.className = "nv-kml-empty";
      empty.textContent = "Select a placemark, path, or polygon to edit its properties.";
      container.appendChild(empty);
      return;
    }

    const title = document.createElement("div");
    title.className = "nv-kml-panel-title";
    title.textContent = "Selected Feature";

    const name = textInput(record.name === "(unnamed)" ? "" : record.name);
    name.addEventListener("change", () => onTextChange?.(record, { name: name.value }));

    const description = textArea(record.description || "", 3);
    description.addEventListener("change", () => onTextChange?.(record, { description: description.value }));

    const geometry = textInput(record.geometry?.type || "Unsupported");
    geometry.readOnly = true;

    const coordinates = textArea(formatCoordinates(record.geometry?.coordinates || []), 5);
    coordinates.spellcheck = false;
    coordinates.addEventListener("change", () => onCoordinatesChange?.(record, coordinates.value));

    const color = textInput(record.style?.lineColor || record.style?.polyColor || record.style?.iconColor || "");
    color.placeholder = "KML aabbggrr or CSS hex";
    color.addEventListener("change", () => onStyleChange?.(record, color.value));

    container.append(
      title,
      field("Name", name),
      field("Description", description),
      field("Geometry", geometry),
      field("Coordinates", coordinates),
      field("Style color", color),
    );

    ["altitudeMode", "tessellate", "extrude"].forEach((key) => {
      const input = textInput(record.geometry?.[key] || "");
      input.addEventListener("change", () => onOptionChange?.(record, key, input.value));
      container.appendChild(field(key, input));
    });

    const xmlTitle = document.createElement("div");
    xmlTitle.className = "nv-kml-panel-title";
    xmlTitle.textContent = "Source XML";
    const xml = textArea(xmlString(record), 7);
    xml.readOnly = true;
    xml.spellcheck = false;
    container.append(xmlTitle, xml);

    const todo = document.createElement("div");
    todo.className = "nv-kml-todo";
    todo.textContent = "TODO: jump directly to this XML node in the code editor when Nodevision exposes source line mapping.";
    container.appendChild(todo);
  }

  return {
    render,
    refresh() {
      render(currentRecord);
    },
  };
}
