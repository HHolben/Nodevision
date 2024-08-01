function initializeNewNotebookPage() {
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
        // Add new node to graph
        addNewNodeToGraph(fileName);
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function addNewNodeToGraph(fileName) {
    // Ensure the graph has been initialized
    if (typeof ReadNodes === 'function') {
        ReadNodes();

        // Create a new node
        var newNode = {
            data: {
                id: fileName,
                label: fileName,
                link: fileName,
                imageUrl: "http://localhost:3000/DefaultNodeImage.png",
                IndexNumber: nodes.length // or any other logic to assign IndexNumber
            }
        };

        // Add the new node to the nodes array
        nodes.push(newNode);

        // Refresh the graph
        fetch('GraphStyles.json')
            .then(response => response.json())
            .then(styles => {
                // Assuming GeneratedRegions.js and GeneratedEdges.js have been loaded
                elements = [...regions, ...nodes, ...edges];

                // Call the function to create or update the Cytoscape graph
                createCytoscapeGraph(elements, styles);
            })
            .catch(error => console.error('Error fetching styles:', error));
    } else {
        console.error('ReadNodes function is not available.');
    }
}

// Call the function to initialize the new notebook page
initializeNewNotebookPage();
