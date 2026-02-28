// Nodevision/public/callbackLoader.mjs
// Dynamically imports toolbar callbacks from ToolbarCallbacks/ subfolders

export async function loadCallback(category, key) {
  try {
    const path = `/ToolbarCallbacks/${category}/${key}.mjs`;
    const module = await import(path);
    if (module.default && typeof module.default === "function") {
      return module.default;
    } else {
      console.warn(`Callback file ${path} did not export a default function.`);
      return () => alert(`Callback not implemented properly: ${key}`);
    }
  } catch (err) {
    console.error(`Failed to load callback ${category}/${key}:`, err);
    return () => alert(`Callback not implemented: ${category}/${key}`);
  }
}
