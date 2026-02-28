// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewFont.mjs
// This file loads font files dynamically and displays a readable preview sentence.

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  const family = `preview_${Date.now()}`;
  const url = `${serverBase}/${filename}`;

  viewPanel.innerHTML = "";

  try {
    const face = new FontFace(family, `url(${url})`);
    await face.load();
    document.fonts.add(face);

    const sample = document.createElement("div");
    sample.style.padding = "1rem";
    sample.style.fontFamily = family;
    sample.style.fontSize = "2rem";
    sample.style.lineHeight = "1.4";
    sample.textContent = "Sphinx of black quartz, judge my vow. 1234567890";
    viewPanel.appendChild(sample);
  } catch (error) {
    viewPanel.innerHTML = `<p style="color:#b00020;">Unable to load font: ${error.message}</p>`;
  }
}
