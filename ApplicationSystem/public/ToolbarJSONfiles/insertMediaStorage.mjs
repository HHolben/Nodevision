// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaStorage.mjs
// Shares existing storage controls without changing their values, ordering or default.
export function imageStorageMarkup(name = 'nv-image-storage') {
  return `    <fieldset style="border:1px solid #c6c6c6;padding:8px;">
      <legend>Storage Mode</legend>
      <label style="display:block;margin-bottom:6px;"><input type="radio" name="${name}" value="referenced" checked> Referenced (src points to file path)</label>
      <label style="display:block;"><input type="radio" name="${name}" value="inline"> Inline (embed as data URL)</label>
    </fieldset>
`;
}
export function appendImageStorageControls(parent) {
  const host = document.createElement('div'); host.innerHTML = imageStorageMarkup('nv-download-image-storage'); parent.append(host);
  return {
    element: host,
    get value() { return host.querySelector('input:checked')?.value || 'referenced'; },
    set value(value) { for (const input of host.querySelectorAll('input')) input.checked = input.value === (value || 'referenced'); },
  };
}
