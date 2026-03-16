// Nodevision/ApplicationSystem/public/SendToWYSIWYGeditorPage.js
// This file defines browser-side Send To WYSIWYGeditor Page logic for the Nodevision UI. It renders interface components and handles user interactions.
// public/SendToWYSIWYGeditorPage.js
// Purpose: TODO: Add description of module purpose


    // Ensure that ActiveNode is set
    if (window.ActiveNode !== undefined) {
        // Construct the URL with the current ActiveNode value
        const url = `WYSIWYG/WYSIWYGeditor.html?activeNode=${encodeURIComponent(window.ActiveNode)}`;
        // Redirect to the constructed URL
        window.open(url, "_blank");
    } else {
        console.error('ActiveNode is not defined.');
    }
