// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/TerrainTool/terrainMaterial.mjs
// Shared material helpers for terrain tiles inserted by the Meta World terrain tool.

function makeCanvasTexture(THREE, { baseColor, texture }) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = baseColor || "#777777";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (texture === "speckled") {
    for (let i = 0; i < 180; i += 1) {
      const x = (i * 29) % 64;
      const y = (i * 47) % 64;
      const alpha = 0.12 + ((i % 7) * 0.02);
      ctx.fillStyle = i % 2 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      ctx.fillRect(x, y, 1 + (i % 3), 1 + (i % 2));
    }
  } else if (texture === "striated") {
    for (let y = 0; y < 64; y += 6) {
      ctx.fillStyle = y % 12 === 0 ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)";
      ctx.fillRect(0, y, 64, 2);
    }
  } else if (texture === "cracked") {
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i += 1) {
      ctx.beginPath();
      ctx.moveTo((i * 11) % 64, 0);
      ctx.lineTo((i * 17 + 18) % 64, 64);
      ctx.stroke();
    }
  } else if (texture === "ripples") {
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1.5;
    for (let y = 8; y < 64; y += 12) {
      ctx.beginPath();
      for (let x = 0; x <= 64; x += 4) {
        const waveY = y + Math.sin((x + y) / 7) * 2;
        if (x === 0) ctx.moveTo(x, waveY);
        else ctx.lineTo(x, waveY);
      }
      ctx.stroke();
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.needsUpdate = true;
  if (THREE.NearestFilter) {
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.NearestFilter;
  }
  if (THREE.RepeatWrapping) {
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(2, 2);
  }
  return map;
}

export function createTerrainMaterial(THREE, { color = "#777777", texture = "solid", kind = "", isLiquid = false } = {}) {
  const liquid = isLiquid === true || kind === "water";
  const baseColor = color || "#777777";

  if (liquid) {
    const materialOptions = {
      color: baseColor,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    };
    const map = texture && texture !== "solid"
      ? makeCanvasTexture(THREE, { baseColor, texture })
      : null;
    if (map) materialOptions.map = map;
    return new THREE.MeshBasicMaterial(materialOptions);
  }

  const materialOptions = {
    color: baseColor,
    roughness: 0.55,
    metalness: 0
  };
  const map = texture && texture !== "solid"
    ? makeCanvasTexture(THREE, { baseColor, texture })
    : null;
  if (map) materialOptions.map = map;
  if (texture === "ripples") {
    materialOptions.transparent = true;
    materialOptions.opacity = 0.82;
  }
  return new THREE.MeshStandardMaterial(materialOptions);
}
