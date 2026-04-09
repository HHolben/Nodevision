// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewCIR/parseNetlist.mjs
// This file defines a SPICE-like netlist parser for the ViewCIR file viewer in Nodevision. It extracts components and node identifiers from .cir text content.

/**
 * Parses a SPICE-like netlist string.
 * @param {string} text - The raw netlist file content.
 * @returns {{components: Array<Object>, nodes: Set<string>}} Parsed data.
 */
export function parseNetlist(text) {
  const components = [];
  const nodes = new Set();

  const defaultNodeCounts = {
    R: 2,
    L: 2,
    C: 2,
    V: 2,
    I: 2,
    D: 2,
    K: 2,
    T: 2,
    Q: 3,
    J: 3,
    M: 4,
    O: 2,
  };

  const lines = String(text || "")
    .split(/\r?\n/)
    // Strip inline comments that start with ";" or "//" and trim whitespace.
    .map((line) => line.replace(/(;|\/\/).*$/, "").trim())
    // Leading "*" denotes full-line comment in many SPICE dialects.
    .map((line) => (line.startsWith("*") ? "" : line))
    .filter(Boolean);

  for (const line of lines) {
    // Ignore control statements / directives
    if (line.startsWith(".")) {
      const directive = line.slice(1).toLowerCase();
      const skip = ["end", "ends", "title", "include", "model", "subckt", "options", "option", "param", "params"];
      if (skip.some((kw) => directive.startsWith(kw))) continue;
    }

    const match = line.match(/^([rclvidqjmkotx])(\S*)\s+(.*)$/i);
    if (!match) continue;

    const type = match[1].toUpperCase();
    const name = match[2] || "";
    const tokens = match[3].trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;

    let nodeCount = defaultNodeCounts[type] ?? 2;
    if (type === "X") {
      // Subcircuits: all but final token are nodes (at least two)
      nodeCount = Math.max(2, tokens.length - 1);
    }

    const elementNodes = tokens.slice(0, Math.min(nodeCount, tokens.length));
    elementNodes.forEach((node) => nodes.add(node));

    const remaining = tokens.slice(elementNodes.length);

    const element = {
      type,
      name,
      nodes: elementNodes,
      value: null,
      model: null,
      rawParams: line,
    };

    if (["R", "L", "C"].includes(type) && remaining[0]) {
      element.value = remaining.shift();
      element.params = remaining.join(" ") || null;
    } else if (["V", "I"].includes(type) && remaining.length) {
      element.value = remaining.join(" ");
    } else if (["D", "Q", "M", "X", "J"].includes(type) && remaining.length) {
      element.model = remaining.shift();
      element.params = remaining.join(" ") || null;
    }

    components.push(element);
  }

  return { components, nodes };
}
