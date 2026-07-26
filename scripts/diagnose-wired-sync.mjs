#!/usr/bin/env node
// Safe wired/direct-network sync diagnostics. This script never applies sync,
// imports packages, writes Notebook files, or changes TrustedPeers.json.

import fs from "node:fs/promises";
import path from "node:path";

import {
  compareDiagnosticReports,
  runDiscoveryDiagnostics,
  runEndpointDiagnostics,
  runFullDiagnostics,
  runLocalDiagnostics,
  runPeerDiagnostics,
  summarizeReportForHumans,
} from "../ApplicationSystem/Sync/WiredSyncDiagnostics.mjs";

const USAGE = `
Usage:
  node scripts/diagnose-wired-sync.mjs local [--output report.json] [--interface IFACE]
  node scripts/diagnose-wired-sync.mjs peer --url http://PEER_IP:PORT [--output report.json] [--scope SyncTest]
  node scripts/diagnose-wired-sync.mjs endpoint --url http://PEER_IP:PORT --route /actual/route [--method GET]
  node scripts/diagnose-wired-sync.mjs full --url http://PEER_IP:PORT [--output report.json] [--scope SyncTest]
  node scripts/diagnose-wired-sync.mjs discovery [--duration-ms 7000] [--output report.json]
  node scripts/diagnose-wired-sync.mjs compare report-a.json report-b.json
`.trim();

function parseArgs(argv = process.argv.slice(2)) {
  const args = [...argv];
  const command = args.shift();
  const options = { _: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      options._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = args[i + 1];
    if (next === undefined || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    i += 1;
  }
  return { command, options };
}

async function writeReport(report, outputPath) {
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (outputPath) {
    await fs.writeFile(path.resolve(outputPath), json, "utf8");
    process.stdout.write(`Wrote JSON report to ${outputPath}\n`);
  } else {
    process.stdout.write(json);
  }
  process.stdout.write("\n");
  process.stdout.write(`${summarizeReportForHumans(report)}\n`);
}

async function main() {
  const { command, options } = parseArgs();
  if (!command || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(`${USAGE}\n`);
    return;
  }

  let report;
  if (command === "local") {
    report = await runLocalDiagnostics({
      interfaceName: typeof options.interface === "string" ? options.interface : "",
      timeoutMs: Number(options["timeout-ms"]) || undefined,
    });
  } else if (command === "peer") {
    if (!options.url) throw new Error("--url is required for peer diagnostics");
    report = await runPeerDiagnostics(options.url, {
      scope: options.scope || "SyncTest",
      timeoutMs: Number(options["timeout-ms"]) || undefined,
      tcpTimeoutMs: Number(options["tcp-timeout-ms"]) || undefined,
    });
  } else if (command === "endpoint") {
    if (!options.url) throw new Error("--url is required for endpoint diagnostics");
    if (!options.route) throw new Error("--route is required for endpoint diagnostics");
    report = await runEndpointDiagnostics({
      url: options.url,
      route: options.route,
      method: String(options.method || "GET").toUpperCase(),
    }, {
      timeoutMs: Number(options["timeout-ms"]) || undefined,
      tcpTimeoutMs: Number(options["tcp-timeout-ms"]) || undefined,
    });
  } else if (command === "full") {
    if (!options.url) throw new Error("--url is required for full diagnostics");
    report = await runFullDiagnostics(options.url, {
      scope: options.scope || "SyncTest",
      interfaceName: typeof options.interface === "string" ? options.interface : "",
      timeoutMs: Number(options["timeout-ms"]) || undefined,
      tcpTimeoutMs: Number(options["tcp-timeout-ms"]) || undefined,
    });
  } else if (command === "discovery") {
    report = await runDiscoveryDiagnostics({
      durationMs: Number(options["duration-ms"]) || undefined,
      interfaceName: typeof options.interface === "string" ? options.interface : "",
    });
  } else if (command === "compare") {
    const files = options._;
    if (files.length < 2) throw new Error("compare requires two JSON report paths");
    const comparison = await compareDiagnosticReports(files);
    process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n\n`);
    if (comparison.ok) {
      process.stdout.write("Comparison: no asymmetric wired sync failures detected in these reports.\n");
    } else {
      process.stdout.write(`Comparison found ${comparison.issues.length} issue(s). First: ${comparison.issues[0].code} - ${comparison.issues[0].explanation}\n`);
    }
    process.exitCode = comparison.ok ? 0 : 1;
    return;
  } else {
    throw new Error(`Unknown command: ${command}\n${USAGE}`);
  }

  await writeReport(report, typeof options.output === "string" ? options.output : "");
  process.exitCode = report.ok ? 0 : 1;
}

main().catch((err) => {
  process.stderr.write(`${err?.message || String(err)}\n`);
  process.stderr.write(`${USAGE}\n`);
  process.exitCode = 1;
});
