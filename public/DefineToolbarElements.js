// DefineToolbarElements.js

export const boxes = [
    {
        heading: "Resizable and Draggable Box",
        content: "This box can be resized and dragged.",
        script: "exampleScript.js",
        ToolbarCategory: "File"
    },
    {
        heading: "Another Box",
        content: "This is another example box.",
        script: "anotherScript.js",
        ToolbarCategory: "Edit"
    },
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
            <iframe src="CodeEditor.html"></iframe>
        `,
        script: "NewNotebookPageInitializer.js",
        ToolbarCategory: "Edit"
    }
];

// Additional constants or helper functions can be added here

