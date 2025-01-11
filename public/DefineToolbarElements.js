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
        content: `<input type="text" id="DirectoryNameInput" placeholder="Enter folder name">`,
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
            const cyContainer = document.getElementById('cy');
            const fileViewContainer = document.getElementById('file-view');
            if (state) {
                cyContainer.style.display = 'block';
                fileViewContainer.style.display = 'none';
            } else {
                cyContainer.style.display = 'none';
                fileViewContainer.style.display = 'block';
            }
        }, // Custom callback for the toggle behavior
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
        ToolbarCategory: 'User',
        heading: 'Logout',
        content: `<h1>Log out user?</h1><h2><a href="login.html">Logout</a></h2>`,
        script: "SendToLoginPage.js",
    },
];
