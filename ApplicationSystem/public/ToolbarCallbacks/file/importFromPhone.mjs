// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/importFromPhone.mjs
// Opens the Phone Import panel from File -> Import -> From Phone.

export default function importFromPhone() {
  window.dispatchEvent(new CustomEvent("toolbarAction", {
    detail: {
      id: "PhoneImportPanel",
      type: "InfoPanel",
      replaceActive: false,
    },
  }));
}
