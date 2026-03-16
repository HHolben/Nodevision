// Nodevision/ApplicationSystem/server/dynamicRoutes.mjs
// This file loads API routes from the ApplicationSystem routes manifest so that server features can be enabled by configuration without hardcoding imports.

import path from "node:path";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { pathToFileURL } from "node:url";

export async function loadRoutes(app, ctx) {
  try {
    const data = await fsPromises.readFile(ctx.routesJsonPath, "utf8");
    const { routes } = JSON.parse(data);

    for (const { name, path: routePath } of routes) {
      const absoluteRoutePath = path.resolve(ctx.applicationSystemRoot, routePath);
      console.log(`Attempting to load route: ${name} from ${routePath}`);

      if (!fs.existsSync(absoluteRoutePath)) {
        console.error(`❌ Route file not found: ${absoluteRoutePath}`);
        continue;
      }

      try {
        const mod = await import(pathToFileURL(absoluteRoutePath).href);
        const factory = mod.default ?? mod;
        let route;

        if (typeof factory === "function") {
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
        app.use("/api", route);
        console.log(`✅ Loaded route: ${name} from ${absoluteRoutePath}`);
      } catch (err) {
        console.error(`❌ Error importing route ${name} from ${routePath}:`, err);
      }
    }
  } catch (error) {
    console.error("Error loading routes:", error?.message || error);
  }
}

