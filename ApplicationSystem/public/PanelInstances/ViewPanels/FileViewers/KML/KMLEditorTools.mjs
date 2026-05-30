export function createKMLEditorTools(container, actions = {}) {
  container.className = "nv-kml-toolbar";
  const buttons = [
    ["addPlacemark", "Add Placemark"],
    ["drawPath", "Draw Path"],
    ["drawPolygon", "Draw Polygon"],
    ["editSelected", "Edit Selected"],
    ["deleteSelected", "Delete Selected"],
    ["fit", "Fit to KML"],
    ["save", "Save KML"],
    ["viewXml", "View XML"],
  ];

  buttons.forEach(([key, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = label;
    button.addEventListener("click", () => actions[key]?.());
    container.appendChild(button);
  });

  return {
    setBusy(isBusy) {
      container.querySelectorAll("button").forEach((button) => {
        button.disabled = Boolean(isBusy);
      });
    },
  };
}
