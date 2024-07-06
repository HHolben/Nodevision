// Nodevision/public/NewNotebookPageInitializer.js
  fetch('/initialize', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'Initialize notebook' })
  })
  .then(response => response.text())
  .then(data => {
      console.log(data);
  })
  .catch(error => {
      console.error('Error:', error);
  });
