// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/HTMLDraftFocusGoalPanel.mjs
// This overlay panel collects the goal settings used by the built-in HTML Draft Focus Session before the locked drafting surface starts.

const STYLE_ID = "nv-html-draft-focus-goal-styles";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.nv-html-focus-goal {
  display: grid;
  gap: 14px;
  padding: 18px;
  color: #111827;
  background: #f8fafc;
  font: 14px system-ui, sans-serif;
}
.nv-html-focus-goal h2 {
  margin: 0;
  font-size: 18px;
}
.nv-html-focus-goal label {
  display: grid;
  gap: 5px;
  font-weight: 650;
}
.nv-html-focus-goal input,
.nv-html-focus-goal select {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid #94a3b8;
  border-radius: 6px;
  padding: 8px 9px;
  font: inherit;
}
.nv-html-focus-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.nv-html-focus-actions button {
  border: 1px solid #64748b;
  border-radius: 6px;
  padding: 8px 12px;
  background: #fff;
  color: #111827;
  cursor: pointer;
  font: inherit;
}
.nv-html-focus-actions .primary {
  border-color: #006fbe;
  background: #0078d7;
  color: #fff;
}
`;
  document.head.appendChild(style);
}

export function createPanel(contentElem, panelVars = {}, panelRoot = null) {
  ensureStyles();
  const title = panelRoot?.querySelector(".panel-title");
  if (title) title.textContent = "HTML Draft Focus";
  contentElem.innerHTML = "";

  const form = document.createElement("form");
  form.className = "nv-html-focus-goal";
  form.innerHTML = `
    <h2>Choose a drafting goal</h2>
    <label>Goal type
      <select name="mode">
        <option value="words">Write a word count</option>
        <option value="wordsTimed">Write a word count in a time limit</option>
        <option value="timed">Draft for a time limit</option>
      </select>
    </label>
    <label>Target words
      <input name="targetWords" type="number" min="1" max="5000" step="1" value="250">
    </label>
    <label>Time limit in minutes
      <input name="timeMinutes" type="number" min="1" max="240" step="1" value="15">
    </label>
    <div class="nv-html-focus-actions">
      <button type="button" data-cancel>Cancel</button>
      <button type="submit" class="primary">Start</button>
    </div>
  `;

  form.querySelector("[data-cancel]")?.addEventListener("click", () => panelVars.onCancel?.());
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    panelVars.onDone?.({
      mode: String(data.get("mode") || "words"),
      targetWords: Math.max(1, Math.min(5000, Number(data.get("targetWords")) || 250)),
      timeMinutes: Math.max(1, Math.min(240, Number(data.get("timeMinutes")) || 15)),
    });
  });
  contentElem.appendChild(form);
}

