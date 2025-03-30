// NewDirectoryInitializer.js





// Handle button click event to create a new directory
async function createDirectoryButton(directoryNameInput) {
    const directoryName = directoryNameInput.value.trim();
    const parentPath = ''; // Optionally provide a parent path, if applicable

    if (!directoryName) {
        alert('Please enter a directory name.');
        return;
    }

    try {
        // Make the API request to create a new directory
        const response = await fetch('/api/folderRoutes/create-directory', {  // Corrected endpoint
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                folderName: directoryName,
                parentPath: parentPath,
            }),
        });

        if (response.ok) {
            const result = await response.json();
            alert(result.message);  // Show success message
            directoryNameInput.value = '';  // Clear input field on success
        } else {
            const errorResult = await response.json();
            alert(`Error: ${errorResult.error}`);  // Show error message
        }
    } catch (error) {
        console.error('Error creating directory:', error);
        alert('An unexpected error occurred. Please try again.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Locate the Directory Name input field and initialize button dynamically
    const directoryNameInput = document.getElementById('DirectoryNameInput');

    // Ensure the input field exists before proceeding
    if (!directoryNameInput) {
        console.error('Directory Name input field not found.');
        return;
    }

    const createDirectoryButtonElement = document.createElement('button');
    createDirectoryButtonElement.id = 'createDirectoryButton';
    createDirectoryButtonElement.textContent = 'Create Directory';

    // Insert the button after the input field
    directoryNameInput.insertAdjacentElement('afterend', createDirectoryButtonElement);

    // Add event listener to the button to call createDirectoryButton function when clicked
    createDirectoryButtonElement.addEventListener('click', () => {
        createDirectoryButton(directoryNameInput);
    });
});
