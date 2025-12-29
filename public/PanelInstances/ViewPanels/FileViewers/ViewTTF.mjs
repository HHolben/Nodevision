// Nodevision/public/PanelInstances/ViewPanels/ViewTTF.mjs

export async function renderFile(filename, infoPanel, _unusedIframe, serverBase) {
  const parts = String(filename).split(',');
  const cleanFilename = parts[parts.length - 1].trim(); 
  
  const isFont = /\.(ttf|otf|woff|woff2)$/i.test(cleanFilename);
  if (!isFont) {
    infoPanel.innerHTML = `<div style="padding:20px;">Please select a font file.</div>`;
    return;
  }

  const apiBase = serverBase.replace(/\/Notebook\/?$/, '');
  infoPanel.innerHTML = `<h3>Font Metadata</h3><p>Loading...</p>`;

  try {
    const url = `${apiBase}/font-info?file=${encodeURIComponent(cleanFilename)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const info = await response.json();

    // 1. Load Font Binary for CSS
    const fontUrl = `${serverBase}/${cleanFilename}`;
    const fontName = `Font_${Math.random().toString(36).slice(2, 9)}`;
    const fontFace = new FontFace(fontName, `url(${fontUrl})`);
    const loadedFace = await fontFace.load();
    document.fonts.add(loadedFace);

    // 2. Clear and Setup UI
    infoPanel.innerHTML = "";
    const container = document.createElement("div");
    container.style.padding = "15px";
    infoPanel.appendChild(container);

    // Metadata Table (Mini Version)
    container.innerHTML = `
      <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:0.9em;">
        <tr><td style="font-weight:bold; border:1px solid #ddd; padding:4px;">Name</td><td style="border:1px solid #ddd; padding:4px;">${info["Full Name"]}</td></tr>
        <tr><td style="font-weight:bold; border:1px solid #ddd; padding:4px;">Glyphs</td><td style="border:1px solid #ddd; padding:4px;">${info["Number of Glyphs"]}</td></tr>
      </table>
      
      <h4>Glyph Inspector</h4>
      <div style="margin-bottom:15px; display:flex; gap:10px;">
        <input type="text" id="glyph-search" placeholder="Type a char or Hex (e.g. 0041)" 
               style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px;">
      </div>

      <div id="glyph-preview-box" style="
        height: 150px; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        border: 1px solid #eee; 
        border-radius: 8px; 
        background: #fafafa;
        font-family: ${fontName};
        font-size: 80px;
        position: relative;">
        A
        <span id="glyph-hex" style="
          position: absolute; 
          bottom: 5px; 
          right: 10px; 
          font-size: 12px; 
          font-family: sans-serif; 
          color: #999;">U+0041</span>
      </div>
    `;

    // 3. Logic for Search/Preview
    const searchInput = container.querySelector("#glyph-search");
    const previewBox = container.querySelector("#glyph-preview-box");
    const hexLabel = container.querySelector("#glyph-hex");

    searchInput.addEventListener("input", (e) => {
      let val = e.target.value;
      if (!val) return;

      let char = "";
      let code = "";

      // If user types more than one char, check if it's Hex
      if (val.length > 1 && /^[0-9A-Fa-f]+$/.test(val)) {
        code = val.toUpperCase().padStart(4, '0');
        char = String.fromCodePoint(parseInt(val, 16));
      } else {
        // Just take the first character typed
        char = val.charAt(0);
        code = char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
      }

      previewBox.childNodes[0].textContent = char;
      hexLabel.textContent = `U+${code}`;
    });

  } catch (err) {
    console.error(err);
    infoPanel.innerHTML = `<p style="color:red; padding:20px;">Error: ${err.message}</p>`;
  }
}