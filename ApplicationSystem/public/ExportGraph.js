// public/ExportGraph.js
// Purpose: TODO: Add description of module purpose

    // Assuming 'cy' is your Cytoscape instance
 
        console.log("hello");

        const cy = window.cy;

          // Get the graph data in JSON format
          const graphData = cy.json();


          // Convert JSON data to a Blob (this creates a file object in memory)
          const blob = new Blob([JSON.stringify(graphData)], { type: 'application/json' });



                       // Create a temporary link to trigger the download
                       const link = document.createElement('a');
                       link.href = URL.createObjectURL(blob); // Create a URL for the Blob object
                       link.download = 'graph.json'; // Specify the default file name

                       
                       link.click();
          console.log(blob);

