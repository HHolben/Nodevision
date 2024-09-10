window.deleteNodeOrDirectory = function() {
    console.log('Deleting node or directory...');

    // Get the name of the item to delete from the draggable box's input field
    const deleteItemInput = document.getElementById('deleteItemInput');
    const itemName = deleteItemInput ? deleteItemInput.value.trim() : null;

    if (!itemName) {
        alert('Please provide a valid node or directory name.');
        return;
    }

    // Move the node or directory to the Trash folder
    fetch('/moveToTrash', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ itemName: itemName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            console.log(data.message);

            // Remove the node from the Cytoscape graph if it's there
            if (window.cy) {
                const node = window.cy.getElementById(itemName);
                if (node) {
                    node.remove();  // Remove node from graph
                    console.log('Node or directory removed from graph.');
                } else {
                    console.warn('Node or directory not found in the graph.');
                }
            }

        } else {
            alert('Error moving the node or directory. Please check the console for more details.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}
