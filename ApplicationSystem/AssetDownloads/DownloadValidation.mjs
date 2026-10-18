// Nodevision/ApplicationSystem/AssetDownloads/DownloadValidation.mjs
// Checks standalone asset signatures without executing, extracting, or resolving downloaded content.
export function validateAssetSignature(bytes, extension) {
  const starts = (...values) => values.every((value, index) => bytes[index] === value);
  const text = bytes.subarray(0, 16).toString('ascii');
  const valid = extension === 'png' ? starts(137, 80, 78, 71, 13, 10, 26, 10)
    : extension === 'jpg' ? starts(255, 216, 255)
    : extension === 'exr' ? starts(118, 47, 49, 1)
    : extension === 'hdr' ? /^#\?(RADIANCE|RGBE)\n/.test(text)
    : extension === 'glb' ? text.startsWith('glTF') && bytes.length >= 12 && bytes.readUInt32LE(4) === 2
    : false;
  if (!valid) throw new Error('Downloaded content does not match the selected file type');
}
