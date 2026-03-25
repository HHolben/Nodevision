// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaSound.mjs
// Insert → Media: Sound renderer (delegates to shared binary A/V renderer).

import { renderBinaryAv } from "./insertMediaBinaryAv.mjs";

function mimeFromExt(ext) {
  const e = String(ext || "").toLowerCase();
  const map = { mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", flac: "audio/flac", m4a: "audio/mp4" };
  return map[e] || "audio/mpeg";
}

export function renderSound(root, exts = []) {
  renderBinaryAv(root, {
    kind: "Sound",
    tagName: "audio",
    accept: "audio/*",
    defaultDirName: "audio",
    preferredExt: "mp3",
    mimeFromExt,
    exts,
  });
}

