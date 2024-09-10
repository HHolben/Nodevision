window.createNewRegion = function() {
    console.log('Creating new region...');

    const regionNameInput = document.getElementById('regionNameInput');
    const regionName = regionNameInput ? regionNameInput.value.trim() : null;

    if (!regionName) {
        alert('Please provide a name for the region.');
        return;
    }

    // Call server to create a new directory
    fetch('/createDirectory', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ directoryName: regionName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            console.log(data.message);

            // Add the new region node to Cytoscape graph
            if (window.cy) {
                const newRegion = {
                    group: 'nodes',
                    data: {
                        id: regionName,
                        label: regionName,
                        type: 'region',
                        imageUrl: 'http://localhost:3000/directory.png'
                    }
                };

                if (window.selectedRegion) {
                    newRegion.data.parent = window.selectedRegion;
                }

                window.cy.add(newRegion);
                window.cy.layout({ name: 'cose' }).run();
                console.log('New region added to graph.');
            } else {
                console.error('Cytoscape instance not found.');
            }
        } else {
            alert('Error creating directory. Please check the console for more details.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
};
