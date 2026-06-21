// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertQRcode.mjs
// Collect a URL, generate a QR code, then insert only the finalized QR image into the active HTML editor.

const QR_CODE_CDN = "https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js";
let qrCodeLibraryPromise = null;

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"]/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  }[ch]));
}

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadQRCodeLibrary() {
  if (globalThis.QRCode?.toDataURL) return Promise.resolve(globalThis.QRCode);
  if (qrCodeLibraryPromise) return qrCodeLibraryPromise;

  qrCodeLibraryPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${QR_CODE_CDN}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(globalThis.QRCode), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = QR_CODE_CDN;
    script.async = true;
    script.onload = () => {
      if (globalThis.QRCode?.toDataURL) {
        resolve(globalThis.QRCode);
      } else {
        reject(new Error("QRCode library loaded without QRCode.toDataURL"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load QRCode library"));
    document.head.appendChild(script);
  });

  return qrCodeLibraryPromise;
}

function insertHTML(html) {
  const tools = window.HTMLWysiwygTools;
  if (tools && typeof tools.insertHTMLAtCaret === "function") {
    tools.insertHTMLAtCaret(html);
    return true;
  }

  try {
    document.execCommand("insertHTML", false, html);
    return true;
  } catch (err) {
    console.warn("insertQRcode: unable to insert QR image", err);
    return false;
  }
}

async function generateQRCodeDataUrl(url) {
  const QRCode = await loadQRCodeLibrary();
  return new Promise((resolve, reject) => {
    QRCode.toDataURL(url, { errorCorrectionLevel: "H" }, (err, dataUrl) => {
      if (err) reject(err);
      else resolve(dataUrl);
    });
  });
}

function createDialog() {
  const ids = {
    input: makeId("nv-qr-url"),
    preview: makeId("nv-qr-preview"),
    status: makeId("nv-qr-status"),
  };
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:32000;display:flex;align-items:center;justify-content:center;";

  const panel = document.createElement("form");
  panel.style.cssText = "box-sizing:border-box;width:min(420px,92vw);background:#fff;border:1px solid #777;border-radius:6px;padding:14px;font:13px sans-serif;color:#111;box-shadow:0 8px 28px rgba(0,0,0,.22);";
  panel.innerHTML = `
    <div style="font-weight:700;margin-bottom:10px;">Insert QR Code</div>
    <label for="${ids.input}" style="display:block;margin-bottom:6px;">URL or text</label>
    <input id="${ids.input}" type="text" placeholder="https://example.com" style="box-sizing:border-box;width:100%;margin-bottom:10px;" />
    <div id="${ids.preview}" style="min-height:188px;border:1px solid #ddd;background:#fafafa;display:flex;align-items:center;justify-content:center;margin-bottom:10px;color:#666;">Preview</div>
    <div id="${ids.status}" aria-live="polite" style="min-height:18px;margin-bottom:10px;color:#555;"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button type="button" data-action="cancel">Cancel</button>
      <button type="button" data-action="preview">Preview</button>
      <button type="submit" data-action="insert" disabled>Insert QR Code</button>
    </div>
  `;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const input = panel.querySelector(`#${ids.input}`);
  const preview = panel.querySelector(`#${ids.preview}`);
  const status = panel.querySelector(`#${ids.status}`);
  const previewButton = panel.querySelector('[data-action="preview"]');
  const insertButton = panel.querySelector('[data-action="insert"]');
  const cancelButton = panel.querySelector('[data-action="cancel"]');

  return { overlay, panel, input, preview, status, previewButton, insertButton, cancelButton };
}

export default function insertQRcode() {
  const dialog = createDialog();
  let currentUrl = "";
  let currentDataUrl = "";

  const close = () => dialog.overlay.remove();

  const generatePreview = async () => {
    const url = dialog.input.value.trim();
    if (!url) {
      dialog.status.textContent = "Enter a URL or text first.";
      dialog.input.focus();
      return false;
    }

    dialog.previewButton.disabled = true;
    dialog.insertButton.disabled = true;
    dialog.status.textContent = "Generating QR code...";
    try {
      const dataUrl = await generateQRCodeDataUrl(url);
      currentUrl = url;
      currentDataUrl = dataUrl;
      dialog.preview.innerHTML = `<img src="${dataUrl}" alt="QR code preview" style="max-width:180px;height:auto;display:block;" />`;
      dialog.insertButton.disabled = false;
      dialog.status.textContent = "Ready to insert.";
      return true;
    } catch (err) {
      console.error("insertQRcode: failed to generate QR code", err);
      dialog.status.textContent = "Failed to generate QR code.";
      alert("Failed to generate QR code. The QR library may be unavailable.");
      return false;
    } finally {
      dialog.previewButton.disabled = false;
    }
  };

  dialog.cancelButton.addEventListener("click", close);
  dialog.overlay.addEventListener("click", (event) => {
    if (event.target === dialog.overlay) close();
  });
  dialog.previewButton.addEventListener("click", (event) => {
    event.preventDefault();
    generatePreview();
  });
  dialog.input.addEventListener("input", () => {
    if (dialog.input.value.trim() !== currentUrl) {
      currentDataUrl = "";
      dialog.insertButton.disabled = true;
      dialog.status.textContent = "";
    }
  });
  dialog.panel.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentDataUrl || dialog.input.value.trim() !== currentUrl) {
      const ok = await generatePreview();
      if (!ok) return;
    }

    const img = `<img class="nv-qr-code" src="${currentDataUrl}" alt="QR code for ${escapeHTML(currentUrl)}" style="max-width:180px;height:auto;" />`;
    if (!insertHTML(img)) {
      alert("No active HTML editor is available for QR code insertion.");
      return;
    }
    close();
  });

  setTimeout(() => dialog.input.focus(), 0);
}
