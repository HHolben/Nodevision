// DefineToolbarElements.js

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
        ToolbarCategory: "File"
    },
    {
        heading: "New Directory",
        content: `<input type="text" id="DirectoryNameInput" placeholder="Enter folder name">`,
        script: "NewDirectoryInitializer.js",
        ToolbarCategory: "File"
    },
    {
        heading: "Export Graph",
        content: `
        `,
        script: `ExportGraph.js`,
        ToolbarCategory: "File"
    },
    {
        heading: "Edit Code",
        content: `
        `,
        script: `SendToCodeEditorPage.js`,
        ToolbarCategory: "Edit"
    },
    {
        heading: "WYSIWYG Editor",
        content: `
        `,
        script: `SendToWYSIWYGeditorPage.js`,
        ToolbarCategory: "Edit"
    },
    {
        heading: "Settings",
        content: `
            <iframe src="SettingsPage.html"></iframe>
        `,
        script: `SendToCodeSettingsPage.js`,
        ToolbarCategory: "Settings"
    },
    {
        ToolbarCategory: 'Settings',
        heading: 'Toggle View Mode',
        type: 'toggle', // New type to identify toggle items
    },
    {
        ToolbarCategory: 'Settings',
        heading: 'Toggle Page Preview Mode',
        type: 'toggle', // New type to identify toggle items
    },
    {
        ToolbarCategory: 'User',
        heading: 'Logout',
        content: "<h1>Log out user?</hl><h2><a href=login.html>Logout</a></h2>",
        script:"SendToLoginPage.js"
    }

];

// Additional constants or helper functions can be added here