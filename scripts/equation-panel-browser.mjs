// Nodevision/scripts/equation-panel-browser.mjs
// This module validates the equation panel's extracted form and mutation modules through the real world editor, including insertion, coefficient updates, inequalities, layer synchronization, and disposal.

export async function checkEquationPanel(panel) {
  const ok = (condition, message) => { if (!condition) throw new Error(message); };
  const controller = panel._vrEquationObjectsPanel;
  const world = window.VRWorldContext;
  const before = world.objects.length;
  controller.open({ a: 0, b: 1, c: 0, d: -2, expression: 'y = 2', collider: true });
  const host = [...document.querySelectorAll('.panel')].find(node => node.textContent.includes('Configure an equation or inequality object'));
  ok(host, 'equation panel opens');
  const field = name => [...host.querySelectorAll('label')].find(node => node.textContent.trim() === name)?.querySelector('input');
  const click = name => [...host.querySelectorAll('button')].find(node => node.textContent === name).click();
  click('Insert Object');
  ok(world.objects.length === before + 1, 'equation form inserts a mesh');
  const mesh = world.objects.at(-1);
  ok(mesh.userData.equationCollider.b === 1 && mesh.userData.equationCollider.d === -2, 'equation text reaches collider configuration');
  ok(mesh.userData.colliderRef && world.colliders.includes(mesh.userData.colliderRef), 'inserted plane has collider');
  field('D').value = '-4';
  field('D').dispatchEvent(new Event('input', { bubbles: true }));
  click('Apply To Selected');
  ok(mesh.userData.equationCollider.d === -4, 'coefficient edits apply to selected plane');
  field('Equation / Inequality').value = 'y < 5';
  field('Equation / Inequality').dispatchEvent(new Event('change', { bubbles: true }));
  click('Apply To Selected');
  ok(mesh.userData.nvType === 'equation-inequality' && !mesh.userData.colliderRef, 'inequality conversion updates collider state');
  await new Promise(resolve => setTimeout(resolve, 20));
  ok(mesh.userData.metaWorldLayerId, 'equation updates synchronize a layer');
  click('Close');
  ok(!controller.isVisible(), 'equation panel closes');
  controller.openForTarget(mesh);
  ok(field('Equation / Inequality').value === 'y < 5', 'selected inequality repopulates form');
  controller.dispose();
  panel._vrEquationObjectsPanel = null;
  ok(!host.isConnected, 'equation panel disposal removes its DOM');
}
