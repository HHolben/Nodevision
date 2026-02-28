// Nodevision/public/PanelInstances/InfoPanels/GraphManagerDependencies/CytoscapeStyling.mjs

export const GRAPH_STYLE = [
  {
    selector: "node[type='directory']",
    style: {
      shape: "roundrectangle",
      "background-color": "#e8f0ff",
      label: "data(label)",
      "text-valign": "center",
      padding: "8px",
      "font-weight": "600",
      "border-width": 2,
      "border-color": "#a8b8d8"
    }
  },
  {
    selector: "node[type='file']",
    style: {
      shape: "ellipse",
      "background-color": "#dfefff",
      label: "data(label)",
      "text-valign": "center",
      padding: "6px",
      "font-size": "11px"
    }
  },
  {
    selector: "edge",
    style: {
      width: 2,
      "line-color": "#999",
      "target-arrow-shape": "triangle",
      "target-arrow-color": "#999",
      "curve-style": "bezier"
    }
  }
];

// Selection Styles (used by NodeInteraction.mjs)
export const SELECTED_COLOR = "#0066ff";
export const UNSELECTED_COLOR = "#a8b8d8";