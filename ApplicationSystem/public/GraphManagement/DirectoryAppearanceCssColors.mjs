// Nodevision/ApplicationSystem/public/GraphManagement/DirectoryAppearanceCssColors.mjs
// This module converts between Nodevision's directory appearance model and the CSS color values stored in directory.css custom properties.

import { normalizeAlpha, normalizeHexColor, sanitizeDirectoryAppearance } from "./DirectoryAppearanceMetadata.mjs";

export const DIRECTORY_APPEARANCE_STYLESHEET = "directory.css";
export const DIRECTORY_APPEARANCE_FILL_PROPERTY = "--nodevision-directory-fill-color";
export const DIRECTORY_APPEARANCE_OUTLINE_PROPERTY = "--nodevision-directory-outline-color";
export const DIRECTORY_APPEARANCE_PROPERTIES = [DIRECTORY_APPEARANCE_FILL_PROPERTY, DIRECTORY_APPEARANCE_OUTLINE_PROPERTY];
export const DIRECTORY_APPEARANCE_COMMENT = "/* Nodevision directory appearance */";
export const DIRECTORY_APPEARANCE_FALLBACKS = { fillColor: "#E8D7B5", outlineColor: "#7A5C32" };

function colorComponent(raw) {
  const text = String(raw || "").trim();
  const percent = text.endsWith("%");
  const number = Number.parseFloat(percent ? text.slice(0, -1) : text);
  if (!Number.isFinite(number)) return null;
  const value = percent ? Math.round((number * 255) / 100) : Math.round(number);
  return value >= 0 && value <= 255 ? value : null;
}

function hexFromRgb(red, green, blue) {
  return "#" + [red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function normalizeDirectoryCssColorValue(value) {
  const raw = String(value || "").trim();
  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    const body = hex[1];
    const colorBody = body.length <= 4 ? body.slice(0, 3).split("").map((ch) => ch + ch).join("") : body.slice(0, 6);
    const color = normalizeHexColor("#" + colorBody);
    const alphaHex = body.length === 4 ? body[3] + body[3] : body.length === 8 ? body.slice(6, 8) : "";
    const alpha = alphaHex ? Math.round((Number.parseInt(alphaHex, 16) / 255) * 100) / 100 : null;
    return color ? { color, alpha: alpha !== null && alpha < 1 ? alpha : null } : null;
  }

  const rgb = raw.match(/^rgba?\(([\s\S]+)\)$/i);
  if (!rgb) return null;
  let parts = [];
  let alphaPart = "";
  if (rgb[1].includes(",")) {
    parts = rgb[1].split(",").map((part) => part.trim());
    alphaPart = parts[3] || "";
  } else {
    const slashParts = rgb[1].split("/");
    parts = slashParts[0].trim().split(/\s+/);
    alphaPart = slashParts[1] || "";
  }
  const channels = parts.slice(0, 3).map(colorComponent);
  if (channels.length !== 3 || channels.some((part) => part === null)) return null;
  const alpha = alphaPart ? normalizeAlpha(alphaPart) : null;
  return { color: hexFromRgb(channels[0], channels[1], channels[2]), alpha: alpha !== null && alpha < 1 ? alpha : null };
}

export function directoryCssValueFromAppearance(appearance, colorKey, alphaKey) {
  const clean = sanitizeDirectoryAppearance(appearance);
  const color = clean[colorKey] || (Object.hasOwn(clean, alphaKey) ? DIRECTORY_APPEARANCE_FALLBACKS[colorKey] : "");
  if (!color) return "";
  const alpha = normalizeAlpha(clean[alphaKey]);
  if (alpha === null || alpha >= 1) return color;
  const hex = normalizeHexColor(color);
  const num = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

export function directoryAppearanceFromCssDeclarations(declarations = []) {
  const appearance = {};
  for (const declaration of declarations) {
    const parsed = normalizeDirectoryCssColorValue(declaration.value);
    if (!parsed) continue;
    if (declaration.prop === DIRECTORY_APPEARANCE_FILL_PROPERTY) {
      appearance.fillColor = parsed.color;
      if (parsed.alpha !== null) appearance.fillAlpha = parsed.alpha;
    } else if (declaration.prop === DIRECTORY_APPEARANCE_OUTLINE_PROPERTY) {
      appearance.outlineColor = parsed.color;
      if (parsed.alpha !== null) appearance.outlineAlpha = parsed.alpha;
    }
  }
  return sanitizeDirectoryAppearance(appearance);
}
