
    // Ensure that ActiveNode is set
    if (window.ActiveNode !== undefined) {
        // Construct the URL with the current ActiveNode value
        const url = `WYSIWYG/WYSIWYGeditor.html?activeNode=${encodeURIComponent(window.ActiveNode)}`;
        // Redirect to the constructed URL
    //    window.location.href = url;
            // Open the constructed URL in a new browser window
    window.open(url, '_blank');
    } else {
        console.error('ActiveNode is not defined.');
    }

