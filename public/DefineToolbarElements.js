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
        ToolbarCategory: "File",
        // No "modes" property means always visible.
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
        // We could either use a script reference or define a callback inline.
        // For example, if you have an exposed function "saveWYSIWYGFile", you might do:
        callback: () => {
            // Retrieve filePath from a global or from AppState.
            const filePath = window.currentActiveFilePath;
            if (filePath && typeof window.saveWYSIWYGFile === 'function') {
                window.saveWYSIWYGFile(filePath);
            } else {
                console.error("Cannot save: filePath or saveWYSIWYGFile is missing.");
            }
        },
        // This item should only appear when in WYSIWYG editing mode.
        modes: ["WYSIWYG Editing"]
    },

];
