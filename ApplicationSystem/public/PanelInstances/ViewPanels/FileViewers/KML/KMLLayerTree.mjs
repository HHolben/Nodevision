import { getFeatureLabel } from "./KMLParser.mjs";

const TYPE_ICONS = {
  document: "DOC",
  folder: "DIR",
  placemark: "PIN",
  Point: "PIN",
  LineString: "PATH",
  Polygon: "POLY",
};

export function createKMLLayerTree(container, { onSelect, onToggle }) {
  container.className = "nv-kml-tree";
  let records = [];
  let selectedId = null;

  function render(nextRecords = records, nextSelectedId = selectedId) {
    records = nextRecords || [];
    selectedId = nextSelectedId || null;
    container.innerHTML = "";

    if (!records.length) {
      const empty = document.createElement("div");
      empty.className = "nv-kml-empty";
      empty.textContent = "No KML folders or placemarks found.";
      container.appendChild(empty);
      return;
    }

    records.forEach((record) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = `nv-kml-tree-row${record.id === selectedId ? " is-selected" : ""}`;
      row.style.paddingLeft = `${8 + (record.depth || 0) * 14}px`;
      row.dataset.recordId = record.id;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = record.visible !== false;
      checkbox.title = "Toggle visibility";
      checkbox.addEventListener("click", (event) => {
        event.stopPropagation();
        record.visible = checkbox.checked;
        onToggle?.(record, checkbox.checked);
      });

      const icon = document.createElement("span");
      icon.className = "nv-kml-type";
      icon.textContent = TYPE_ICONS[record.geometry?.type] || TYPE_ICONS[record.type] || "KML";

      const name = document.createElement("span");
      name.className = "nv-kml-tree-name";
      name.textContent = record.type === "placemark" ? getFeatureLabel(record) : record.name;

      row.append(checkbox, icon, name);
      row.addEventListener("click", () => onSelect?.(record));
      container.appendChild(row);
    });
  }

  return {
    render,
    setSelected(id) {
      selectedId = id;
      container.querySelectorAll(".nv-kml-tree-row").forEach((row) => {
        row.classList.toggle("is-selected", row.dataset.recordId === id);
      });
    },
  };
}
