// Nodevision/ApplicationSystem/server/dynamicRoutes.mjs
// This file loads API routes from the ApplicationSystem routes manifest so that server features can be enabled by configuration without hardcoding imports.

import path from "node:path";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { pathToFileURL } from "node:url";

function isExpressRouter(value) {
  return typeof value === "function" && typeof value.handle === "function" && typeof value.use === "function";
}

export async function loadRoutes(app, ctx) {
  try {
    const data = await fsPromises.readFile(ctx.routesJsonPath, "utf8");
    const { routes } = JSON.parse(data);

    for (const { name, path: routePath, mountPath = "/api" } of routes) {
      const absoluteRoutePath = path.resolve(ctx.applicationSystemRoot, routePath);
      console.log(`Attempting to load route: ${name} from ${routePath} at ${mountPath}`);

      if (!fs.existsSync(absoluteRoutePath)) {
        console.error(`❌ Route file not found: ${absoluteRoutePath}`);
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
        console.log(`✅ Loaded route: ${name} from ${absoluteRoutePath} at ${mountPath}`);
      } catch (err) {
        console.error(`❌ Error importing route ${name} from ${routePath}:`, err);
      }
    }
  } catch (error) {
    console.error("Error loading routes:", error?.message || error);
  }
}

