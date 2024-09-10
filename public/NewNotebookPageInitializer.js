

    const selectedRegion = window.ActiveNode || null;


window.initializeNewNotebookPage = function() {
    console.log('Initializing new notebook page...');

    const fileName = document.getElementById('fileNameInput').value;

    if (!fileName) {
        alert('Please enter a file name.');
        return;
    }

    const newHtmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${fileName}</title>
        </head>
        <body>
            <h1>This is a new notebook page named ${fileName}!</h1>
            <p>This page was created by NewNotebookPageInitializer.js</p>
        </body>
        </html>
    `;

    fetch('/initialize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ htmlContent: newHtmlContent, fileName: fileName })
    })
    .then(response => response.text())
    .then(data => {
        console.log(data);

        // Ensure Cytoscape is ready before adding the new node
        if (window.cy) {
            // New node to add
            const newNode = {
                group: 'nodes',
                data: {
                    id: fileName,
                    label: fileName,
                    link: fileName,
                    imageUrl: "http://localhost:3000/DefaultNodeImage.png",
                    IndexNumber: Date.now() // Use a unique value or increment
                }
            };

            // Check if a region is selected and add the new node inside the selected region
            if (selectedRegion) {
                console.log(`Adding new node inside region: ${selectedRegion}`);

                // Add the node as a child of the selected region
                newNode.data.parent = selectedRegion;
            } else {
                console.log('No region selected, adding new node to the root level.');
            }

            // Add the new node to the Cytoscape instance
            window.cy.add(newNode);
            window.cy.layout({ name: 'cose' }).run(); // Optional: re-run layout to accommodate new nodes
            console.log('Node added to graph.');
        } else {
            console.error('Cytoscape instance not found.');
        }

        // Clear the selected region after the node is added
        selectedRegion = null;

    })
    .catch(error => {
        console.error('Error:', error);
    });
}
