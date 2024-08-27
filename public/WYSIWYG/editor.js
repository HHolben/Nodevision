        // Utility function to get query parameters
        function getQueryParameter(name) {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get(name);
        }

        // Get the activeNode from the URL parameters
        const activeNode = getQueryParameter('activeNode');
        console.log('ActiveNode:', activeNode);

        // Construct the file path based on the activeNode
        let filePath = '';
        if (activeNode) {
            filePath = `Notebook/${activeNode}`;
        } else {
            console.error('No activeNode provided');
            document.getElementById('errorMessage').textContent = 'Error: No activeNode provided.';
        }

        // Function to fetch and display file contents
        function loadFileContents() {
            if (!filePath) return;
            
            fetch(`/api/file?path=${encodeURIComponent(filePath)}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    document.getElementById('editor').innerHTML = data.content;
                    console.log('File content loaded:', data.content);
                })
                .catch(error => {
                    console.error('Error fetching file content:', error);
                    document.getElementById('errorMessage').textContent = 'Error fetching file content: ' + error.message;
                });
        }

        // Function to save file contents
        function saveFileContents() {
            const content = document.getElementById('editor').innerHTML;
            fetch('/api/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ path: filePath, content: content })
            })
            .then(response => response.text())
            .then(data => {
                const saveMessage = document.getElementById('message');
                saveMessage.textContent = 'File saved successfully!';
                setTimeout(() => saveMessage.textContent = '', 3000);  // Clear after 3 seconds
            })
            .catch(error => {
                console.error('Error saving file content:', error);
                document.getElementById('errorMessage').textContent = 'Error saving file content: ' + error.message;
            });
        }

        // Function to apply selected formatting
        function applyStyle(tag) {
            document.execCommand('formatBlock', false, tag);
        }

        // Function to trigger file input click
        function triggerFileInput() {
            document.getElementById('fileUpload').click();  // Open file dialog
        }

 
        

