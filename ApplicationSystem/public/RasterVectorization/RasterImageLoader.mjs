// Nodevision/ApplicationSystem/public/RasterVectorization/RasterImageLoader.mjs
// This module loads raster viewer images into ImageData for Nodevision vectorization. It keeps browser image decoding and canvas extraction separate from tracing so non-PNG viewers can reuse the same loading path later.

export function notebookAssetUrl(pathValue = "", serverBase = "/Notebook") {
  const clean = String(pathValue || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/^Notebook\//i, "");
  const base = String(serverBase || "/Notebook").replace(/\/+$/, "") || "/Notebook";
  return base + "/" + clean.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

export function imageElementToImageData(image) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) throw new Error("The raster image has no decoded dimensions.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

export function loadImageData(pathValue, serverBase = "/Notebook") {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try { resolve(imageElementToImageData(image)); }
      catch (error) { reject(error); }
    };
    image.onerror = () => reject(new Error("Could not load raster image for vectorization."));
    image.src = notebookAssetUrl(pathValue, serverBase) + "?t=" + Date.now();
  });
}
