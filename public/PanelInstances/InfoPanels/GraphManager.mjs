// Nodevision/public/PanelInstances/InfoPanels/GraphManager.mjs
// Graph-styled file manager with lazy directory loading and collapsed-edge behavior

/* eslint-disable no-undef */


export async function setupPanel(panelElem, panelVars = {}) {
  console.log("[GraphManager] setupPanel", panelVars);

  panelElem.innerHTML = `
    <div class="graph-manager" style="display:flex; flex-direction:column; height:100%;">
      <div style="display:flex;align-items:center;gap:12px;padding:8px;border-bottom:1px solid #ddd;">
        <strong>Graph View (file manager)</strong>
        <span id="gm-status" style="font-size:12px;color:#666;">Initializing...</span>
      </div>
      <div class="cy-container" style="flex:1; width:100%;"></div>
    </div>
  `;

  const status = panelElem.querySelector("#gm-status");
  const container = panelElem.querySelector(".cy-container");

  const NODE_ROOT = "Notebook"; // project-relative root id
  const directoryState = {}; // { id: { expanded, childrenLoaded } }
  let cy = null;

  // helper: compute bucket symbol for id (first unicode char of local name)
  function bucketSymbolForId(id) {
    const localName = id.split("/").pop() || id;
    return [...localName][0] || "_";
  }

  // helper: compute bucket filename
  function bucketFileForId(id) {
    const sym = bucketSymbolForId(id);
    // normalize filesystem safe name (fallback to '_' for weird)
    const safe = sym === undefined ? "_" : sym;
    return encodeURIComponent(safe) + ".json";
  }

  // init cytoscape
  try {
    status.textContent = "Loading cytoscape...";
    const cytoscapeMod = await import("/vendor/cytoscape/dist/cytoscape.esm.mjs");
    if (!cytoscapeMod) throw new Error("Failed to import cytoscape");

    const cytoscape = cytoscapeMod.default || cytoscapeMod;
    console.log("[GraphManager] cytoscape loaded", cytoscape);

    // destroy previous instance if exists
    if (panelVars.cyInstance) {
      console.log("[GraphManager] destroying previous cy instance");
      panelVars.cyInstance.destroy();
      panelVars.cyInstance = null;
    }

    cy = cytoscape({
      container,
      elements: [],
      style: [
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
      ],
      layout: { name: "grid", avoidOverlap: true, fit: true },
      userZoomingEnabled: true,
      boxSelectionEnabled: false
    });

    panelVars.cyInstance = cy;
    console.log("[GraphManager] cytoscape instance created");

    // WHEN VISIBLE NODES CHANGE -> recompute edges
    // we will call recomputeEdges() after any expand/collapse
    async function recomputeEdges() {
      try {
        status.textContent = "Resolving edges...";
        console.log("[GraphManager] recomputeEdges: computing visible nodes & buckets");

        // compute visible node IDs and set of needed buckets
        const visibleNodes = cy.nodes().map(n => n.id());
        const visibleSet = new Set(visibleNodes);
        const neededBuckets = new Set([...visibleNodes].map(bucketFileForId));

        // fetch bucket files in parallel (unique)
        const bucketList = [...neededBuckets];
        const bucketPromises = bucketList.map(b => fetch(`/api/readEdgeBucket?file=${b}`).then(r => {
          if (!r.ok) {
            console.warn("[GraphManager] bucket fetch failed:", b, r.status);
            return {};
          }
          return r.json();
        }).catch(err => {
          console.error("[GraphManager] bucket fetch err", b, err);
          return {};
        }));

        const buckets = await Promise.all(bucketPromises);
        const edgeIndex = Object.create(null); // id -> { edgesFrom, edgesTo }
        for (const bucket of buckets) {
          if (!bucket || typeof bucket !== "object") continue;
          for (const [id, rec] of Object.entries(bucket)) {
            edgeIndex[id] = {
              edgesFrom: (rec.edgesFrom || rec.sources || []).slice(),
              edgesTo: (rec.edgesTo || rec.targets || rec.destinations || []).slice()
            };
          }
        }

        console.log("[GraphManager] edgeIndex size:", Object.keys(edgeIndex).length);

        // Build "effective" node mapping: for any id, find nearest visible ancestor
        // Also helpful: build an array of visible directories for prefix matching
        const visibleDirIds = visibleNodes.filter(id => {
          const el = cy.getElementById(id);
          return el && el.data && el.data("type") === "directory";
        });

        // helper: find nearest visible ancestor for a given target id
        function nearestVisibleAncestor(targetId) {
          // If the target itself is visible, return it.
          if (visibleSet.has(targetId)) return targetId;

          // Walk up path progressively to find closest visible ancestor
          const parts = targetId.split("/");
          for (let i = parts.length - 1; i > 0; i--) {
            const ancestor = parts.slice(0, i).join("/");
            if (visibleSet.has(ancestor)) return ancestor;
          }
          // not found
          return null;
        }

        // Collect aggregated edges: use a Map keyed by "source|target" to dedupe
        const aggregated = new Map();

        // For every visible node, inspect its outgoing edges (edgesFrom)
        for (const srcId of visibleNodes) {
          const rec = edgeIndex[srcId] || { edgesFrom: [], edgesTo: [] };
          const outs = rec.edgesFrom || [];
          for (const rawTarget of outs) {
            const targetEffective = nearestVisibleAncestor(rawTarget);
            if (!targetEffective) continue; // target not visible anywhere
            // If both source and target are "inside" some collapsed directories,
            // we expect nearestVisibleAncestor to pick the correct visible nodes already.
            const key = `${srcId}|${targetEffective}`;
            if (!aggregated.has(key)) {
              aggregated.set(key, { data: { id: `e:${srcId}->${targetEffective}`, source: srcId, target: targetEffective }});
            }
          }
        }

        // Also consider incoming edges (so collapsed dirs that have incoming from hidden nodes can be aggregated)
        for (const targetId of visibleNodes) {
          const rec = edgeIndex[targetId] || { edgesFrom: [], edgesTo: [] };
          const ins = rec.edgesTo || [];
          for (const rawSource of ins) {
            const sourceEffective = nearestVisibleAncestor(rawSource);
            if (!sourceEffective) continue;
            const key = `${sourceEffective}|${targetId}`;
            if (!aggregated.has(key)) {
              aggregated.set(key, { data: { id: `e:${sourceEffective}->${targetId}`, source: sourceEffective, target: targetId }});
            }
          }
        }

        // Remove existing edges and add new aggregated edges
        cy.batch(() => {
          cy.edges().remove();
          if (aggregated.size > 0) {
            cy.add([...aggregated.values()]);
          }
        });

        console.log("[GraphManager] rendered edges:", aggregated.size);
        status.textContent = `Ready — ${cy.nodes().length} nodes, ${aggregated.size} edges`;
      } catch (err) {
        console.error("[GraphManager] recomputeEdges error", err);
        status.textContent = "Edge resolution error (see console)";
      }
    }

    // --------- Directory loading functions ---------
    async function listDirectory(pathId) {
      console.log("[GraphManager] listDirectory:", pathId);
      status.textContent = `Loading ${pathId}...`;
      const q = `/api/listDirectory?path=${encodeURIComponent(pathId)}`;
      const res = await fetch(q);
      if (!res.ok) {
        console.error("[GraphManager] listDirectory failed", res.status, res.statusText);
        status.textContent = `Failed to load ${pathId}`;
        return { directories: [], files: [] };
      }
      const data = await res.json();
      // expect { directories: [names], files: [names] }
      return data;
    }

    // add only the directory node (no children)
    function addDirectoryNode(pathId, parentId = null) {
      if (cy.getElementById(pathId).length) return;
      const shortName = pathId.split("/").pop();
      cy.add({
        data: {
          id: pathId,
          label: shortName || pathId,
          type: "directory",
          parent: parentId || null
        }
      });
    }

    // add file node
    function addFileNode(id, parentId) {
      if (cy.getElementById(id).length) return;
      const shortName = id.split("/").pop();
      cy.add({
        data: {
          id,
          label: shortName,
          type: "file",
          parent: parentId || null
        }
      });
    }

    // Add root directory and its immediate children (one directory at a time model)
    async function loadRoot() {
      console.log("[GraphManager] loadRoot");
      directoryState[NODE_ROOT] = directoryState[NODE_ROOT] || { expanded: false, childrenLoaded: false };
// loadRoot()
const data = await listDirectory(NODE_ROOT);

// Add direct children of Notebook, but NOT Notebook itself
for (const d of data.directories) {
  const id = `${NODE_ROOT}/${d}`;
  addDirectoryNode(id, null);        // parent = null
}
for (const f of data.files) {
  const id = `${NODE_ROOT}/${f}`;
  addFileNode(id, null);             // parent = null
}
      // fetch children of root
      if (!directoryState[NODE_ROOT].childrenLoaded) {
        const data = await listDirectory(NODE_ROOT);
        // Add children as direct children of NODE_ROOT
        for (const d of data.directories || []) {
          const id = `${NODE_ROOT}/${d}`;
          addDirectoryNode(id, NODE_ROOT);
          directoryState[id] = directoryState[id] || { expanded: false, childrenLoaded: false };
        }
        for (const f of data.files || []) {
          const id = `${NODE_ROOT}/${f}`;
          addFileNode(id, NODE_ROOT);
        }
        directoryState[NODE_ROOT].childrenLoaded = true;
      }
      await cy.layout({ name: "grid", avoidOverlap: true, fit: true }).run();
      status.textContent = `Ready — ${cy.nodes().length} nodes`;
      await recomputeEdges();
    }

    // Expand directory (load children only once)
    async function expandDirectory(pathId) {
      console.log("[GraphManager] expandDirectory:", pathId);
      const state = (directoryState[pathId] = directoryState[pathId] || { expanded: false, childrenLoaded: false });
      if (!state.childrenLoaded) {
        const data = await listDirectory(pathId);
        // Add subdirectories
        for (const d of data.directories || []) {
          const childId = `${pathId}/${d}`;
          addDirectoryNode(childId, pathId);
          directoryState[childId] = directoryState[childId] || { expanded: false, childrenLoaded: false };
        }
        // Add files
        for (const f of data.files || []) {
          const fileId = `${pathId}/${f}`;
          addFileNode(fileId, pathId);
        }
        state.childrenLoaded = true;
      }
      state.expanded = true;
      // don't animate: faster
      cy.layout({ name: "grid", avoidOverlap: true, fit: false }).run();
      await recomputeEdges();
    }

    // Collapse directory: remove its descendant nodes (only those with prefix pathId/)
    async function collapseDirectory(pathId) {
      console.log("[GraphManager] collapseDirectory:", pathId);
      const descendants = cy.nodes().filter(n => {
        const nid = n.id();
        return nid !== pathId && nid.startsWith(pathId + "/");
      });
      console.log("[GraphManager] removing descendants:", descendants.length);
      cy.batch(() => {
        descendants.remove();
      });

      // mark as collapsed
      if (directoryState[pathId]) directoryState[pathId].expanded = false;
      // recompute edges (so edges attach to directory-level again)
      await recomputeEdges();
      cy.layout({ name: "grid", avoidOverlap: true, fit: false }).run();
    }

    // click handlers: expand/collapse directory on tap; open files on click
    cy.on("tap", "node[type='directory']", async (evt) => {
      const node = evt.target;
      const pathId = node.id();
      const state = directoryState[pathId] || { expanded: false, childrenLoaded: false };
      if (!state.expanded) {
        await expandDirectory(pathId);
      } else {
        await collapseDirectory(pathId);
      }
    });

    cy.on("tap", "node[type='file']", (evt) => {
      const node = evt.target;
      const id = node.id();
      console.log("[GraphManager] file node tapped:", id);
      // notify fileSelected so FileView can open it
      window.selectedFilePath = id; // project-relative id
      window.dispatchEvent(new CustomEvent("fileSelected", { detail: { path: id } }));
    });

    // load root on start
    await loadRoot();

    status.textContent = `Ready — ${cy.nodes().length} nodes`;
  } catch (err) {
    console.error("[GraphManager] error during setup", err);
    const status = panelElem.querySelector("#gm-status");
    if (status) status.textContent = "Error initializing GraphManager (see console)";
  }

  // --- FILE SELECTION LOGIC (integrate FileManagerCore behavior) ---
let lastSelected = null;

// Clear previous selection highlight
function clearSelection() {
  if (lastSelected) {
    lastSelected.style("border-color", "#a8b8d8");
    lastSelected.style("border-width", 2);
  }
  lastSelected = null;
}

// Highlight selection
function highlight(node) {
  clearSelection();
  lastSelected = node;

  node.style("border-color", "#0066ff");
  node.style("border-width", 4);

  const id = node.id();
  console.log("[GraphManager] Selected:", id);

  // Make it available for toolbar actions
  window.selectedFilePath = id;
}

// Single-click = select
cy.on("tap", "node", evt => {
  const node = evt.target;
  highlight(node);
});

// Double-click = open file (same as FileManagerCore)
let lastTapTime = 0;

cy.on("tap", "node", evt => {
  const now = Date.now();
  const node = evt.target;

  if (now - lastTapTime < 250) {
    // Double-click
    const id = node.id();
    console.log("[GraphManager] Opening:", id);

    window.selectedFilePath = id;
    window.open(`/Notebook/${id}`, "_blank");
  }

  lastTapTime = now;
});

}

