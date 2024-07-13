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
    })
    .catch(error => {
        console.error('Error:', error);
    });
    
}



        // New node to add
        var newNode = {
            "data": {
              "id": "Bob.html",
              "label": "Bob.html",
              "link": "Bob.html",
              "imageUrl": "http://localhost:3000/DefaultNodeImage.png",
              "IndexNumber": 1
            }
          };
          
        

        
initializeNewNotebookPage();

ReadNodes();

 // Adding the new node to the array
 elements.push(newNode);


 /*
elements = [...regions, ...nodes, ...edges];

 
          

  // Fetch styles from GraphStyles.json
  fetch('GraphStyles.json')
    .then(response => response.json())
    .then(styles => {
      // Merge nodes and regions into one elements array
      var elements = [...regions, ...nodes, ...edges];

      // Call the function to create the Cytoscape graph
      createCytoscapeGraph(elements, styles);
    })
    .catch(error => console.error('Error fetching styles:', error));
*/

console.log(nodes);
        
