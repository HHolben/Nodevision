import { attachFallbackReferenceList } from "./referenceFallbackRows.mjs";
import { normalizeReferenceCandidate } from "../utils/referenceFallbacks.mjs";

export function showReferenceDetailsDialog({
    title = "Reference",
    primaryLabel = "Destination",
    primaryValue = "",
    primaryPlaceholder = "Notebook path or URL",
    textLabel = "Text",
    textValue = "",
    showText = true,
    requireText = false,
    primaryRequired = true,
    fallbacks = []
} = {}) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.background = "rgba(0,0,0,0.28)";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.zIndex = "10000";

        const panel = document.createElement("form");
        panel.style.width = "min(560px, calc(100vw - 32px))";
        panel.style.background = "#fff";
        panel.style.border = "1px solid #cfd5df";
        panel.style.borderRadius = "8px";
        panel.style.boxShadow = "0 18px 40px rgba(20,28,40,0.22)";
        panel.style.padding = "14px";
        panel.style.font = "13px system-ui, sans-serif";
        panel.style.color = "#18202f";

        const heading = document.createElement("div");
        heading.textContent = title;
        heading.style.fontWeight = "700";
        heading.style.fontSize = "14px";
        heading.style.marginBottom = "10px";
        panel.appendChild(heading);

        const primaryWrap = document.createElement("label");
        primaryWrap.style.display = "flex";
        primaryWrap.style.flexDirection = "column";
        primaryWrap.style.gap = "4px";
        primaryWrap.textContent = primaryLabel;

        const primaryInput = document.createElement("input");
        primaryInput.type = "text";
        primaryInput.value = primaryValue || "";
        primaryInput.placeholder = primaryPlaceholder;
        primaryInput.required = primaryRequired;
        primaryInput.style.padding = "7px 9px";
        primaryInput.style.border = "1px solid #ccd2dc";
        primaryInput.style.borderRadius = "4px";
        primaryInput.style.fontSize = "13px";
        primaryWrap.appendChild(primaryInput);
        panel.appendChild(primaryWrap);

        let textInput = null;
        if (showText) {
            const textWrap = document.createElement("label");
            textWrap.style.display = "flex";
            textWrap.style.flexDirection = "column";
            textWrap.style.gap = "4px";
            textWrap.style.marginTop = "8px";
            textWrap.textContent = textLabel;

            textInput = document.createElement("input");
            textInput.type = "text";
            textInput.value = textValue || "";
            textInput.required = requireText;
            textInput.style.padding = "7px 9px";
            textInput.style.border = "1px solid #ccd2dc";
            textInput.style.borderRadius = "4px";
            textInput.style.fontSize = "13px";
            textWrap.appendChild(textInput);
            panel.appendChild(textWrap);
        }

        const fallbackHost = document.createElement("div");
        panel.appendChild(fallbackHost);
        const fallbackList = attachFallbackReferenceList({
            container: fallbackHost,
            primaryInput,
            initialFallbacks: fallbacks
        });

        const status = document.createElement("div");
        status.style.minHeight = "18px";
        status.style.fontSize = "12px";
        status.style.color = "#a03d24";
        panel.appendChild(status);

        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.justifyContent = "flex-end";
        actions.style.gap = "8px";
        actions.style.marginTop = "8px";

        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.textContent = "Cancel";
        cancel.style.padding = "7px 12px";
        cancel.style.border = "1px solid #c7ced9";
        cancel.style.borderRadius = "4px";
        cancel.style.background = "#fff";
        actions.appendChild(cancel);

        const apply = document.createElement("button");
        apply.type = "submit";
        apply.textContent = "Apply";
        apply.style.padding = "7px 12px";
        apply.style.border = "1px solid #2768d8";
        apply.style.borderRadius = "4px";
        apply.style.background = "#2768d8";
        apply.style.color = "#fff";
        actions.appendChild(apply);

        panel.appendChild(actions);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        function cleanup(result) {
            overlay.remove();
            resolve(result);
        }

        cancel.addEventListener("click", () => cleanup(null));
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) cleanup(null);
        });
        panel.addEventListener("submit", (event) => {
            event.preventDefault();
            const primary = normalizeReferenceCandidate(primaryInput.value);
            if (primaryRequired && !primary) {
                status.textContent = "Enter a safe primary destination.";
                primaryInput.focus();
                return;
            }
            const text = textInput ? textInput.value.trim() : "";
            if (requireText && !text) {
                status.textContent = "Enter text.";
                textInput.focus();
                return;
            }
            cleanup({
                primary,
                text,
                fallbacks: fallbackList.getFallbacks()
            });
        });

        setTimeout(() => (showText && textInput ? textInput : primaryInput).focus(), 0);
    });
}
