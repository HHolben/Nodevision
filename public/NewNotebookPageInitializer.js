window.initializeNewNotebookPage = function() {
    console.log('Initializing new notebook page...');

    const fileName = document.getElementById('fileNameInput').value;
    const fileExtension = document.getElementById('fileExtension').value; // Get selected file extension

    if (!fileName) {
        alert('Please enter a file name.');
        return;
    }

    // HTML content for the new notebook page
    const now = new Date();
    const year = now.getUTCFullYear();
    const monthIndex = now.getUTCMonth(); // 0-indexed month
    const date = String(now.getUTCDate()).padStart(2, '0');

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const monthName = months[monthIndex]; // Get the full month name
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const seconds = String(now.getUTCSeconds()).padStart(2, '0');

    const dateString = `${date} ${monthName} ${year}`;
    const timeString = `${hours}:${minutes}:${seconds} UTC`;

    let newHtmlContent = ''; // Initialize the content variable

    // Define content based on file extension
    switch (fileExtension) {
        case '.html':
            newHtmlContent = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${fileName}</title>
                </head>
                <body>
                    <h1>${fileName}</h1>
                    <h2>${dateString}</h2>
                    <h3>${timeString}</h3>
                </body>
                </html>
            `;
            break;

        case '.php':
            newHtmlContent = `
                <?php
                echo '<h1>${fileName}</h1>';
                echo '<h2>${dateString}</h2>';
                echo '<h3>${timeString}</h3>';
                ?>
            `;
            break;

        case '.js':
            newHtmlContent = `
                // ${fileName} JavaScript File
                console.log('File Name: ${fileName}');
                console.log('Date: ${dateString}');
                console.log('Time: ${timeString}');
            `;
            break;

        case '.ipynb':
            newHtmlContent = `
                {
                    "cells": [
                        {
                            "cell_type": "markdown",
                            "metadata": {},
                            "source": [
                                "# ${fileName}",
                                "### Date: ${dateString}",
                                "### Time: ${timeString}"
                            ]
                        }
                    ],
                    "metadata": {},
                    "nbformat": 4,
                    "nbformat_minor": 5
                }
            `;
            break;

        default:
            alert('Unsupported file extension selected.');
            return;
    }

    const selectedRegion = window.ActiveNode || ''; // Default to root if no region is selected
    const filePath = selectedRegion 
        ? `${selectedRegion}/${fileName}${fileExtension}` 
        : `${fileName}${fileExtension}`;  // Adjust file path based on the extension

    console.log(`Saving file to: ${filePath}`);

    // Send a POST request to the server to save the new file
    fetch('/initialize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ htmlContent: newHtmlContent, fileName: filePath }) // Save in the correct path
    })
    .then(response => response.text())
    .then(data => {
        console.log(data);

        // Ensure Cytoscape is ready before adding the new node
        if (window.cy) {
            const newNode = {
                group: 'nodes',
                data: {
                    id: filePath, // Unique ID for the node (file path is the ID)
                    label: fileName, // Label for the node
                    link: filePath, // Link to the newly created file
                    imageUrl: "http://localhost:3000/DefaultNodeImage.png", // Default image for nodes
                    IndexNumber: Date.now(), // Unique index number (or use any other unique value)
                    parent: selectedRegion // Add the new node as a child of the selected region (subdirectory)
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
