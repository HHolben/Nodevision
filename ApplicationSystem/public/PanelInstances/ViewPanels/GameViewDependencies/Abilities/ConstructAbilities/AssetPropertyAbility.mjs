// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/ConstructAbilities/AssetPropertyAbility.mjs
// This file defines user-facing property parsing for Game View constructed objects. It keeps prompt formats and Notebook asset validation close to placement code but outside the movement loop.

import { installMovementApi } from "../movementContext.mjs";

export function installAssetPropertyAbility(ctx) {
  async function ensureImagePlaneTextureApplier() {
    if (ctx.imagePlaneTextureApplier) return ctx.imagePlaneTextureApplier;
    if (!ctx.imagePlaneLoaderPromise) {
      ctx.imagePlaneLoaderPromise = import("../../imagePlaneLoader.mjs")
        .then((mod) => {
          ctx.imagePlaneTextureApplier = mod.applyImagePlaneTexture;
          return ctx.imagePlaneTextureApplier;
        })
        .catch((err) => {
          console.warn("Image plane loader failed to load:", err);
          ctx.imagePlaneLoaderPromise = null;
          ctx.imagePlaneTextureApplier = null;
          return null;
        });
    }
    return ctx.imagePlaneLoaderPromise;
  }

  function normalizeNotebookPath(rawPath) {
    const candidate = String(rawPath || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
    const idx = candidate.indexOf("Notebook/");
    const stripped = idx !== -1 ? candidate.slice(idx + "Notebook/".length) : (candidate.startsWith("./") ? candidate.slice(2) : candidate);
    if (!stripped) return "";
    const parts = stripped.split("/").filter(Boolean);
    if (parts.some((part) => part === "." || part === "..")) return "";
    return parts.join("/");
  }

  function isAllowedImageExtension(path) {
    const ext = String(path || "").split(".").pop()?.toLowerCase() || "";
    return ext === "png" || ext === "svg";
  }

  function parseImagePlaneProperties(inventory, fallbackImagePath = "") {
    const defaultImage = String(fallbackImagePath || inventory?.getSelectedImageFile?.() || "").trim();
    const raw = prompt("Image plane properties:\nimage (png/svg under Notebook); width (m); height (m)\nExample: images/hello.png;2;2", `${defaultImage};2;2`);
    if (raw === null) return null;
    const parts = String(raw).split(";").map((part) => part.trim());
    const normalized = normalizeNotebookPath(parts[0] || "");
    if (!normalized || !isAllowedImageExtension(normalized)) {
      alert("Image path must be a Notebook PNG or SVG (e.g. images/pic.png or images/pic.svg).");
      return null;
    }
    const width = Math.max(0.1, Math.min(50, Number.parseFloat(parts[1] || "2")));
    const height = Math.max(0.1, Math.min(50, Number.parseFloat(parts[2] || "2")));
    return { imageFilePath: normalized, width: Number.isFinite(width) ? width : 2, height: Number.isFinite(height) ? height : 2 };
  }

  function parseIframeProperties() {
    const raw = prompt("iFrame properties:\nsource URL or Notebook path; title; width (m); height (m)\nExample: pages/info.html;Info Page;1.6;0.9", "about:blank;Embedded Page;1.6;0.9");
    if (raw === null) return null;
    const parts = String(raw).split(";").map((part) => part.trim());
    const width = Math.max(0.2, Math.min(30, Number.parseFloat(parts[2] || "1.6")));
    const height = Math.max(0.2, Math.min(30, Number.parseFloat(parts[3] || "0.9")));
    return {
      src: parts[0] || "about:blank",
      title: parts[1] || "Embedded Page",
      width: Number.isFinite(width) ? width : 1.6,
      height: Number.isFinite(height) ? height : 0.9,
      depth: 0.04,
      allow: "fullscreen",
      sandbox: "allow-scripts allow-same-origin allow-forms"
    };
  }

  function parseConsoleProperties(inventory) {
    const defaultObject = inventory?.getSelectedObjectFile?.() || "";
    const raw = prompt("Console properties:\ncollider(true/false); color; 3D object file; linked object tag/name\nExample: true;#33ccaa;props/console.glb;target-a", `true;#33ccaa;${defaultObject};`);
    if (raw === null) return null;
    const parts = String(raw).split(";").map((part) => part.trim());
    return {
      collider: String(parts[0] || "true").toLowerCase() !== "false",
      color: parts[1] || "#33ccaa",
      objectFile: parts[2] || "",
      linkedObject: parts[3] || ""
    };
  }

  return installMovementApi(ctx, {
    ensureImagePlaneTextureApplier,
    normalizeNotebookPath,
    isAllowedImageExtension,
    parseImagePlaneProperties,
    parseIframeProperties,
    parseConsoleProperties
  });
}
