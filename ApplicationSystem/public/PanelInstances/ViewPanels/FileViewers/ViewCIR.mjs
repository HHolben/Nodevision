// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewCIR.mjs
// This file defines browser-side View CIR logic for the Nodevision UI. It renders interface components and handles user interactions.
//          and a basic SVG representation of the net topology.

import { parseNetlist } from "./ViewCIR/parseNetlist.mjs";
import { generateCircuitSummary, generateTopologySVG } from "./ViewCIR/renderers.mjs";

/**
 * Renders the contents of a netlist (.cir) file.
 * @param {string} filename - The name of the netlist file.
 * @param {HTMLElement} viewPanel - The DOM element to render the output into.
 * @param {HTMLIFrameElement} iframe - (Kept for signature consistency)
 * @param {string} serverBase - The base URL of the server.
 */
export async function renderFile(filename, viewPanel, iframe, serverBase) {
  viewPanel.innerHTML = '<p style="padding:10px;">Loading and parsing circuit netlist...</p>';

  try {
    const response = await fetch(`${serverBase}/${filename}`);
    const netlistText = await response.text();

    const { components, nodes } = parseNetlist(netlistText);

    if (components.length === 0) {
      viewPanel.innerHTML = '<p style="color:orange;padding:10px;">Netlist loaded, but no components were identified or parsed.</p>';
      return;
    }

    const htmlSummary = generateCircuitSummary(components);
    const svgTopology = generateTopologySVG(components, nodes);

    // Combine the summary table and the SVG diagram
    viewPanel.innerHTML = `
      <div style="display:flex; flex-direction: column; gap: 20px; padding: 10px;">
          ${svgTopology}
          ${htmlSummary}
      </div>
    `;

  } catch (err) {
    console.error('Error loading or parsing CIR netlist:', err);
    viewPanel.innerHTML = '<p style="color:red;padding:10px;">Error loading or parsing netlist file.</p>';
  }
}
