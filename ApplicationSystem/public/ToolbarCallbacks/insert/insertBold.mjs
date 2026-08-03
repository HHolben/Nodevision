// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertBold.mjs
// This file defines browser-side insert Bold logic for the Nodevision UI. It renders interface components and handles user interactions.
import { insertMarkdownBoldIfActive } from "./utils/markdownInsertHelpers.mjs";

export default function insertBold() {
  if (insertMarkdownBoldIfActive()) return;

  document.execCommand("insertHTML", false, "<b>bold text</b>");
}
