// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewCIR.mjs
// Purpose: Parse a SPICE-like netlist (.cir) file and render both a structured table 
//          and a basic SVG representation of the net topology.

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

/**
 * Parses a SPICE-like netlist string.
 * @param {string} text - The raw netlist file content.
 * @returns {{components: Array<Object>, nodes: Set<string>}} Parsed data.
 */
function parseNetlist(text) {
  const lines = text.split(/\r?\n/);
  const components = [];
  const nodes = new Set();
  
  // Matches component lines (e.g., R1 1 2 1k or Q1 3 2 1 MMOD)
  const componentRegex = /^\s*([R|L|C|V|I|D|Q|J|M|K|O|T|X])(\S+)\s+([\s\S]*?)\s*$/i;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip comments and control statements
    if (!trimmedLine || trimmedLine.startsWith('*') || trimmedLine.startsWith('.')) {
      continue;
    }

    const match = trimmedLine.match(componentRegex);

    if (match) {
      const type = match[1].toUpperCase();
      const name = match[2];
      const params = match[3].trim().split(/\s+/);
      
      let element = { type, name, nodes: [], value: null, model: null, rawParams: trimmedLine };

      // Determine the number of nodes expected for common elements
      let nodeCount;
      if (['R', 'L', 'C', 'V', 'I', 'D', 'K', 'T'].includes(type)) {
          nodeCount = 2;
      } else if (type === 'Q') { // BJT (Collector, Base, Emitter)
          nodeCount = 3;
      } else if (type === 'M') { // MOSFET (Drain, Gate, Source, Bulk)
          nodeCount = 4;
      } else if (type === 'X') { // Subcircuit (variable nodes)
          nodeCount = params.length - 1; 
      } else {
          nodeCount = 2; // Default to 2-terminal
      }

      element.nodes = params.slice(0, nodeCount);
      
      // Add nodes to the set
      element.nodes.forEach(node => nodes.add(node));

      // Separate value/model/remaining parameters
      const remainingParams = params.slice(nodeCount);
      
      if (['R', 'L', 'C'].includes(type) && remainingParams.length > 0) {
          element.value = remainingParams[0];
          element.params = remainingParams.slice(1).join(' ');
      } else if (['V', 'I'].includes(type)) {
          element.value = remainingParams.join(' '); // Source definition
      } else if (['D', 'Q', 'M', 'X'].includes(type) && remainingParams.length > 0) {
          element.model = remainingParams[0];
          element.params = remainingParams.slice(1).join(' ');
      }
      
      components.push(element);
    }
  }

  return { components, nodes };
}

/**
 * Generates an HTML summary table of the parsed circuit components.
 * @param {Array<Object>} components - The parsed component objects.
 * @returns {string} The HTML string.
 */
function generateCircuitSummary(components) {
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

  components.forEach(comp => {
    const connections = comp.nodes.join(', ');
    const valueModel = comp.value || comp.model || '—';
    const params = comp.params || '—';
    const typeColor = {
        'R': '#007bff', 'L': '#28a745', 'C': '#ffc107', 'V': '#dc3545', 'I': '#6f42c1'
    }[comp.type] || '#6c757d';

    html += '<tr>';
    html += `<td style="border:1px solid #eee;padding:6px;text-align:center;color:${typeColor};">**${comp.type}**</td>`;
    html += `<td style="border:1px solid #eee;padding:6px;">${comp.name}</td>`;
    html += `<td style="border:1px solid #eee;padding:6px;">${connections}</td>`;
    html += `<td style="border:1px solid #eee;padding:6px;">${valueModel}</td>`;
    html += `<td style="border:1px solid #eee;padding:6px;">${params}</td>`;
    html += '</tr>';
  });

  html += '</tbody></table>';
  return html;
}

/**
 * Generates a simplified SVG diagram representing nodes and component connections.
 * This is a visual aid, not a proper schematic.
 * 
 * @param {Array<Object>} components - The parsed component objects.
 * @param {Set<string>} nodes - Set of unique node names.
 * @returns {string} The SVG string.
 */
function generateTopologySVG(components, nodes) {
    const SVG_WIDTH = 600;
    const SVG_HEIGHT = 200;
    const NODE_RADIUS = 5;
    const NODE_COLOR = '#007bff';
    const LINE_COLOR = '#333';
    
    const nodeArray = Array.from(nodes);
    const nodePositions = {};
    const nodeY = SVG_HEIGHT / 2; // Keep all nodes on a single horizontal line for simplicity

    // Distribute nodes horizontally
    nodeArray.forEach((node, i) => {
        // Exclude 0 (Ground) from simple horizontal distribution unless it's the only one
        if (node === '0' && nodeArray.length > 1) {
             nodePositions[node] = { x: 50, y: nodeY + 50 }; // Place ground lower
        } else {
             const x = 50 + (i * (SVG_WIDTH - 100)) / (nodeArray.length - 1 || 1);
             nodePositions[node] = { x: x, y: nodeY };
        }
    });

    let svgElements = '';


// 1. Draw connections (orthogonal) between nodes
components.forEach((comp, index) => {
  if (comp.nodes.length >= 2) {
    const startNode = comp.nodes[0];
    const endNode = comp.nodes[1];

    const startPos = nodePositions[startNode];
    const endPos = nodePositions[endNode];

    if (!startPos || !endPos) return;

    // Slight offset to reduce overlap
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

    // Component label near the bend
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
  }
});





    // 2. Draw nodes (circles) and labels
    nodeArray.forEach(node => {
        const pos = nodePositions[node];
        if (pos) {
            // Circle for the node
            svgElements += `<circle cx="${pos.x}" cy="${pos.y}" r="${NODE_RADIUS}" fill="${NODE_COLOR}" />`;
            
            // Label for the node
            let labelY = pos.y + NODE_RADIUS + 10;
            if (node === '0') {
                 // Adjust label for ground symbol
                 svgElements += `<text x="${pos.x}" y="${pos.y + 20}" font-family="sans-serif" font-size="12" fill="#333" text-anchor="middle">GND</text>`;
            } else {
                 svgElements += `<text x="${pos.x}" y="${labelY}" font-family="sans-serif" font-size="12" fill="#333" text-anchor="middle">N${node}</text>`;
            }
           
        }
    });

    return `
        <h3 style="margin:10px 0;">Simplified Net Topology View</h3>
        <svg width="${SVG_WIDTH}" height="${SVG_HEIGHT + 30}" style="border: 1px solid #ccc; background: #fafafa;">
            ${svgElements}
        </svg>
    `;
}