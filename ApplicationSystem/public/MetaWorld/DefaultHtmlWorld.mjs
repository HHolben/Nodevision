// Nodevision/ApplicationSystem/public/MetaWorld/DefaultHtmlWorld.mjs
// This factory initializes an HTML page's first world using ordinary editable equation and iframe objects; it is never applied to an existing saved world definition.
export function createDefaultHtmlWorld(filePath) {
  const source = String(filePath).replace(/\\/g, '/').replace(/^\/?Notebook\//, '').replace(/^\/+/, '');
  return {
    name: source.split('/').pop() || 'HTML World',
    type: 'meta-world',
    spawnYaw: 0,
    metadata: {
      objectGroundOnly: true,
      playerRules: { allowInspect: true, allowToolUse: true },
      environment: { skyColor: '#ffffff', floorColor: '#d8dee4', backgroundMode: 'color' }
    },
    objects: [
      { id: 'page-ground', type: 'equation-collider-plane', name: 'Ground', position: [0, 0, 0],
        equationCollider: { kind: 'plane', expression: 'y = 0', a: 0, b: 1, c: 0, d: 0, infinite: true, thickness: 0.02 },
        color: '#d8dee4', collider: true, isSolid: true },
      { id: 'page-frame', type: 'iframe', name: 'Webpage', position: [0, 1.75, -1],
        size: [2.4, 1.35, 0.02], src: '/Notebook/' + source.split('/').map(encodeURIComponent).join('/'), iframeTitle: source.split('/').pop(),
        iframeSourceKind: 'webpage', collider: false, isSolid: false }
    ]
  };
}
