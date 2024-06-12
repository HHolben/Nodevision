const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = 3000;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Proxy requests for PHP files to the PHP built-in server
app.use('/Notebook', createProxyMiddleware({
  target: 'http://localhost:8000', // URL of the PHP server
  changeOrigin: true
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Node.js server is running at http://localhost:${port}`);
  console.log(`PHP server should be running at http://localhost:8000`);
});
