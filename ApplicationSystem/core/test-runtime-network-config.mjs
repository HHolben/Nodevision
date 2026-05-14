import { resolveRuntimeNetworkConfig } from "./runtimeNetworkConfig.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  const envPriority = resolveRuntimeNetworkConfig({
    env: { HOST: "0.0.0.0", PORT: "4555" },
    runtimeConfig: { host: "127.0.0.1", port: 3000 },
    config: { host: "192.168.0.10", nodePort: 3001 },
  });
  assert(envPriority.host === "0.0.0.0", "Expected env HOST to win over runtime/config");
  assert(envPriority.port === 4555, "Expected env PORT to win over runtime/config");

  const runtimePriority = resolveRuntimeNetworkConfig({
    env: {},
    runtimeConfig: { host: "10.0.0.42", port: 3777 },
    config: { host: "192.168.0.10", nodePort: 3001 },
  });
  assert(runtimePriority.host === "10.0.0.42", "Expected runtimeConfig.host to beat config.host");
  assert(runtimePriority.port === 3777, "Expected runtimeConfig.port to beat config.nodePort");

  const defaultHost = resolveRuntimeNetworkConfig({
    env: {},
    runtimeConfig: {},
    config: {},
  });
  assert(defaultHost.host === "127.0.0.1", "Expected default host to remain localhost/127.0.0.1");
  assert(defaultHost.port === 3000, "Expected default node port to remain 3000");

  const portFromConfig = resolveRuntimeNetworkConfig({
    env: { PORT: "invalid" },
    runtimeConfig: {},
    config: { nodePort: 3123 },
  });
  assert(portFromConfig.port === 3123, "Expected config.nodePort when PORT env is invalid");

  console.log("runtime network config tests passed");
}

run();
