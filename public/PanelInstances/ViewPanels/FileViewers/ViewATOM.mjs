// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewATOM.mjs
// Atom Syndication Format (.atom) viewer

export async function renderFile(panelElem, filePath, panelVars = {}) {
  panelElem.innerHTML = `
    <div class="atom-viewer">
      <div class="atom-header">
        <h2 class="atom-title">Loading…</h2>
        <div class="atom-subtitle"></div>
      </div>
      <div class="atom-entries"></div>
    </div>
  `;

  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to load Atom feed (${response.status})`);
    }

    const xmlText = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "application/xml");

    // Detect XML parse errors
    if (xml.querySelector("parsererror")) {
      throw new Error("Invalid Atom XML");
    }

    const feed = xml.querySelector("feed");
    if (!feed) {
      throw new Error("No <feed> element found");
    }

    // Header
    const title = feed.querySelector("title")?.textContent ?? "Untitled Feed";
    const subtitle = feed.querySelector("subtitle")?.textContent ?? "";

    panelElem.querySelector(".atom-title").textContent = title;
    panelElem.querySelector(".atom-subtitle").textContent = subtitle;

    // Entries
    const entriesElem = panelElem.querySelector(".atom-entries");
    const entries = feed.querySelectorAll("entry");

    if (!entries.length) {
      entriesElem.innerHTML = `<div class="atom-empty">No entries</div>`;
      return;
    }

    entries.forEach(entry => {
      const entryTitle =
        entry.querySelector("title")?.textContent ?? "(untitled)";
      const entrySummary =
        entry.querySelector("summary")?.textContent ??
        entry.querySelector("content")?.textContent ??
        "";
      const entryUpdated =
        entry.querySelector("updated")?.textContent ?? "";
      const entryLink =
        entry.querySelector("link")?.getAttribute("href");

      const entryDiv = document.createElement("div");
      entryDiv.className = "atom-entry";
      entryDiv.innerHTML = `
        <h3 class="atom-entry-title">
          ${entryLink ? `<a href="${entryLink}" target="_blank">${entryTitle}</a>` : entryTitle}
        </h3>
        ${entryUpdated ? `<div class="atom-entry-date">${entryUpdated}</div>` : ""}
        <div class="atom-entry-summary"></div>
      `;

      entryDiv.querySelector(".atom-entry-summary").textContent = entrySummary;
      entriesElem.appendChild(entryDiv);
    });

  } catch (err) {
    console.error("ATOM Viewer error:", err);
    panelElem.innerHTML = `
      <pre style="padding:10px; white-space:pre-wrap;">
Error loading Atom feed.

${err.message}
      </pre>
    `;
  }
}
