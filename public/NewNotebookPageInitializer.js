window.initializeNewNotebookPage = function() {
    console.log('Initializing new notebook page...');

    const fileName = document.getElementById('fileNameInput').value;

    if (!fileName) {
        alert('Please enter a file name.');
        return;
    }

    // HTML content for the new notebook page
      // Get UTC date components
      const now = new Date();
      const year = now.getUTCFullYear();
      const monthIndex = now.getUTCMonth(); // 0-indexed month
      const date = String(now.getUTCDate()).padStart(2, '0');

       // Array of month names
       const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    // Format date and time
    const monthName = months[monthIndex]; // Get the full month name


      // Get UTC time components
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const minutes = String(now.getUTCMinutes()).padStart(2, '0');
      const seconds = String(now.getUTCSeconds()).padStart(2, '0');
      

      // Format date and time
      const dateString = `${date} ${monthName} ${year}`;
      const timeString = `${hours}:${minutes}:${seconds} UTC`;

    
    const newHtmlContent = `
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

    const selectedRegion = window.ActiveNode || ''; // Default to root if no region is selected

    // Construct the file path, adding the node inside the selected region (subdirectory)
    const filePath = selectedRegion 
        ? `${selectedRegion}/${fileName}.html`  // Inside the selected subdirectory
        : `${fileName}.html`;                   // In the root directory if no region selected

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
