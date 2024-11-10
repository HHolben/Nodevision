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
    }
];

// Additional constants or helper functions can be added here

