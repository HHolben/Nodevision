// DefineToolbarElements.js

export const boxes = [
    {
        heading: "New Node",
        content: `
            <label for="fileNameInput">File Name:</label>
            <input type="text" id="fileNameInput" placeholder="Enter file name">
        `,
        script: "NewNotebookPageInitializer.js",
        ToolbarCategory: "File"
    },
    {
        heading: "New Region",
        content: `
            <label for="regionNameInput">Region Name:</label>
            <input type="text" id="regionNameInput" placeholder="Enter region name">
        `,
        script: "NewRegionInitializer.js",
        ToolbarCategory: "File"
    },
    {
        heading: "Delete Node or Directory",
        content: `
            <label for="deleteItemInput">Name of node or directory to delete:</label>
            <input type="text" id="deleteItemInput" placeholder="Enter the name">
        `,
        script: "DeleteNodeOrDirectory.js",  // New script for handling the delete
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
    }
];

// Additional constants or helper functions can be added here

