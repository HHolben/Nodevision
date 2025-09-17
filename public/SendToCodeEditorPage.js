// public/SendToCodeEditorPage.js
// Purpose: TODO: Add description of module purpose

//location.replace("CodeEditor.html");


    // Ensure that ActiveNode is set
    if (window.ActiveNode !== undefined) {
        // Construct the URL with the current ActiveNode value
        const url = `CodeEditor.html?activeNode=${encodeURIComponent(window.ActiveNode)}`;
        // Redirect to the constructed URL
        window.location.href = url;
    } else {
        console.error('ActiveNode is not defined.');
    }

