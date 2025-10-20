// Nodevision/public/PanelInstances/ViewPanels/ViewQTI.mjs
// Purpose: Display and interact with QTI (Question and Test Interoperability) XML assessment files
// Supports multiple-choice questions with navigation and feedback

export async function ViewQTI(filename, infoPanel, serverBase) {
  console.log("ViewQTI: rendering", filename);

  try {
    const response = await fetch(`${serverBase}/${filename}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const xmlText = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "application/xml");
    const items = Array.from(xml.querySelectorAll("assessmentItem"));

    if (!items.length) {
      infoPanel.innerHTML = "<p>No QTI items found.</p>";
      return;
    }

    let currentIndex = 0;

    // Build container structure
    const container = document.createElement("div");
    container.className = "qti-container";

    const navBar = document.createElement("div");
    navBar.className = "qti-nav";

    const backBtn = document.createElement("button");
    backBtn.textContent = "Back";
    backBtn.disabled = true;

    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Next";
    nextBtn.disabled = items.length <= 1;

    const submitBtn = document.createElement("button");
    submitBtn.textContent = "Submit";

    navBar.append(backBtn, nextBtn, submitBtn);
    container.append(navBar);

    const questionDiv = document.createElement("div");
    questionDiv.className = "qti-question";

    const resultDiv = document.createElement("div");
    resultDiv.className = "qti-result";

    container.append(questionDiv, resultDiv);

    infoPanel.innerHTML = "";
    infoPanel.appendChild(container);

    // Renders one item
    function renderItem(idx) {
      const item = items[idx];
      const prompt = item.querySelector("prompt")?.textContent.trim() || "No prompt";

      // Choices
      const choices = Array.from(item.querySelectorAll("simpleChoice")).map(c => ({
        id: c.getAttribute("identifier"),
        text: c.textContent.trim(),
      }));

      // Correct answer
      const respDecl = item.querySelector("responseDeclaration correctResponse value");
      const correctId = respDecl ? respDecl.textContent.trim() : null;

      // Build question UI
      questionDiv.innerHTML = `<p><strong>Q${idx + 1}.</strong> ${prompt}</p>`;
      const ul = document.createElement("ul");
      ul.className = "qti-choices";

      choices.forEach(ch => {
        const li = document.createElement("li");
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "qti";
        input.value = ch.id;
        label.append(input, " ", ch.text);
        li.appendChild(label);
        ul.appendChild(li);
      });

      questionDiv.appendChild(ul);
      resultDiv.textContent = "";

      backBtn.disabled = idx === 0;
      nextBtn.disabled = idx === items.length - 1;

      submitBtn.onclick = () => {
        const selected = container.querySelector('input[name="qti"]:checked');
        if (!selected) {
          resultDiv.textContent = "Please select an answer.";
          return;
        }
        resultDiv.textContent =
          selected.value === correctId
            ? "✅ Correct!"
            : `❌ Incorrect. Correct answer: ${correctId}`;
      };
    }

    // Navigation handlers
    backBtn.addEventListener("click", () => {
      if (currentIndex > 0) {
        currentIndex--;
        renderItem(currentIndex);
      }
    });

    nextBtn.addEventListener("click", () => {
      if (currentIndex < items.length - 1) {
        currentIndex++;
        renderItem(currentIndex);
      }
    });

    // Initial render
    renderItem(currentIndex);
  } catch (err) {
    console.error("Error loading QTI:", err);
    infoPanel.innerHTML = "<p>Error loading QTI file.</p>";
  }
}
