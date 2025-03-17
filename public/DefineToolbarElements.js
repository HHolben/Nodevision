export const boxes = [
    // Always visible items:
    {
        heading: "New Node",
        content: `
        <div style="display: flex; align-items: center; gap: 8px;">
            <input type="text" id="fileNameInput" placeholder="Enter file name">
            <select id="fileExtension" name="FileExtension">
                <option value=".html">.html</option>
                <option value=".php">.php</option>
                <option value=".js">.js</option>
                <option value=".ipynb">.ipynb</option>
            </select>
        </div>
        `,
        script: "NewNotebookPageInitializer.js",
        ToolbarCategory: "File"
    },
    {
        ToolbarCategory: 'File',
        heading: 'Save File',
        content: ``,
        callback: () => {
            const filePath = window.currentActiveFilePath;
            if (filePath && typeof window.saveWYSIWYGFile === 'function') {
                window.saveWYSIWYGFile(filePath);
            } else {
                console.error("Cannot save: filePath or saveWYSIWYGFile is missing.");
            }
        }
    },
    {
        ToolbarCategory: 'File',
        heading: 'View Nodevision Deployment',
        content: ``,
        callback: () => {
            
    // Get the current URL
    const currentUrl = window.location.href;

    // Use URLSearchParams to extract the activeNode parameter
    const urlParams = new URLSearchParams(window.location.search);
    const activeNode = urlParams.get('activeNode');

    if (activeNode) {
        // Construct the  URL
        const deploymentUrl = `http://localhost:3000/${activeNode}`;

        // Open the URL in a new window or tab
        window.open(deploymentUrl, "_blank");
    } else {
        alert("No active node specified in the URL.");
    }
        }
        },
    {
        ToolbarCategory: 'File',
        heading: 'View PHP Deployment',
        content: ``,
        callback: () => {
            
    // Get the current URL
    const currentUrl = window.location.href;

    // Use URLSearchParams to extract the activeNode parameter
    const urlParams = new URLSearchParams(window.location.search);
    const activeNode = urlParams.get('activeNode');

    if (activeNode) {
        // Construct the  URL
        const deploymentUrl = `http://localhost:8000/${activeNode}`;

        // Open the URL in a new window or tab
        window.open(deploymentUrl, "_blank");
    } else {
        alert("No active node specified in the URL.");
    }
        },
        modes: ["WYSIWYG Editing"]
    },
    {
        heading: "New Directory",
        content: ``,
        script: "NewDirectoryInitializer.js",
        ToolbarCategory: "File",
    },
    {
        heading: "Export Graph",
        content: ``,
        script: "ExportGraph.js",
        ToolbarCategory: "File",
    },
    {
        heading: "Edit Code",
        content: ``,
        script: "SendToCodeEditorPage.js",
        ToolbarCategory: "Edit",
    },
    {
        heading: "WYSIWYG Editor",
        content: ``,
        script: "SendToWYSIWYGeditorPage.js",
        ToolbarCategory: "Edit",
    },
    {
        heading: "Settings",
        content: `<iframe src="SettingsPage.html"></iframe>`,
        script: "SendToCodeSettingsPage.js",
        ToolbarCategory: "Settings",
    },
    {
        ToolbarCategory: 'Settings',
        heading: 'Toggle View Mode',
        type: 'toggle',
        callback: (state) => {
            console.log("Toggle View Mode callback fired. State:", state);
            const cyContainer = document.getElementById('cy');
            const fileViewContainer = document.getElementById('file-view');
            
            if (state) {
                // Show graph view.
                cyContainer.style.display = 'block';
                fileViewContainer.style.display = 'none';
                if (window.cy) {
                    initializeTheGraphStyles();
                    cy.layout({
                        name: 'cose',
                        animate: true,
                        fit: true,
                        padding: 30,
                        nodeRepulsion: 8000,
                        idealEdgeLength: 50,
                    }).run();
                }
            } else {
                // Show file view.
                cyContainer.style.display = 'none';
                fileViewContainer.style.display = 'block';
                if (typeof window.fetchDirectoryContents === 'function') {
                    window.fetchDirectoryContents();
                } else {
                    console.error("window.fetchDirectoryContents is not defined.");
                }
            }
        },
    },
    {
        ToolbarCategory: 'Settings',
        heading: 'Toggle Page Preview Mode',
        type: 'toggle',
        callback: (state) => {
            console.log(state ? 'Preview Mode Enabled' : 'Preview Mode Disabled');
        },
    },
    // View category options (always visible)
    {
        ToolbarCategory: 'View',
        heading: 'Viewing',
        content: ``,
        script: "SwitchToViewing.js",
    },
    {
        ToolbarCategory: 'View',
        heading: 'WYSIWYG Editing',
        content: ``,
        script: "SwitchToWYSIWYGediting.js",
    },
    {
        ToolbarCategory: 'View',
        heading: '3D World Viewing',
        content: ``,
        script: "SwitchTo3DWorldViewing.js",
    },
    {
        ToolbarCategory: 'View',
        heading: '3D World Editing',
        content: ``,
        script: "SwitchTo3DWorldEditing.js",
    },
    {
        ToolbarCategory: 'View',
        heading: 'Code Editing',
        content: ``,
        script: "SwitchToCodeEditing.js",
    },
    // The search bar entry is now marked for direct rendering.
    {
        direct: true,
        ToolbarCategory: 'Search',
        heading: 'Search',
        content: `
            <div style="display: flex; align-items: center; gap: 8px;">
                <input type="text" id="searchBar" placeholder="Search nodes">
                <button id="searchButton">Search</button>
            </div>
            <div id="searchResults" style="display: none; position: absolute; background: white; border: 1px solid #ccc; padding: 5px;"></div>
        `,
        script: "search.js",
    },
    // Items under "User"
    {
        ToolbarCategory: 'User',
        heading: 'Logout',
        content: `<h1>Log out user?</h1><h2><a href="login.html">Logout</a></h2>`,
        script: "SendToLoginPage.js",
    },
    // Items that appear only in WYSIWYG Editing mode:
    {
        ToolbarCategory: 'File',
        heading: 'Save File',
        content: ``,
        callback: () => {
            const filePath = window.currentActiveFilePath;
            if (filePath && typeof window.saveWYSIWYGFile === 'function') {
                window.saveWYSIWYGFile(filePath);
            } else {
                console.error("Cannot save: filePath or saveWYSIWYGFile is missing.");
            }
        },
        modes: ["WYSIWYG Editing"]
    },
    {
        ToolbarCategory: 'Insert',
        heading: 'Insert Text',
        callback: () => {
            // This callback will be overridden by our toolbar code for "Insert"
            // which now shows the sub-toolbar.
            // (Alternatively, you could call showInsertSubToolbar() here.)
        },
        modes: ["WYSIWYG Editing"]
    },
    {
        ToolbarCategory: 'Insert',
        heading: 'h1',
        insertGroup: 'text',
        callback: () => { document.execCommand('insertHTML', false, '<h1>Heading 1</h1>'); },
        modes: ["WYSIWYG Editing"]
    },    
    {
        ToolbarCategory: 'Insert',
        heading: 'h2',
        insertGroup: 'text',
        callback: () => { console.log('Insert h2'); const h2Element = `<h2>Heading 2</h2>`;
        document.execCommand('insertHTML', false, h2Element); },
        modes: ["WYSIWYG Editing"]
    },
    {
        ToolbarCategory: 'Insert',
        heading: 'h3',
        insertGroup: 'text',
        callback: () => { console.log('Insert h1'); const h3Element = `<h3>Heading 3</h3>`;
        document.execCommand('insertHTML', false, h3Element);},
        modes: ["WYSIWYG Editing"]
    },
    {
        ToolbarCategory: 'Insert',
        heading: 'h4',
        insertGroup: 'text',
        callback: () => { console.log('Insert h2'); const h4Element = `<h4>Heading 4</h4>`;
        document.execCommand('insertHTML', false, h4Element); },
        modes: ["WYSIWYG Editing"]
    },
    {
        ToolbarCategory: 'Insert',
        heading: 'h5',
        insertGroup: 'text',
        callback: () => { console.log('Insert h5'); const h5Element = `<h5>Heading 5</h5>`;
        document.execCommand('insertHTML', false, h5Element);},
        modes: ["WYSIWYG Editing"]
    },
    {
        ToolbarCategory: 'Insert',
        heading: 'h6',
        insertGroup: 'text',
        callback: () => { console.log('Insert h6'); const h6Element = `<h6>Heading 2</h6>`;
        document.execCommand('insertHTML', false, h6Element); },
        modes: ["WYSIWYG Editing"]
    },
    {
        ToolbarCategory: 'Insert',
        heading: 'table',
        insertGroup: 'table',
        callback: () => { console.log('Insert table');         const table = document.createElement('table');
        table.style.borderCollapse = "collapse";
        for (let i = 0; i < 3; i++) { // Example: 3 rows
            const row = table.insertRow();
            for (let j = 0; j < 3; j++) { // Example: 3 columns
                const cell = row.insertCell();
                cell.style.border = "1px solid black";
                cell.textContent = "Cell";
            }
        }
        document.getElementById('editor').appendChild(table);
    },
        modes: ["WYSIWYG Editing"]
    },
    {
        ToolbarCategory: 'Insert',
        heading: 'OrderedList',
        insertGroup: 'text',
        callback: () => { console.log('Insert ordered list');             
        const ol = `<ol><li>Ordered Thing<li></ol>`;
        document.execCommand('insertHTML', false, ol);
        },
        modes: ["WYSIWYG Editing"]
    },
    {
        ToolbarCategory: 'Insert',
        heading: 'UnorderedList',
        insertGroup: 'text',
        callback: () => { console.log('Insert table');             
        const ul = `<ul><li>Unordered Thing<li></ul>`;
        document.execCommand('insertHTML', false, ul);
        },
        modes: ["WYSIWYG Editing"]
    },
    {
        ToolbarCategory: 'Insert',
        heading: 'Italics',
        insertGroup: 'text',
        callback: () => { console.log('Insert Italics');             
        const ItalicizedElement = `<i>italics</i>`;
        document.execCommand('insertHTML', false, ItalicizedElement);
        },
        modes: ["WYSIWYG Editing"]
    },

    {
        ToolbarCategory: 'Insert',
        heading: 'Bold',
        insertGroup: 'text',
        callback: () => { console.log('Insert Italics');             
        const BoldElement = `<b>bold text</b>`;
        document.execCommand('insertHTML', false, BoldElement);
        },
        modes: ["WYSIWYG Editing"]
    },
    {
        ToolbarCategory: 'Insert',
        heading: 'Underline',
        insertGroup: 'text',
        callback: () => { console.log('Insert Italics');             
        const UnderlinedElement = `<ins>underlined</ins>`;
        document.execCommand('insertHTML', false, UnderlinedElement);
        },
        modes: ["WYSIWYG Editing"]
    },
    {
        ToolbarCategory: 'Insert',
        heading: 'Strikethrough',
        insertGroup: 'text',
        callback: () => { console.log('Insert Strikethrough');             
        const StrikethroughElement = `<del>strikethrough</del>`;
        document.execCommand('insertHTML', false, StrikethroughElement);
        },
        modes: ["WYSIWYG Editing"]
    },
    {
        ToolbarCategory: 'Insert',
        heading: 'Insert Sensitive',
        insertGroup: 'text',
        callback: () => { console.log('Insert Strikethrough');             
        const text = document.getSelection().toString() || prompt("Enter the sensitive text:");
        
        var SensitiveElement = `<style>@media print {
    .sensitive {
        display: none;
    }</style>
    <div class="sensitive" style="padding: 20px; background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; margin: 10px 0;" onload="this.innerHTML='Content hidden for privacy';">${text}</div>`;
    document.execCommand('insertHTML', false, SensitiveElement);

        },
        modes: ["WYSIWYG Editing"]
    },
  
    {
        ToolbarCategory: 'Insert',
        heading: 'Insert Blank SVG Drawing',
        insertGroup: 'image',
        callback: () => {
            console.log("Inserting Blank SVG Drawing");
    
            // Create a blank SVG element
            const svgElement = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg" style="border: 1px solid black;">
                <rect width="100%" height="100%" fill="white"/>
            </svg>`;
    
            // Insert the SVG into the content
            document.execCommand('insertHTML', false, svgElement);
        },
        modes: ["WYSIWYG Editing"]
    },
    {
        ToolbarCategory: 'Insert',
        heading: 'Insert Video',
        insertGroup: 'video',
        callback: () => {    
            const videoFile = prompt("Enter the name of the video file (with extension):");
        if (videoFile) {
            const videoElement = `
                <video controls width="600">
                    <source src="/${videoFile}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>`;
            document.execCommand('insertHTML', false, videoElement);
        } else {
            alert("Video file name is required.");
        }
        },
        modes: ["WYSIWYG Editing"]
    },
    {
        ToolbarCategory: 'Insert',
        heading: 'Serial Monitor',
        insertGroup: 'text',
        callback: () => {
            console.log('Insert Serial Monitor');  
    
            // Define the HTML structure
            const SerialMonitorElement = `
                <div id="serial-monitor-container" 
                     style="background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2); max-width: 500px; margin: auto; margin-top: 20px;">
                    
                    <form id="serial-config-form">
                        <label for="serial-port" style="font-weight: bold;">Port:</label>
                        <input type="text" id="serial-port" placeholder="/dev/ttyUSB0" 
                               style="margin-top: 5px; padding: 8px; font-size: 16px; width: 100%;">
    
                        <label for="baud-rate" style="font-weight: bold;">Baud Rate:</label>
                        <input type="number" id="baud-rate" placeholder="9600" 
                               style="margin-top: 5px; padding: 8px; font-size: 16px; width: 100%;">
    
                        <button type="submit" 
                                style="margin-top: 5px; padding: 8px; font-size: 16px; width: 100%; background: #007bff; color: white; border: none; cursor: pointer;"
                                onmouseover="this.style.background='#0056b3'" 
                                onmouseout="this.style.background='#007bff'">
                            Update
                        </button>
                    </form>
    
                    <pre id="serial-output" 
                         style="background: black; color: #0f0; padding: 10px; height: 200px; overflow-y: auto; white-space: pre-wrap; margin-top: 10px;">
    <!-- Serial content will be displayed here -->
                    </pre>
                </div>
            `;
    
            // Insert the element into the page
            document.execCommand('insertHTML', false, SerialMonitorElement);
    
            // Attach event listener AFTER the HTML is inserted
            setTimeout(() => {
                const form = document.getElementById('serial-config-form');
                if (form) {
                    form.addEventListener('submit', function(e) {
                        e.preventDefault();
                        const port = document.getElementById('serial-port').value;
                        const baudRate = document.getElementById('baud-rate').value;
                        const output = document.getElementById('serial-output');
    
                        output.textContent += `\nPort set to: ${port}, Baud Rate set to: ${baudRate}`;
                        output.scrollTop = output.scrollHeight;
                    });
                } else {
                    console.error('Serial Monitor form not found.');
                }
            }, 100); // Small delay to ensure it's in the DOM
        },
        modes: ["WYSIWYG Editing"]
    },
    
   

    {
        ToolbarCategory: 'Insert',
        heading: 'Insert CSV as table',
        insertGroup: 'table',
        callback: () => {    
            const CSVfile = prompt("Enter the relative path of the CSV file (with extension):");
            if (CSVfile) {
                const CSVtableElement = `
                    <table id="${CSVfile}">
                    <thead></thead>
                    <tbody></tbody>
                    </table>
                
                    <script>
                    (function loadCsv() {
                        fetch('${CSVfile}')
                            .then(response => response.text())
                            .then(data => {
                                // Split the CSV text into rows and cells
                                const rows = data.split("\\n").map(row => row.split(","));
    
                                const table = document.getElementById("${CSVfile}");
                                const thead = table.querySelector("thead");
                                const tbody = table.querySelector("tbody");
    
                                thead.innerHTML = "";
                                tbody.innerHTML = "";
    
                                // Check if there is at least one row
                                if (rows.length > 0) {
                                    // Create header row from the first row of the CSV
                                    const headerRow = document.createElement("tr");
                                    rows[0].forEach(headerText => {
                                        const th = document.createElement("th");
                                        th.textContent = headerText.trim();
                                        headerRow.appendChild(th);
                                    });
                                    thead.appendChild(headerRow);
                                }
    
                                // Create table rows for the rest of the CSV data
                                rows.slice(1).forEach(row => {
                                    if (row.length === 1 && row[0].trim() === "") return;
                                    const tr = document.createElement("tr");
                                    row.forEach(cellText => {
                                        const td = document.createElement("td");
                                        td.textContent = cellText.trim();
                                        tr.appendChild(td);
                                    });
                                    tbody.appendChild(tr);
                                });
                            })
                            .catch(error => {
                                console.error("Error fetching or parsing the CSV file:", error);
                                document.getElementById("${CSVfile}").innerHTML = "Error loading CSV file.";
                            });
    
                        // Refresh CSV data every 5 seconds
                        setTimeout(loadCsv, 5000);
                    })();
                    </script>
                `;
    
                document.execCommand('insertHTML', false, CSVtableElement);
            } else {
                alert("CSV filename (relative path) is required.");
            }
        },
        modes: ["WYSIWYG Editing"]
    },
    
    {
        ToolbarCategory: 'Insert',
        heading: 'Insert QRcode',
        insertGroup: 'image',
        callback: () => {    
            function generateQRCode() {
                const url = document.getElementById("urlInput").value;
                if (url) {
                    // Generate QR code
                    QRCode.toDataURL(url, { errorCorrectionLevel: 'H' }, function (err, url) {
                        if (err) {
                            alert("Failed to generate QR code.");
                            return;
                        }
        
                        // Display QR code
                        const qrCodeDiv = document.getElementById("qrCode");
                        qrCodeDiv.innerHTML = `<img src="${url}" alt="QR Code" />`;
        
                        // Enable the copy button
                        const copyButton = document.getElementById("copyButton");
                        copyButton.disabled = false;
                        copyButton.dataset.qrUrl = url;
                    });
                } else {
                    alert("Please enter a URL.");
                }
            }
        
            function copyQRCode() {
                const copyButton = document.getElementById("copyButton");
                const qrUrl = copyButton.dataset.qrUrl;
        
                // Create a temporary input to copy the URL
                const tempInput = document.createElement("input");
                tempInput.value = qrUrl;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand("copy");
                document.body.removeChild(tempInput);
        
                // Alert the user
                alert("QR code URL copied to clipboard!");
            }
        
            generateQRCode();
            copyQRCode();
            document.execCommand('insertHTML', false, addressElement);
        },
        modes: ["WYSIWYG Editing"]
    },

    
    
    



    {
        ToolbarCategory: 'Edit',
        heading: 'Edit RASTER',
        callback: () => {
          // Show the sub-toolbar for RASTER image editing
          showEditRasterSubToolbar();
        },
        // Optionally, restrict this to modes where it’s appropriate (e.g., WYSIWYG Editing)
        modes: ["WYSIWYG Editing"]
      }
      
    

    



      
    
              


    
];

