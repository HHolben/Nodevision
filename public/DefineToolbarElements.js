export const boxes = [
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
        script: `ExportGraph.js`,
        ToolbarCategory: "File",
    },
    {
        heading: "Edit Code",
        content: ``,
        script: `SendToCodeEditorPage.js`,
        ToolbarCategory: "Edit",
    },
    {
        heading: "WYSIWYG Editor",
        content: ``,
        script: `SendToWYSIWYGeditorPage.js`,
        ToolbarCategory: "Edit",
    },
    {
        heading: "Settings",
        content: `<iframe src="SettingsPage.html"></iframe>`,
        script: `SendToCodeSettingsPage.js`,
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
            // Recalculate layout
            if (window.cy) {
                initializeTheGraphStyles();
                        // Update the graph layout with animation and fitting options.
        cy.layout({
            name: 'cose', // Force-directed layout
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
        }, // Example toggle callback
    },
    {
        ToolbarCategory: 'View',
        heading: 'API Terminal',
        content: ` <iframe src="TerminalInterfaceTest.html" width="100%" height="300"></iframe> `,
        script: "SendToLoginPage.js"
    },
    {
        ToolbarCategory: 'User',
        heading: 'Logout',
        content: `<h1>Log out user?</h1><h2><a href="login.html">Logout</a></h2>`,
        script: "SendToLoginPage.js",
    },
];
