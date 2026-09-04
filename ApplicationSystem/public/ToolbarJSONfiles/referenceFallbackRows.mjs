import { normalizeFallbackReferences } from "../utils/referenceFallbacks.mjs";

function button(label, title) {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = label;
    element.title = title || label;
    element.style.padding = "4px 7px";
    element.style.border = "1px solid #d3d7df";
    element.style.borderRadius = "4px";
    element.style.background = "#fff";
    element.style.cursor = "pointer";
    return element;
}

function buildInput(value = "") {
    const input = document.createElement("input");
    input.type = "text";
    input.value = value;
    input.placeholder = "Notebook path or URL";
    input.style.flex = "1 1 auto";
    input.style.minWidth = "180px";
    input.style.padding = "6px 8px";
    input.style.border = "1px solid #ccd2dc";
    input.style.borderRadius = "4px";
    input.style.fontSize = "12px";
    return input;
}

export function attachFallbackReferenceList({
    container,
    primaryInput,
    initialFallbacks = [],
    summary = "Fallback Links"
} = {}) {
    if (!container) {
        throw new Error("attachFallbackReferenceList requires a container.");
    }

    const details = document.createElement("details");
    details.style.border = "1px solid #d8dde6";
    details.style.borderRadius = "6px";
    details.style.padding = "6px 8px";
    details.style.margin = "8px 0";
    details.style.background = "#fafbfc";

    const summaryElement = document.createElement("summary");
    summaryElement.textContent = summary;
    summaryElement.style.cursor = "pointer";
    summaryElement.style.fontSize = "12px";
    summaryElement.style.fontWeight = "600";
    details.appendChild(summaryElement);

    const list = document.createElement("div");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "6px";
    list.style.marginTop = "8px";
    details.appendChild(list);

    const addButton = button("+ Add", "Add fallback link");
    addButton.style.alignSelf = "flex-start";
    addButton.style.marginTop = "6px";
    details.appendChild(addButton);
    container.appendChild(details);

    const rows = [];

    function syncOpenState() {
        details.open = rows.length > 0;
    }

    function values() {
        return rows.map((row) => row.input.value);
    }

    function redraw() {
        list.textContent = "";
        rows.forEach((row, index) => {
            const rowElement = document.createElement("div");
            rowElement.style.display = "flex";
            rowElement.style.alignItems = "center";
            rowElement.style.gap = "4px";

            const position = document.createElement("span");
            position.textContent = String(index + 1);
            position.style.width = "18px";
            position.style.textAlign = "right";
            position.style.fontSize = "12px";
            position.style.color = "#5f6878";
            rowElement.appendChild(position);

            rowElement.appendChild(row.input);

            const up = button("^", "Move fallback up");
            up.disabled = index === 0;
            up.addEventListener("click", () => {
                if (index === 0) return;
                rows.splice(index - 1, 0, rows.splice(index, 1)[0]);
                redraw();
            });
            rowElement.appendChild(up);

            const down = button("v", "Move fallback down");
            down.disabled = index === rows.length - 1;
            down.addEventListener("click", () => {
                if (index === rows.length - 1) return;
                rows.splice(index + 1, 0, rows.splice(index, 1)[0]);
                redraw();
            });
            rowElement.appendChild(down);

            const promote = button("Primary", "Promote fallback to primary");
            promote.addEventListener("click", () => {
                const promoted = row.input.value;
                const oldPrimary = primaryInput?.value || "";
                rows.splice(index, 1);
                if (primaryInput) primaryInput.value = promoted;
                if (oldPrimary) {
                    rows.unshift({ input: buildInput(oldPrimary) });
                }
                setFallbacks(values());
            });
            rowElement.appendChild(promote);

            const remove = button("x", "Remove fallback");
            remove.addEventListener("click", () => {
                rows.splice(index, 1);
                redraw();
                syncOpenState();
            });
            rowElement.appendChild(remove);

            list.appendChild(rowElement);
        });
    }

    function addRow(value = "") {
        rows.push({ input: buildInput(value) });
        redraw();
        syncOpenState();
    }

    function setFallbacks(fallbacks = []) {
        rows.splice(0, rows.length);
        for (const value of normalizeFallbackReferences(fallbacks, {
            primary: primaryInput?.value || ""
        })) {
            rows.push({ input: buildInput(value) });
        }
        redraw();
        syncOpenState();
    }

    function getFallbacks() {
        return normalizeFallbackReferences(values(), {
            primary: primaryInput?.value || ""
        });
    }

    addButton.addEventListener("click", () => addRow(""));
    setFallbacks(initialFallbacks);

    return {
        element: details,
        getFallbacks,
        setFallbacks,
        addRow
    };
}
