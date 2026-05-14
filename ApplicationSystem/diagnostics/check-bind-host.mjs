import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readRuntimeConfigFile,
  resolveRuntimeNetworkConfig,
} from "../core/runtimeNetworkConfig.mjs";

function formatValue(value) {
  if (value == null) return "(unset)";
  const str = String(value).trim();
  return str.length > 0 ? str : "(unset)";
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function printLauncherScripts(label, packagePath) {
  const pkg = readJson(packagePath);
  if (!pkg || typeof pkg !== "object") {
    console.log(`${label} scripts: (missing or unreadable)`);
    return;
  }
  const scripts = pkg.scripts || {};
  console.log(`${label} scripts.start: ${formatValue(scripts.start)}`);
  console.log(`${label} scripts.start-servers: ${formatValue(scripts["start-servers"])}`);
}

const diagnosticsDir = path.dirname(fileURLToPath(import.meta.url));
const applicationSystemRoot = path.resolve(diagnosticsDir, "..");
const repoRoot = path.resolve(applicationSystemRoot, "..");

if (!process.env.NODEVISION_ROOT) {
  process.env.NODEVISION_ROOT = repoRoot;
}

const runtimeRoot = process.env.NODEVISION_ROOT;
const runtimeConfigFile = readRuntimeConfigFile(runtimeRoot);
const resolved = resolveRuntimeNetworkConfig({
  runtimeConfig: {},
  config: runtimeConfigFile.values,
});

const launcherPaths = [
  path.join(repoRoot, "start-servers.js"),
  path.join(repoRoot, "start-servers"),
  path.join(repoRoot, "nodevision-cli.js"),
  path.join(repoRoot, "electron-main.js"),
  path.join(applicationSystemRoot, "server.mjs"),
];

console.log("Nodevision Bind Host Diagnostic");
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log(`Runtime root: ${runtimeRoot}`);
console.log(`process.env.HOST: ${formatValue(process.env.HOST)}`);
console.log(`process.env.PORT: ${formatValue(process.env.PORT)}`);
console.log(`Resolved node host: ${resolved.host}`);
console.log(`Resolved node port: ${resolved.port}`);
console.log(`Resolved php host: ${resolved.phpHost}`);
console.log(`Resolved php port: ${resolved.phpPort}`);
console.log(`Config path: ${runtimeConfigFile.path}`);
console.log(`Config loaded: ${runtimeConfigFile.loaded ? "yes" : "no"}`);
console.log(`config.host: ${formatValue(runtimeConfigFile.values?.host)}`);
console.log(`config.nodePort: ${formatValue(runtimeConfigFile.values?.nodePort)}`);
console.log(`config.port: ${formatValue(runtimeConfigFile.values?.port)}`);
console.log(`config.phpHost: ${formatValue(runtimeConfigFile.values?.phpHost)}`);
console.log(`config.phpPort: ${formatValue(runtimeConfigFile.values?.phpPort)}`);

console.log("Likely launcher files:");
for (const launcherPath of launcherPaths) {
  console.log(` - ${launcherPath} ${fs.existsSync(launcherPath) ? "(exists)" : "(missing)"}`);
}
console.log(`start-servers.js exists: ${fs.existsSync(path.join(repoRoot, "start-servers.js")) ? "yes" : "no"}`);

printLauncherScripts("Root package.json", path.join(repoRoot, "package.json"));
printLauncherScripts(
  "ApplicationSystem/package.json",
  path.join(applicationSystemRoot, "package.json"),
);

console.log("Socket check: run `ss -tulpn | grep 3000` externally after startup.");
