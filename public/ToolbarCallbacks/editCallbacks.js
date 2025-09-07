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
    },
// === SVG Editing Callbacks ===
switchToSVGEditing: () => {
    console.log("Switching to SVG Editing mode");
    if (window.filePath && window.SwitchToSVGediting) {
        window.SwitchToSVGediting(); // call the main switch script
    } else {
        console.error("SVG editing scripts not loaded or filePath not set");
    }
},

saveSVG: () => {
    console.log("Saving SVG file");
    if (window.filePath && window.saveSVG) {
        window.saveSVG(window.filePath);
    } else {
        console.error("saveSVG function not available or filePath not set");
    }
},
moveShape: () => {
    console.log("Move Shape callback fired");

    const waitForIframe = () => {
        const iframe = document.getElementById("content-frame");
        if (!iframe) {
            // Retry after a short delay
            setTimeout(waitForIframe, 100);
            return;
        }

        // Now the iframe exists; wait for its content to load
        const initSelection = () => {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            const svg = doc.querySelector("svg");
            if (!svg) {
                console.error("SVG element not found in iframe");
                return;
            }

            let selected = null;

            const clearSelection = () => {
                if (selected) {
                    selected.style.stroke = null;
                    selected.style.strokeWidth = null;
                    selected.style.strokeDasharray = null;
                    selected = null;
                }
            };

            svg.addEventListener("mousedown", e => {
                if (e.target === svg) {
                    clearSelection();
                    console.log("Selection cleared");
                    return;
                }

                if (selected) clearSelection();
                selected = e.target;
                selected.style.stroke = "red";
                selected.style.strokeWidth = "2";
                selected.style.strokeDasharray = "4,2";

                console.log("Shape selected:", selected.tagName);
            });
        };

        if (iframe.contentDocument && iframe.contentDocument.readyState === "complete") {
            initSelection();
        } else {
            iframe.onload = initSelection;
        }
    };

    waitForIframe();
    console.log("Waiting for SVG iframe to initialize selection...");
}






};
