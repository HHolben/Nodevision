
    // Ensure that ActiveNode is set
    if (window.ActiveNode !== undefined) {
        // Construct the URL with the current ActiveNode value
        const url = `WYSIYGeditor.html?filepath=${encodeURIComponent(window.ActiveNode)}`;
        // Redirect to the constructed URL
        window.location.href = url;
    } else {
        console.error('ActiveNode is not defined.');
    }

