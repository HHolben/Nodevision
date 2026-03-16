// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewCIR/renderers.mjs
// This file defines HTML and SVG render helpers for the ViewCIR file viewer in Nodevision. It builds a component summary table and a simplified net topology diagram.

/**
 * Generates an HTML summary table of the parsed circuit components.
 * @param {Array<Object>} components - The parsed component objects.
 * @returns {string} The HTML string.
 */
export function generateCircuitSummary(components) {
  let html = `
    <h3 style="margin:10px 0;">Component List</h3>
    <table style="border-collapse:collapse;font-family:sans-serif;width:100%;font-size:0.9em;">
    <thead><tr>
        <th style="border:1px solid #ccc;padding:6px;background:#f5f5f5;">Type</th>
        <th style="border:1px solid #ccc;padding:6px;background:#f5f5f5;">Name</th>
        <th style="border:1px solid #ccc;padding:6px;background:#f5f5f5;">Nodes</th>
        <th style="border:1px solid #ccc;padding:6px;background:#f5f5f5;">Value / Model</th>
        <th style="border:1px solid #ccc;padding:6px;background:#f5f5f5;">Extra Params</th>
    </tr></thead><tbody>
  `;

  components.forEach((comp) => {
    const connections = comp.nodes.join(", ");
    const valueModel = comp.value || comp.model || "—";
    const params = comp.params || "—";
    const typeColor =
      {
        R: "#007bff",
        L: "#28a745",
        C: "#ffc107",
        V: "#dc3545",
        I: "#6f42c1",
      }[comp.type] || "#6c757d";

    html += "<tr>";
    html += `<td style="border:1px solid #eee;padding:6px;text-align:center;color:${typeColor};">**${comp.type}**</td>`;
    html += `<td style="border:1px solid #eee;padding:6px;">${comp.name}</td>`;
    html += `<td style="border:1px solid #eee;padding:6px;">${connections}</td>`;
    html += `<td style="border:1px solid #eee;padding:6px;">${valueModel}</td>`;
    html += `<td style="border:1px solid #eee;padding:6px;">${params}</td>`;
    html += "</tr>";
  });

  html += "</tbody></table>";
  return html;
}

/**
 * Generates a simplified SVG diagram representing nodes and component connections.
 * @param {Array<Object>} components - The parsed component objects.
 * @param {Set<string>} nodes - Set of unique node names.
 * @returns {string} The SVG string.
 */
export function generateTopologySVG(components, nodes) {
  const SVG_WIDTH = 600;
  const SVG_HEIGHT = 200;
  const NODE_RADIUS = 5;
  const NODE_COLOR = "#007bff";
  const LINE_COLOR = "#333";

  const nodeArray = Array.from(nodes);
  const nodePositions = {};
  const nodeY = SVG_HEIGHT / 2;

  nodeArray.forEach((node, i) => {
    if (node === "0" && nodeArray.length > 1) {
      nodePositions[node] = { x: 50, y: nodeY + 50 };
    } else {
      const x = 50 + (i * (SVG_WIDTH - 100)) / (nodeArray.length - 1 || 1);
      nodePositions[node] = { x, y: nodeY };
    }
  });

  let svgElements = "";

  components.forEach((comp, index) => {
    if (comp.nodes.length < 2) return;
    const startNode = comp.nodes[0];
    const endNode = comp.nodes[1];

    const startPos = nodePositions[startNode];
    const endPos = nodePositions[endNode];

    if (!startPos || !endPos) return;

    const offset = (index % 6) * 6;
    const routeX = (startPos.x + endPos.x) / 2 + offset;

    svgElements += `
      <path
        d="
          M ${startPos.x} ${startPos.y}
          L ${routeX} ${startPos.y}
          L ${routeX} ${endPos.y}
          L ${endPos.x} ${endPos.y}
        "
        fill="none"
        stroke="${LINE_COLOR}"
        stroke-width="2"
      />
    `;

    const labelX = routeX;
    const labelY = (startPos.y + endPos.y) / 2 - 5;

    svgElements += `
      <text
        x="${labelX}"
        y="${labelY}"
        font-family="sans-serif"
        font-size="10"
        fill="black"
        text-anchor="middle"
      >
        ${comp.name}
      </text>
    `;
  });

  nodeArray.forEach((node) => {
    const pos = nodePositions[node];
    if (!pos) return;

    svgElements += `<circle cx="${pos.x}" cy="${pos.y}" r="${NODE_RADIUS}" fill="${NODE_COLOR}" />`;

    if (node === "0") {
      svgElements += `<text x="${pos.x}" y="${pos.y + 20}" font-family="sans-serif" font-size="12" fill="#333" text-anchor="middle">GND</text>`;
      return;
    }

    const labelY = pos.y + NODE_RADIUS + 10;
    svgElements += `<text x="${pos.x}" y="${labelY}" font-family="sans-serif" font-size="12" fill="#333" text-anchor="middle">N${node}</text>`;
  });

  return `
        <h3 style="margin:10px 0;">Simplified Net Topology View</h3>
        <svg width="${SVG_WIDTH}" height="${SVG_HEIGHT + 30}" style="border: 1px solid #ccc; background: #fafafa;">
            ${svgElements}
        </svg>
    `;
}

