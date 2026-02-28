// public/WYSIWYG/imageUpload.js
// Purpose: TODO: Add description of module purpose

function uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    return fetch('/upload-image', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const filePath = data.filePath; // Use the file path returned by the server
            const linkTag = `<a href="${filePath}" target="_blank">View Uploaded Image</a>`;
            //document.getElementById('editor').innerHTML += linkTag;
            console.log('Image uploaded and link inserted successfully:', data.message);
        } else {
            document.getElementById('errorMessage').textContent = `Error uploading image: ${data.message}`;
            console.error('Error uploading image:', data.message);
        }
    })
    .catch(error => {
        document.getElementById('errorMessage').textContent = `Upload failed: ${error}`;
        console.error('Error uploading image:', error);
    });
}

// Event listener to handle the file upload
document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('fileUpload').addEventListener('change', function (event) {
        const file = event.target.files[0]; // Get the selected file
        if (file) {
            uploadImage(file); // Upload and insert the link
        }
    });
});

window.onload = function() {
    loadFileContents();
};
