// Nodevision/public/ToolbarCallbacks/editCallbacks.js

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

        const previousOutline = selectedElement.style.outline;
        selectedElement.style.outline = "2px dashed red";

        const infoPanel = document.getElementById("element-info");
        if (!infoPanel) {
            console.error("Info panel not found!");
            return;
        }

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

        const commonProps = ["color", "background-color", "font-size", "margin", "padding", "border"];
        let styleText = inlineStyles;
        if (!inlineStyles) {
            styleText = commonProps
                .map(prop => `${prop}: ${computedStyles.getPropertyValue(prop)};`)
                .join("\n");
        }
        styleEditor.value = styleText;

        styleEditor.addEventListener("input", () => {
            mergeStyles(selectedElement, styleEditor.value);
        });

        applyButton.addEventListener("click", () => {
            mergeStyles(selectedElement, styleEditor.value);
            selectedElement.style.outline = previousOutline;
        });

        cancelButton.addEventListener("click", () => {
            selectedElement.setAttribute("style", inlineStyles);
            selectedElement.style.outline = previousOutline;
        });

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
    },

    // === New VR World Editing Callbacks ===
    vrAddCube: () => {
        if (!window.VRWorldContext) {
            console.error("VR World context not found.");
            return;
        }
        const { scene, objects, THREE } = window.VRWorldContext;
        const geo = new THREE.BoxGeometry();
        const mat = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
        const cube = new THREE.Mesh(geo, mat);
        cube.position.set(Math.random() * 4 - 2, 1, Math.random() * 4 - 2);
        scene.add(cube);
        objects.push(cube);
        console.log("Cube added to VR world.");
    },

    vrAddSphere: () => {
        if (!window.VRWorldContext) {
            console.error("VR World context not found.");
            return;
        }
        const { scene, objects, THREE } = window.VRWorldContext;
        const geo = new THREE.SphereGeometry(0.5, 32, 32);
        const mat = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
        const sphere = new THREE.Mesh(geo, mat);
        sphere.position.set(Math.random() * 4 - 2, 1, Math.random() * 4 - 2);
        scene.add(sphere);
        objects.push(sphere);
        console.log("Sphere added to VR world.");
    },

    vrDeleteObject: () => {
        if (!window.VRWorldContext) {
            console.error("VR World context not found.");
            return;
        }
        const { scene, objects } = window.VRWorldContext;
        const obj = objects.pop();
        if (obj) {
            scene.remove(obj);
            console.log("Object deleted from VR world.");
        } else {
            console.warn("No objects left to delete.");
        }
    }
};
