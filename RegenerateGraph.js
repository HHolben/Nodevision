// RegenerateGraph.js
// Purpose: Refresh and rebuild the entire graph structure from current data

const { exec } = require('child_process');
const path = require('path');

// Function to run a script and return a promise
function runScript(scriptName) {
    return new Promise((resolve, reject) => {
        exec(`node ${path.join(__dirname, scriptName)}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing script ${scriptName}:`, stderr);
                reject(error);
            } else {
                console.log(`Script ${scriptName} output:`, stdout);
                resolve(stdout);
            }
        });
    });
}

// Run GenerateNodes.js, GenerateEdges.js, and GenerateRegions.js in sequence
(async () => {
    try {
        await runScript('GenerateNodes.js');
        await runScript('GenerateEdges.js');
        await runScript('GenerateRegions.js');
        console.log('All scripts ran successfully.');

        // Note: No need to serve files here as it should be handled by server.js

    } catch (error) {
        console.error('Failed to run scripts:', error);
    }
})();
