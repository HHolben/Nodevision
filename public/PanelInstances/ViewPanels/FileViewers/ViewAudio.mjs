// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewAudio.mjs
// This file renders audio files with native playback controls for quick listening.

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  viewPanel.innerHTML = "";

  const audio = document.createElement("audio");
  audio.controls = true;
  audio.style.width = "100%";
  audio.src = `${serverBase}/${filename}`;

  const wrap = document.createElement("div");
  wrap.style.padding = "1rem";

  const title = document.createElement("p");
  title.style.marginTop = "0";
  title.innerHTML = `Audio file: <code>${filename}</code>`;

  wrap.appendChild(title);
  wrap.appendChild(audio);
  viewPanel.appendChild(wrap);
}
