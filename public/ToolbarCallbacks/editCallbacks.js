export const editCallbacks = {
    editRASTER: () => {
        console.log("Edit RASTER callback fired.");
    },
    

    editStyles: () => {
        console.log("Edit Styles callback fired.");

        const selectedElement = window.getSelection()?.anchorNode?.parentElement;

        if (!selectedElement || !document.getElementById("editor").contains(selectedElement)) {
            alert("Please select an element in the editor first.");
            return;
        }

        // Highlight selected element
        const previousOutline = selectedElement.style.outline;
        selectedElement.style.outline = "2px dashed red";

        const infoPanel = document.getElementById("element-info");
        if (!infoPanel) {
            console.error("Info panel not found!");
            return;
        }

        // Get computed styles for display
        const computedStyles = window.getComputedStyle(selectedElement);
        let inlineStyles = selectedElement.getAttribute("style") || "";
        
        infoPanel.innerHTML = `
            <h2>Edit Styles</h2>
            <textarea id="style-editor" style="width: 100%; height: 150px;"></textarea>
            <button id="apply-styles">Apply</button>
            <button id="cancel-styles">Cancel</button>
        `;

        const styleEditor = document.getElementById("style-editor");
        const applyButton = document.getElementById("apply-styles");
        const cancelButton = document.getElementById("cancel-styles");

        // Pre-fill textarea with inline styles (fall back to some common computed props)
        const commonProps = ["color", "background-color", "font-size", "margin", "padding", "border"];
        let styleText = inlineStyles;
        if (!inlineStyles) {
            styleText = commonProps
                .map(prop => `${prop}: ${computedStyles.getPropertyValue(prop)};`)
                .join("\n");
        }
        styleEditor.value = styleText;

        // Live preview as you type
        styleEditor.addEventListener("input", () => {
            mergeStyles(selectedElement, styleEditor.value);
        });

        // Apply button commits changes
        applyButton.addEventListener("click", () => {
            mergeStyles(selectedElement, styleEditor.value);
            selectedElement.style.outline = previousOutline; // remove highlight
        });

        // Cancel button restores old styles
        cancelButton.addEventListener("click", () => {
            selectedElement.setAttribute("style", inlineStyles);
            selectedElement.style.outline = previousOutline;
        });

        // Helper to merge styles without wiping all others
        function mergeStyles(element, newStyles) {
            const styleObj = {};
            newStyles.split(";").forEach(rule => {
                const [prop, value] = rule.split(":").map(s => s && s.trim());
                if (prop && value) styleObj[prop] = value;
            });
            for (let prop in styleObj) {
                element.style[prop] = styleObj[prop];
            }
        }
    },
  indentFile: () => {
    console.log("Indent File callback fired.");

    if (window.monacoEditor) {
      const editor = window.monacoEditor;
      editor.getAction('editor.action.formatDocument').run()
        .then(() => console.log("File successfully indented."))
        .catch(err => console.error("Failed to indent file:", err));
    } else {
      alert("Monaco editor is not active.");
    }
  }


};
