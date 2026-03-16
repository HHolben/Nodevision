// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewCIR/parseNetlist.mjs
// This file defines a SPICE-like netlist parser for the ViewCIR file viewer in Nodevision. It extracts components and node identifiers from .cir text content.

/**
 * Parses a SPICE-like netlist string.
 * @param {string} text - The raw netlist file content.
 * @returns {{components: Array<Object>, nodes: Set<string>}} Parsed data.
 */
export function parseNetlist(text) {
  const lines = text.split(/\r?\n/);
  const components = [];
  const nodes = new Set();

  const componentRegex =
    /^\s*([R|L|C|V|I|D|Q|J|M|K|O|T|X])(\S+)\s+([\s\S]*?)\s*$/i;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("*") || trimmedLine.startsWith(".")) {
      continue;
    }

    const match = trimmedLine.match(componentRegex);

    if (!match) continue;

    const type = match[1].toUpperCase();
    const name = match[2];
    const params = match[3].trim().split(/\s+/);

    const element = { type, name, nodes: [], value: null, model: null, rawParams: trimmedLine };

    let nodeCount;
    if (["R", "L", "C", "V", "I", "D", "K", "T"].includes(type)) {
      nodeCount = 2;
    } else if (type === "Q") {
      nodeCount = 3;
    } else if (type === "M") {
      nodeCount = 4;
    } else if (type === "X") {
      nodeCount = params.length - 1;
    } else {
      nodeCount = 2;
    }

    element.nodes = params.slice(0, nodeCount);

    element.nodes.forEach((node) => nodes.add(node));

    const remainingParams = params.slice(nodeCount);

    if (["R", "L", "C"].includes(type) && remainingParams.length > 0) {
      element.value = remainingParams[0];
      element.params = remainingParams.slice(1).join(" ");
    } else if (["V", "I"].includes(type)) {
      element.value = remainingParams.join(" ");
    } else if (["D", "Q", "M", "X"].includes(type) && remainingParams.length > 0) {
      element.model = remainingParams[0];
      element.params = remainingParams.slice(1).join(" ");
    }

    components.push(element);
  }

  return { components, nodes };
}

