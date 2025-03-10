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
    
   
    
    

    
    
              


    
];

