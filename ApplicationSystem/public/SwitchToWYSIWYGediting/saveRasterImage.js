async function saveRasterImage(canvas, targetPath) {
  console.log("==== PNG SAVE DIAGNOSTICS ====");

  if (!canvas) {
    console.error("❌ No canvas passed in!");
    return;
  }

  if (!targetPath) {
    console.error("❌ No targetPath passed in!");
    return;
  }

  console.log("Canvas:", canvas);
  console.log("Saving to path:", targetPath);

  // Step 1 — Export PNG
  const dataURL = canvas.toDataURL("image/png");
  console.log("DataURL length:", dataURL.length);
  console.log("DataURL prefix:", dataURL.slice(0, 50));

  // Step 2 — Remove prefix
  const base64Data = dataURL.replace(/^data:image\/png;base64,/, "");
  console.log("Base64 length:", base64Data.length);

  // Step 3 — Validate base64
  console.log("Base64 first 50 chars:", base64Data.slice(0, 50));
  console.log("Base64 last 50 chars:", base64Data.slice(-50));

  // Step 4 — Send to server
  const payload = {
    path: targetPath,
    encoding: "base64",
    mimeType: "image/png",
    content: base64Data
  };

  console.log("Payload keys:", Object.keys(payload));
  console.log("Payload content length:", payload.content.length);

  const res = await fetch("/api/files/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  console.log("Server status:", res.status);

  let responseText = await res.text();
  console.log("Raw server response:", responseText);

  try {
    const json = JSON.parse(responseText);
    console.log("Parsed server response:", json);
  } catch {
    console.error("❌ Server did not return JSON.");
  }
}
