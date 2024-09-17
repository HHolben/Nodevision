window.initializeNewNotebookPage = function() {
    console.log('Initializing new notebook page...');

    const fileName = document.getElementById('fileNameInput').value;

    if (!fileName) {
        alert('Please enter a file name.');
        return;
    }

    // HTML content for the new notebook page
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

    // Send a POST request to the server to save the new file
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
            const selectedRegion = window.ActiveNode; // Use ActiveNode to track the selected region

            if (!selectedRegion) {
                console.error('No region selected. Cannot add node.');
                return;
            }

            // Define the new node
            const newNode = {
                group: 'nodes',
                data: {
                    id: fileName, // Unique ID for the node (same as file name)
                    label: fileName, // Label for the node
                    link: fileName, // Link to the newly created file
                    imageUrl: "http://localhost:3000/DefaultNodeImage.png", // Default image for nodes
                    IndexNumber: Date.now(), // Unique index number (or use any other unique value)
                    parent: selectedRegion // Add the new node as a child of the selected region
                }
            };

            console.log(`Adding new node inside region: ${selectedRegion}`);

            // Add the new node to Cytoscape and re-run the layout
            window.cy.add(newNode);
            window.cy.layout({ name: 'cose' }).run(); // Optional: Run a layout algorithm
            console.log('Node added to graph.');
        } else {
            console.error('Cytoscape instance not found.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
};

// Ensure selectedRegion (ActiveNode) is defined and trigger initialization
const selectedRegion = window.ActiveNode || null;

if (!selectedRegion) {
    console.error('No region selected. Cannot add node.');
} else {
    initializeNewNotebookPage();
}
