const express = require('express'); // Add this line to import express
const favicon = require('serve-favicon');
const path = require('path');

module.exports = (app, path, fs) => {
    // Serve favicon
    app.use(favicon(path.join(__dirname, '..', 'public', 'favicon.ico')));

    // Serve static files
    app.use(express.static(path.join(__dirname, '..', 'public')));
    app.use('/vendor', express.static(path.join(__dirname, '..', 'node_modules')));
    app.use('/Notebook', express.static(path.join(__dirname, '..', 'Notebook')));
};
