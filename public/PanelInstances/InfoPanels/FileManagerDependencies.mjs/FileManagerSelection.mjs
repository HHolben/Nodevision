export function attachSelectionHandlers(state, link) {
  link.addEventListener("click", e => {
    e.preventDefault();
    state.selectedPath = link.dataset.fullPath;

    state.panelElem
      .querySelectorAll(".selected")
      .forEach(el => el.classList.remove("selected"));

    link.classList.add("selected");
  });
}
