function InsertTab()
{
    const Tab = `<span style="white-space: pre;">	</span>`;
    document.execCommand('insertHTML', false, Tab);
}

const inputField = document.getElementById('editor');

// Function to be called when the Tab key is pressed
function onTabKeyPressed(event) {
    if (event.key === "Tab") {
        event.preventDefault(); // Prevent the default tab behavior (focus change)
        InsertTab();
        // You can add any other functionality you want here
    }
}


        // Listen for the 'keydown' event (fires when a key is pressed down)
        inputField.addEventListener('keydown', onTabKeyPressed);


        
