import { insertTableAtCaret } from "./tableTools.mjs";

export default function insertTable() {
  const rows = Number.parseInt(prompt("Rows?", "3"), 10);
  const cols = Number.parseInt(prompt("Columns?", "3"), 10);
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) {
    alert("Please enter whole numbers greater than zero.");
    return;
  }
  insertTableAtCaret(rows, cols);
}
