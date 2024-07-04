 // Send a request to the server to generate the file
 fetch('\server.js', {
    method: 'POST', // or 'GET' depending on your server implementation
    headers: {
      'Content-Type': 'application/json',
    },
    // Optionally, you can send data to the server if needed
    body: JSON.stringify({}),
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.blob(); // assuming the server sends back a file
  })
  .then(blob => {
    // Handle the response blob (e.g., save it locally or display a download link)
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated.html'; // specify the filename here
    document.body.appendChild(a);
    a.click();
    a.remove();
  })
  .catch(error => {
    console.error('Error:', error);
  });
