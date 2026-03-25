// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaVideo.mjs
// Insert → Media: Video renderer (delegates to shared binary A/V renderer).

import { renderBinaryAv } from "./insertMediaBinaryAv.mjs";

function mimeFromExt(ext) {
  const e = String(ext || "").toLowerCase();
  const map = { mp4: "video/mp4", webm: "video/webm", ogv: "video/ogg", mov: "video/quicktime" };
  return map[e] || "video/mp4";
}

export function renderVideo(root, exts = []) {
  renderBinaryAv(root, {
    kind: "Video",
    tagName: "video",
    accept: "video/*",
    defaultDirName: "videos",
    preferredExt: "mp4",
    mimeFromExt,
    elementStyle: "max-width:100%;",
    exts,
  });
}

