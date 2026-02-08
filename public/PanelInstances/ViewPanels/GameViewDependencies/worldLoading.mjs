// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs
// This file loads a world definition from the server and builds its scene objects.

function normalizeWorldPath(filePath) {
  if (!filePath) return "";
  const normalized = filePath.replace(/\\/g, "/");
  const notebookMarker = "/Notebook/";
  const idx = normalized.indexOf(notebookMarker);
  if (idx !== -1) return normalized.slice(idx + notebookMarker.length);
  return normalized.replace(/^\/+/, "");
}

export async function loadWorldFromFile(filePath, state, THREE) {
  console.log("Loading world:", filePath);

  try {
    if (!filePath) return;
    if (!window.VRWorldContext) {
      state.pendingWorldPath = filePath;
      return;
    }

    const worldPath = normalizeWorldPath(filePath);
    const res = await fetch("/api/load-world", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worldPath })
    });

    if (!res.ok) {
      console.warn("World load failed:", res.status, res.statusText);
      return;
    }

    const data = await res.json();
    const worldData = data?.worldDefinition || null;
    if (!worldData || !worldData.objects) {
      console.warn("World has no objects.");
      return;
    }

    const { scene, objects, colliders } = window.VRWorldContext;
    objects.forEach(obj => scene.remove(obj));
    objects.length = 0;
    colliders.length = 0;

    for (const def of worldData.objects) {
      let mesh = null;
      if (def.type === "box") {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(...def.size),
          new THREE.MeshStandardMaterial({ color: def.color || "#888" })
        );
      } else if (def.type === "sphere") {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(def.size[0], 32, 32),
          new THREE.MeshStandardMaterial({ color: def.color || "#888" })
        );
      }

      if (mesh) {
        mesh.position.set(...def.position);
        scene.add(mesh);
        objects.push(mesh);

        if (def.isSolid) {
          if (def.type === "box") {
            const [sx, sy, sz] = def.size;
            const halfSize = new THREE.Vector3(sx / 2, sy / 2, sz / 2);
            const center = new THREE.Vector3(...def.position);
            const box = new THREE.Box3(center.clone().sub(halfSize), center.clone().add(halfSize));
            colliders.push({ type: "box", box });
          } else if (def.type === "sphere") {
            const center = new THREE.Vector3(...def.position);
            const radius = def.size[0];
            colliders.push({ type: "sphere", center, radius });
          }
        }
      }
    }
  } catch (err) {
    console.error("Failed to load world:", err);
  }
}
