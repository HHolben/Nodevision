// No need for an import - we'll use Deno's built-in API

// Read config file
const configText = await Deno.readTextFile("config.json");
const config = JSON.parse(configText);
const phpPort = config.phpPort;
const nodePort = config.nodePort;

// Function to run both servers concurrently
async function startServers() {
  try {
    // PHP server command
    const phpCommand = new Deno.Command("php", {
      args: ["-S", `localhost:${phpPort}`, "-t", "Notebook"],
      stdout: "piped",
      stderr: "piped",
    });
    
    // Node server command
    const nodeCommand = new Deno.Command("node", {
      args: ["server.js"],
      stdout: "piped",
      stderr: "piped",
    });
    
    // Start processes
    const phpProcess = phpCommand.spawn();
    const nodeProcess = nodeCommand.spawn();
    
    console.log(`PHP server started on port ${phpPort}`);
    console.log(`Node server started on port ${nodePort}`);
    
    // Handle process output
    handleOutput(phpProcess, "PHP");
    handleOutput(nodeProcess, "Node");
    
    // Wait for both processes to complete
    await Promise.all([
      phpProcess.status,
      nodeProcess.status
    ]);
    
    console.log("Servers stopped");
  } catch (error) {
    console.error("Failed to start servers:", error);
  }
}

// Helper function to handle process output
function handleOutput(process, name) {
  const decoder = new TextDecoder();
  
  // Handle stdout
  (async () => {
    const reader = process.stdout.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        console.log(`[${name}] ${decoder.decode(value)}`);
      }
    } finally {
      reader.releaseLock();
    }
  })();
  
  // Handle stderr
  (async () => {
    const reader = process.stderr.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        console.error(`[${name} ERROR] ${decoder.decode(value)}`);
      }
    } finally {
      reader.releaseLock();
    }
  })();
}

// Start the servers
startServers();