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

        // New node to add
        var newNode = {
            "data": {
              "id": fileName,
              "label": fileName,
              "link": fileName,
              "imageUrl": "http://localhost:3000/DefaultNodeImage.png",
              "IndexNumber": elements.length + 1
            }
        };

        // Adding the new node to the array
        elements.push(newNode);

        // Update Cytoscape graph with the new node
        createCytoscapeGraph(elements, styles);
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

initializeNewNotebookPage();