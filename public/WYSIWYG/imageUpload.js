
function uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    fetch('/upload-image', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Image uploaded successfully:', data.message);
        } else {
            console.error('Error uploading image:', data.message);
        }
    })
    .catch(error => {
        console.error('Error uploading image:', error);
    });
}





        // Event listener to handle the file upload
        document.addEventListener('DOMContentLoaded', function () {
            document.getElementById('fileUpload').addEventListener('change', function (event) {
                const file = event.target.files[0]; // Get the selected file
                if (file) {
                    uploadImage(file); // Upload and insert the image
                }
            });
        });

        window.onload = function() {
            loadFileContents();
        };



        function insertImage() {
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];
            
            if (file) {
                // Assuming you are manually placing the image in the right folder
                const filePath = `/uploads/${file.name}`; // Use the image folder path
                
                // Create an img tag with the file path
                const imgTag = `<img src="${filePath}" alt="Image" style="max-width:100%;">`;
                
                // Insert the img tag into the editor
                document.getElementById('editor').innerHTML += imgTag;
            } else {
                alert('Please select an image file');
            }
        }