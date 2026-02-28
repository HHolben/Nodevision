// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewVideo.mjs
// This file renders video files with native playback controls in the view panel.

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  viewPanel.innerHTML = "";

  const video = document.createElement("video");
  video.controls = true;
  video.src = `${serverBase}/${filename}`;
  video.style.width = "100%";
  video.style.height = "100%";
  video.style.objectFit = "contain";

  video.onerror = () => {
    viewPanel.innerHTML = `<p style="color:#b00020;">Unable to load video: ${filename}</p>`;
  };

  viewPanel.appendChild(video);
}
