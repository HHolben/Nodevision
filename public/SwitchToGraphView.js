// SwitchToGraphView.js

(function() {
  // Grab the containers for the graph view and file view.
  const cyContainer = document.getElementById("cy");
  const fileViewContainer = document.getElementById("file-view");

  if (!cyContainer || !fileViewContainer) {
    console.error("Graph or file view container not found.");
    return;
  }

  // Immediately show the graph view by hiding the file view.
  fileViewContainer.style.display = "none";
  cyContainer.style.display = "block";

  // Initialize Cytoscape if it hasn't been created yet.
  if (!window.cyInstance) {
    // Sample data: Simulated first-level nodes from the Notebook directory.
    const elements = [
      { data: { id: "file1", label: "File1.md" } },
      { data: { id: "file2", label: "File2.html" } },
      { data: { id: "file3", label: "File3.txt" } }
      // You can add edges or more nodes as needed.
    ];

    window.cyInstance = cytoscape({
      container: cyContainer,
      elements: elements,
      style: [
        {
          selector: "node",
          style: {
            "content": "data(label)",
            "text-valign": "center",
            "color": "#fff",
            "background-color": "#0074D9",
            "text-outline-width": 2,
            "text-outline-color": "#0074D9"
          }
        },
        {
          selector: "edge",
          style: {
            "width": 2,
            "line-color": "#ccc",
            "target-arrow-color": "#ccc",
            "target-arrow-shape": "triangle"
          }
        }
      ],
      layout: {
        name: "grid",
        rows: 1
      }
    });
  }
})();
