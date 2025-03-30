// Import fs module from Deno standard library
import { readTextFile } from "https://deno.land/std@0.220.0/fs/mod.ts";

// Read config file
const configText = await readTextFile("config.json");
const config = JSON.parse(configText);
const phpPort = config.phpPort;
const nodePort = config.nodePort;

// Function to run both servers concurrently
async function startServers() {
  try {
    // PHP server process
    const phpProcess = Deno.run({
      cmd: ["php", "-S", `localhost:${phpPort}`, "-t", "Notebook"],
      stdout: "piped",
      stderr: "piped",
    });
    
    // Node server process
    const nodeProcess = Deno.run({
      cmd: ["node", "server.js"],
      stdout: "piped",
      stderr: "piped",
    });
    
    console.log(`PHP server started on port ${phpPort}`);
    console.log(`Node server started on port ${nodePort}`);
    
    // Handle stdout and stderr for PHP server
    handleOutput(phpProcess, "PHP");
    
    // Handle stdout and stderr for Node server
    handleOutput(nodeProcess, "Node");
    
    // Keep the script running until the processes are terminated
    await Promise.all([
      phpProcess.status(),
      nodeProcess.status()
    ]);
    
    console.log("Servers stopped");
  } catch (error) {
    console.error("Failed to start servers:", error);
  }
}

// Helper function to handle process output
async function handleOutput(process, name) {
  const decoder = new TextDecoder();
  
  // Handle stdout
  (async () => {
    const stdout = process.stdout;
    for await (const chunk of readableStreamFromReader(stdout)) {
      console.log(`[${name}] ${decoder.decode(chunk)}`);
    }
  })();
  
  // Handle stderr
  (async () => {
    const stderr = process.stderr;
    for await (const chunk of readableStreamFromReader(stderr)) {
      console.error(`[${name} ERROR] ${decoder.decode(chunk)}`);
    }
  })();
}

// Helper function to convert a reader to a readable stream
function readableStreamFromReader(reader) {
  return {
    [Symbol.asyncIterator]: async function* () {
      const buf = new Uint8Array(1024);
      while (true) {
        const n = await reader.read(buf);
        if (n === null) break;
        yield buf.subarray(0, n);
      }
    }
  };
}

// Start the servers
startServers();