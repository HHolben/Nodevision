// Nodevision/public/ToolbarCallbacks/editCallbacks.js
export const editCallbacks = {
    editRASTER: () => {
        // Placeholder for edit RASTER functionality.
        console.log("Edit RASTER callback fired.");
    },

    editStyles: () => {
        console.log("Edit Styles callback fired.");

        // Find the currently selected element
        const selectedElement = window.getSelection()?.anchorNode?.parentElement;

        if (!selectedElement || !document.getElementById("editor").contains(selectedElement)) {
            alert("Please select an element in the editor first.");
            return;
        }

        const infoPanel = document.getElementById("element-info");
        if (!infoPanel) {
            console.error("Info panel not found!");
            return;
        }

        // Populate the info panel with a simple style editor
        infoPanel.innerHTML = `
            <h2>Edit Styles</h2>
            <textarea id="style-editor" style="width: 100%; height: 150px;"></textarea>
            <button id="apply-styles">Apply</button>
        `;

        const styleEditor = document.getElementById("style-editor");
        const applyButton = document.getElementById("apply-styles");

        // Load current inline styles
        styleEditor.value = selectedElement.getAttribute("style") || "";

        // Apply updated styles
        applyButton.addEventListener("click", () => {
            selectedElement.setAttribute("style", styleEditor.value);
        });
    }
};
