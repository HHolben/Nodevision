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
            <iframe src="CodeEditor.html?activeNode=ActiveNode"></iframe>
        `,
        script: `SendToCodeEditorPage.js`,
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

