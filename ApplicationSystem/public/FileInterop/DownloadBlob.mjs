// Nodevision/ApplicationSystem/public/FileInterop/DownloadBlob.mjs
// This shared download helper exports in-memory content through a browser object URL and releases the temporary URL after the download has been dispatched.
export function downloadBlob(blob, fileName) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
