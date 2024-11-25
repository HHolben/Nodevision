// NewDirectoryInitializer.js

document.addEventListener('DOMContentLoaded', () => {
    // Locate the Directory Name input field and initialize button dynamically
    const directoryNameInput = document.getElementById('DirectoryNameInput');
    const createDirectoryButton = document.createElement('button');
    createDirectoryButton.id = 'createDirectoryButton';
    createDirectoryButton.textContent = 'Create Directory';
    directoryNameInput.insertAdjacentElement('afterend', createDirectoryButton);

    // Handle button click event to create a new directory
    createDirectoryButton.addEventListener('click', async () => {
        const directoryName = directoryNameInput.value.trim();
        const parentPath = ''; // Optionally provide a parent path, if applicable

        if (!directoryName) {
            alert('Please enter a directory name.');
            return;
        }

        try {
            // Make the API request to create a new directory
            const response = await fetch('/api/create-directory', {
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
                alert(result.message);
                directoryNameInput.value = ''; // Clear input field on success
            } else {
                const errorResult = await response.json();
                alert(`Error: ${errorResult.error}`);
            }
        } catch (error) {
            console.error('Error creating directory:', error);
            alert('An unexpected error occurred. Please try again.');
        }
    });
});
