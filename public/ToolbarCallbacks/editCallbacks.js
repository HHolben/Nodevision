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
    console.log("Saving SVG:", window.filePath);
    
    // Check if we're in the new direct SVG editing mode and use the global save function
    if (window.currentSaveSVG && typeof window.currentSaveSVG === 'function') {
        console.log("Saving SVG file:", window.filePath);
        window.currentSaveSVG();
        return;
    }
    
    // Check if we're in the new direct SVG editing mode
    const svgEditor = document.getElementById('svg-editor');
    if (svgEditor && window.filePath) {
        console.log("Saving SVG file:", window.filePath);
        // Use the direct SVG editor approach
        const svgContent = svgEditor.outerHTML;
        
        fetch('/api/files/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filePath: window.filePath,
                content: svgContent
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const messageEl = document.getElementById('svg-message');
                if (messageEl) {
                    messageEl.textContent = 'SVG saved successfully!';
                    messageEl.style.color = 'green';
                }
                console.log('SVG saved successfully');
            } else {
                const errorEl = document.getElementById('svg-error');
                if (errorEl) {
                    errorEl.textContent = 'Error saving SVG: ' + data.error;
                }
                console.error('Error saving SVG:', data.error);
            }
        })
        .catch(error => {
            console.error('Save error:', error);
            const errorEl = document.getElementById('svg-error');
            if (errorEl) {
                errorEl.textContent = 'Network error while saving';
            }
        });
    } else if (window.filePath && window.saveSVG) {
        console.log("Saving SVG file:", window.filePath);
        // Fall back to the old iframe-based approach
        window.saveSVG(window.filePath);
    } else {
        console.warn("No save function found for current mode.");
        console.error("No SVG editor found or filePath not set");
    }
},
moveShape: () => {
    console.log("Move Shape callback fired");

    // Check if we're in the new direct SVG editing mode
    const svgEditor = document.getElementById('svg-editor');
    if (svgEditor) {
        // Use the direct SVG editor approach
        window.currentSVGTool = 'select';
        
        // Update toolbar if it exists
        const toolButtons = document.querySelectorAll('.svg-tool-btn');
        toolButtons.forEach(btn => btn.classList.remove('active'));
        const selectBtn = document.getElementById('svg-select-tool');
        if (selectBtn) {
            selectBtn.classList.add('active');
        }
        
        // Update message
        const messageEl = document.getElementById('svg-message');
        if (messageEl) {
            messageEl.textContent = 'Move tool active - click and drag shapes to move them';
        }
        
        console.log("Direct SVG move tool activated");
    } else {
        // Fall back to iframe-based approach
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
},

// === New Enhanced SVG Editing Callbacks ===
svgSelectTool: () => {
    console.log("SVG Select Tool activated");
    window.currentSVGTool = 'select';
    const svgEditor = document.getElementById('svg-editor');
    if (svgEditor) {
        svgEditor.style.cursor = 'pointer';
        document.getElementById('svg-message').textContent = 'Select Tool active - click on shapes to select them';
    }
},

svgDeleteShape: () => {
    console.log("Delete Shape callback fired");
    const selectedElement = window.selectedSVGElement;
    if (selectedElement && selectedElement.parentNode) {
        selectedElement.parentNode.removeChild(selectedElement);
        window.selectedSVGElement = null;
        document.getElementById('svg-message').textContent = 'Shape deleted';
    } else {
        document.getElementById('svg-message').textContent = 'No shape selected to delete';
    }
},

svgDuplicateShape: () => {
    console.log("Duplicate Shape callback fired");
    const selectedElement = window.selectedSVGElement;
    if (selectedElement) {
        const clone = selectedElement.cloneNode(true);
        
        // Offset the cloned element slightly
        if (clone.tagName === 'rect') {
            const x = parseFloat(clone.getAttribute('x') || 0) + 20;
            const y = parseFloat(clone.getAttribute('y') || 0) + 20;
            clone.setAttribute('x', x);
            clone.setAttribute('y', y);
        } else if (clone.tagName === 'circle') {
            const cx = parseFloat(clone.getAttribute('cx') || 0) + 20;
            const cy = parseFloat(clone.getAttribute('cy') || 0) + 20;
            clone.setAttribute('cx', cx);
            clone.setAttribute('cy', cy);
        }
        
        selectedElement.parentNode.appendChild(clone);
        document.getElementById('svg-message').textContent = 'Shape duplicated';
    } else {
        document.getElementById('svg-message').textContent = 'No shape selected to duplicate';
    }
},

svgChangeFillColor: () => {
    console.log("Change Fill Color callback fired");
    const selectedElement = window.selectedSVGElement;
    if (selectedElement) {
        const color = prompt('Enter fill color (hex, rgb, or color name):', selectedElement.getAttribute('fill') || '#000000');
        if (color) {
            selectedElement.setAttribute('fill', color);
            document.getElementById('svg-message').textContent = `Fill color changed to ${color}`;
        }
    } else {
        document.getElementById('svg-message').textContent = 'No shape selected to change fill color';
    }
},

svgChangeStrokeColor: () => {
    console.log("Change Stroke Color callback fired");
    const selectedElement = window.selectedSVGElement;
    if (selectedElement) {
        const color = prompt('Enter stroke color (hex, rgb, or color name):', selectedElement.getAttribute('stroke') || '#000000');
        if (color) {
            selectedElement.setAttribute('stroke', color);
            document.getElementById('svg-message').textContent = `Stroke color changed to ${color}`;
        }
    } else {
        document.getElementById('svg-message').textContent = 'No shape selected to change stroke color';
    }
},

svgChangeStrokeWidth: () => {
    console.log("Change Stroke Width callback fired");
    const selectedElement = window.selectedSVGElement;
    if (selectedElement) {
        const width = prompt('Enter stroke width (number):', selectedElement.getAttribute('stroke-width') || '1');
        if (width && !isNaN(width)) {
            selectedElement.setAttribute('stroke-width', width);
            document.getElementById('svg-message').textContent = `Stroke width changed to ${width}`;
        }
    } else {
        document.getElementById('svg-message').textContent = 'No shape selected to change stroke width';
    }
},

// === Publisher-like Editing Callbacks ===
svgCopy: () => {
    console.log("SVG Copy callback fired");
    const selectedElement = window.selectedSVGElement;
    if (selectedElement) {
        window.svgClipboard = selectedElement.cloneNode(true);
        document.getElementById('svg-message').textContent = 'Element copied to clipboard';
    } else {
        document.getElementById('svg-message').textContent = 'No element selected to copy';
    }
},

svgPaste: () => {
    console.log("SVG Paste callback fired");
    if (window.svgClipboard) {
        const svgEditor = document.getElementById('svg-editor');
        if (svgEditor) {
            const clone = window.svgClipboard.cloneNode(true);
            // Offset the pasted element
            if (clone.tagName === 'rect') {
                const x = parseFloat(clone.getAttribute('x') || 0) + 20;
                const y = parseFloat(clone.getAttribute('y') || 0) + 20;
                clone.setAttribute('x', x);
                clone.setAttribute('y', y);
            } else if (clone.tagName === 'circle') {
                const cx = parseFloat(clone.getAttribute('cx') || 0) + 20;
                const cy = parseFloat(clone.getAttribute('cy') || 0) + 20;
                clone.setAttribute('cx', cx);
                clone.setAttribute('cy', cy);
            }
            svgEditor.appendChild(clone);
            window.selectedSVGElement = clone;
            document.getElementById('svg-message').textContent = 'Element pasted';
        }
    } else {
        document.getElementById('svg-message').textContent = 'No element in clipboard to paste';
    }
},

svgAlignLeft: () => {
    console.log("SVG Align Left callback fired");
    const selectedElement = window.selectedSVGElement;
    if (selectedElement) {
        if (selectedElement.tagName === 'rect') {
            selectedElement.setAttribute('x', 10);
        } else if (selectedElement.tagName === 'circle' || selectedElement.tagName === 'ellipse') {
            const r = parseFloat(selectedElement.getAttribute('r') || selectedElement.getAttribute('rx') || 20);
            selectedElement.setAttribute('cx', 10 + r);
        } else if (selectedElement.tagName === 'text') {
            selectedElement.setAttribute('x', 10);
        }
        document.getElementById('svg-message').textContent = 'Element aligned to left';
    } else {
        document.getElementById('svg-message').textContent = 'No element selected to align';
    }
},

svgAlignCenter: () => {
    console.log("SVG Align Center callback fired");
    const selectedElement = window.selectedSVGElement;
    if (selectedElement) {
        const centerX = 400; // Half of SVG width (800)
        if (selectedElement.tagName === 'rect') {
            const width = parseFloat(selectedElement.getAttribute('width') || 0);
            selectedElement.setAttribute('x', centerX - width / 2);
        } else if (selectedElement.tagName === 'circle' || selectedElement.tagName === 'ellipse') {
            selectedElement.setAttribute('cx', centerX);
        } else if (selectedElement.tagName === 'text') {
            selectedElement.setAttribute('x', centerX);
        }
        document.getElementById('svg-message').textContent = 'Element aligned to center';
    } else {
        document.getElementById('svg-message').textContent = 'No element selected to align';
    }
},

svgAlignRight: () => {
    console.log("SVG Align Right callback fired");
    const selectedElement = window.selectedSVGElement;
    if (selectedElement) {
        const rightX = 790; // SVG width (800) minus margin
        if (selectedElement.tagName === 'rect') {
            const width = parseFloat(selectedElement.getAttribute('width') || 0);
            selectedElement.setAttribute('x', rightX - width);
        } else if (selectedElement.tagName === 'circle' || selectedElement.tagName === 'ellipse') {
            const r = parseFloat(selectedElement.getAttribute('r') || selectedElement.getAttribute('rx') || 20);
            selectedElement.setAttribute('cx', rightX - r);
        } else if (selectedElement.tagName === 'text') {
            selectedElement.setAttribute('x', rightX);
        }
        document.getElementById('svg-message').textContent = 'Element aligned to right';
    } else {
        document.getElementById('svg-message').textContent = 'No element selected to align';
    }
},

svgBringToFront: () => {
    console.log("SVG Bring to Front callback fired");
    const selectedElement = window.selectedSVGElement;
    if (selectedElement && selectedElement.parentNode) {
        selectedElement.parentNode.appendChild(selectedElement);
        document.getElementById('svg-message').textContent = 'Element brought to front';
    } else {
        document.getElementById('svg-message').textContent = 'No element selected to bring to front';
    }
},

svgSendToBack: () => {
    console.log("SVG Send to Back callback fired");
    const selectedElement = window.selectedSVGElement;
    if (selectedElement && selectedElement.parentNode) {
        const parent = selectedElement.parentNode;
        const firstChild = parent.querySelector(':not(defs):not(#grid-overlay)');
        if (firstChild) {
            parent.insertBefore(selectedElement, firstChild);
        }
        document.getElementById('svg-message').textContent = 'Element sent to back';
    } else {
        document.getElementById('svg-message').textContent = 'No element selected to send to back';
    }
}






};
