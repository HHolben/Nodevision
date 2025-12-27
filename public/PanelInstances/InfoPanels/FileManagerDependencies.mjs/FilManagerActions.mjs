export async function handleAction(actionKey) {
  const mod = await import(`/ToolbarCallbacks/file/${actionKey}.mjs`);
  await mod.default();
}
