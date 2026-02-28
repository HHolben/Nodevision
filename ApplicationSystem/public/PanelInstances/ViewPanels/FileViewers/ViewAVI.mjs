// AVI Video Viewer
// Uses native HTML5 <video> support where available

export const wantsIframe = false;

export async function renderFile(filePath, panel) {
  panel.innerHTML = '';

  if (!filePath || !filePath.toLowerCase().endsWith('.avi')) {
    panel.innerHTML = `<em>No AVI file selected.</em>`;
    return;
  }

  const video = document.createElement('video');
  video.controls = true;
  video.autoplay = false;
  video.preload = 'metadata';
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.background = '#000';

  const source = document.createElement('source');
  source.src = filePath;
  source.type = 'video/x-msvideo'; // AVI MIME type

  video.appendChild(source);

  // Fallback message
  video.innerHTML += `
    <p>
      Your browser does not support AVI playback.
      You may need to convert this file to MP4 or WebM.
    </p>
  `;

  panel.appendChild(video);

  // Helpful diagnostic
  video.addEventListener('error', () => {
    console.warn('AVI playback failed:', filePath);
    panel.insertAdjacentHTML(
      'beforeend',
      `<p style="color:#b00;">
        ⚠️ This AVI codec may not be supported by your browser.
      </p>`
    );
  });
}
