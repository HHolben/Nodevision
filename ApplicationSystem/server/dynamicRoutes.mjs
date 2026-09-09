// Nodevision/ApplicationSystem/server/dynamicRoutes.mjs
// This file loads API routes from the ApplicationSystem routes manifest so that server features can be enabled by configuration without hardcoding imports.

import path from "node:path";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createServerPerformanceOperation } from "./performanceDiagnostics.mjs";

function isExpressRouter(value) {
  return typeof value === "function" && typeof value.handle === "function" && typeof value.use === "function";
}

export async function loadRoutes(app, ctx) {
  const perf = createServerPerformanceOperation("dynamic route loading");
  let loadedCount = 0;
  let failedCount = 0;
  try {
    const data = await fsPromises.readFile(ctx.routesJsonPath, "utf8");
    const { routes } = JSON.parse(data);

    perf.count("routes", Array.isArray(routes) ? routes.length : 0);
    for (const { name, path: routePath, mountPath = "/api" } of routes) {
      const routePerf = createServerPerformanceOperation("dynamic route import", { name, routePath, mountPath });
      const absoluteRoutePath = path.resolve(ctx.applicationSystemRoot, routePath);
      console.log(`Attempting to load route: ${name} from ${routePath} at ${mountPath}`);

      if (!fs.existsSync(absoluteRoutePath)) {
        console.error("❌ Route file not found: " + absoluteRoutePath);
        failedCount += 1;
        routePerf.end({ success: false, error: "missing-file" });
        continue;
      }

      try {
        const mod = await import(pathToFileURL(absoluteRoutePath).href);
        const factory = mod.default ?? mod;
        let route;

        if (isExpressRouter(factory)) {
          route = factory;
        } else if (typeof factory === "function") {
          try {
            route = factory(ctx);
          } catch (err) {
            if (err instanceof TypeError && err.message.includes("argument callback is required")) {
              route = factory;
            } else {
              throw err;
            }
          }
        } else {
          route = factory;
        }

        if (!route) throw new Error("Route factory returned nothing");
        app.use(mountPath, route);
        loadedCount += 1;
        routePerf.end({ success: true });
        console.log("✅ Loaded route: " + name + " from " + absoluteRoutePath + " at " + mountPath);
      } catch (err) {
        failedCount += 1;
        routePerf.end({ success: false, error: err?.message || String(err) });
        console.error("❌ Error importing route " + name + " from " + routePath + ":", err);
      }
    }
  } catch (error) {
    perf.end({ success: false, loadedCount, failedCount, error: error?.message || String(error) });
    console.error("Error loading routes:", error?.message || error);
    return;
  }
  perf.end({ success: true, loadedCount, failedCount });
}

