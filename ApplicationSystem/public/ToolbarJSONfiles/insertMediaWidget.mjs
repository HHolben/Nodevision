// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaWidget.mjs
// Populates the Insert → Media subtoolbar using ModuleMap families and delegates to family-specific renderers.
import { loadModuleMapFamilies } from "./insertMediaCommon.mjs";
import { renderInsertModel } from "./insertMediaModel.mjs";
import { button, renderGenericLink } from "./insertMediaFamiliesBasic.mjs";
import { renderVideo } from "./insertMediaVideo.mjs";
import { renderSound } from "./insertMediaSound.mjs";
import { renderSpreadsheet } from "./insertMediaSpreadsheet.mjs";
import { renderImage } from "./insertMediaImage.mjs";
import { openInsertMediaPanel } from "./insertMediaPanel.mjs";

export async function initToolbarWidget(hostElement) {
  if (!hostElement || hostElement.dataset.nvInsertMediaBound === "true") return;
  const mount = hostElement.querySelector("#nv-insert-media-widget") || hostElement;
  hostElement.dataset.nvInsertMediaBound = "true";

  mount.innerHTML = "";
  const familyRow = document.createElement("div");
  Object.assign(familyRow.style, { display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" });
  const detail = document.createElement("div");
  Object.assign(detail.style, { padding: "6px 0 0 0" });
  mount.appendChild(familyRow);
  mount.appendChild(detail);

  let moduleMap;
  try {
    moduleMap = await loadModuleMapFamilies();
  } catch (err) {
    console.warn("[insertMediaWidget] ModuleMap.csv load failed:", err);
    detail.textContent = "Failed to load ModuleMap.csv";
    return;
  }

  const currentMode = window.NodevisionState?.currentMode || "";
  const inVirtualWorld = currentMode === "Virtual World Editing" || currentMode === "VR World Editing";
  const virtualWorldModelExts = new Set(["stl", "obj", "scad"]);
  const virtualWorldMediaFamilies = new Set(["Model", "Sound"]);
  const families = inVirtualWorld
    ? (moduleMap.families || []).filter((family) => virtualWorldMediaFamilies.has(family))
    : (moduleMap.families || []);
  const byFamily = moduleMap.extensionsByFamily || new Map();

  const show = (family) => {
    detail.innerHTML = "";
    let exts = Array.from(byFamily.get(family) || []);
    if (inVirtualWorld && family === "Model") exts = exts.filter((ext) => virtualWorldModelExts.has(ext));

    if (family === "Image") {
      if (window.NodevisionState?.currentMode === "SVG Editing") {
        const open = async () => {
          const panel = await openInsertMediaPanel("Insert Image", "Image");
          return renderImage(panel.mount, exts);
        };
        open().then(() => {
          detail.textContent = "Opened Insert Image panel.";
        }).catch((err) => {
          console.warn("[insertMediaWidget] open image panel failed:", err);
          detail.textContent = "Failed to open Insert Image panel.";
        });
        return;
      }
      window.HTMLWysiwygTools?.insertImageAtCaret?.();
      detail.textContent = "Insert Image opened.";
      return;
    }
    const open = async () => {
      const panel = await openInsertMediaPanel(`Insert ${family}`, family);
      if (family === "Video") return renderVideo(panel.mount, exts);
      if (family === "Sound") return renderSound(panel.mount, exts, { target: inVirtualWorld ? "virtualWorld" : "html" });
      if (family === "Spreadsheet") return renderSpreadsheet(panel.mount, exts);
      if (family === "Model") return renderInsertModel(panel.mount, exts, { target: inVirtualWorld ? "virtualWorld" : "html" });
      return renderGenericLink(panel.mount, family, exts);
    };
    open().then(() => {
      detail.textContent = `Opened Insert ${family} panel.`;
    }).catch((err) => {
      console.warn("[insertMediaWidget] open panel failed:", err);
      detail.textContent = `Failed to open Insert ${family} panel.`;
    });
  };

  for (const fam of families) {
    const b = button(`Insert ${fam}`);
    b.addEventListener("click", () => show(fam));
    familyRow.appendChild(b);
  }
}
