// The session can move its live controls into Nodevision's standard dockable panel shell.
export function createPanel(panel, vars = {}) {
  panel.replaceChildren();
  if (vars.controls) panel.append(vars.controls);
  panel.cleanup = () => { if (vars.home?.isConnected && vars.controls) vars.home.append(vars.controls); };
}
