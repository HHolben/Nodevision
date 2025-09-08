// Nodevision/routes/api/downloadFile.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.get('/download', (req, res) => {
  const filePath = req.query.path;
  console.log("The user is downloading file" + filePath)

  
  if (!filePath) return res.status(400).send("Missing 'path' parameter");

  const fullPath = path.join(__dirname, 'Notebook', filePath); // adjust base dir if needed

  fs.access(fullPath, fs.constants.R_OK, (err) => {
    if (err) return res.status(404).send("File not found");

    res.download(fullPath, path.basename(fullPath), (err) => {
      if (err) console.error("Error sending file:", err);
    });
  });
});

module.exports = router;
