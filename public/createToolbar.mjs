// public/createToolbar.mjs
// This file populates the Nodevision toolbar from JSON files in /ToolbarJSONfiles
export async function createToolbar(toolbarSelector = "#global-toolbar") {
  const toolbar = document.querySelector(toolbarSelector);
  if (!toolbar) {
    console.error("Toolbar container not found!");
    return;
  }

  toolbar.innerHTML = ""; // clear previous content

  // Fetch the JSON file
  let items = [];
  try {
    const res = await fetch("/ToolbarJSONfiles/defaultToolbar.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    if (Array.isArray(json)) {
      items = json;
    } else {
      console.warn("defaultToolbar.json is not an array:", json);
    }
  } catch (err) {
    console.error("Failed to load toolbar JSON:", err);
    return;
  }

  // Create buttons from JSON
  for (const item of items) {
    const btn = document.createElement("button");
    btn.textContent = item.heading || "No Heading";
    btn.style.margin = "2px";
    btn.style.padding = "4px 8px";
    btn.style.border = "1px solid #333";
    btn.style.backgroundColor = "#eee";

    // Optional: add click behavior
    btn.addEventListener("click", () => {
      console.log(`Clicked ${item.heading}`);
      alert(`Clicked ${item.heading}`);
    });

    toolbar.appendChild(btn);
  }

  console.log("Toolbar buttons appended from JSON:", toolbar.children);
}
