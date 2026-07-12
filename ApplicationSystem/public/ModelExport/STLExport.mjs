// Nodevision/ApplicationSystem/public/ModelExport/STLExport.mjs
// Shared STL download helpers for browser-side 3D editors and viewers.

import * as THREE from "/lib/three/three.module.js";

function cleanNotebookPath(pathValue = "") {
  return String(pathValue || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "")
    .replace(/^Notebook\/+/i, "");
}

function stlFileName(pathValue = "", fallback = "model.stl") {
  const base = cleanNotebookPath(pathValue).split("/").filter(Boolean).pop() || fallback;
  const withoutExt = base.replace(/\.[^.]*$/, "") || base;
  const safe = withoutExt.replace(/[^A-Za-z0-9_.-]+/g, "_") || "model";
  return safe.toLowerCase().endsWith(".stl") ? safe : `${safe}.stl`;
}

function downloadBlob(blob, fileName) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

function objectWorldVisible(object) {
  let current = object;
  while (current) {
    if (current.visible === false) return false;
    current = current.parent;
  }
  return true;
}

export function serializeSceneToAsciiSTL(root, options = {}) {
  if (!root?.traverse) throw new Error("No 3D scene is available to export.");
  root.updateMatrixWorld?.(true);

  const meshes = [];
  let triangleCount = 0;
  root.traverse((object) => {
    if (!object?.isMesh || !objectWorldVisible(object)) return;
    const geometry = object.geometry;
    const position = geometry?.getAttribute?.("position");
    if (!position || !Number.isFinite(position.count) || position.count < 3) return;
    const index = geometry.index || null;
    const count = index ? index.count : position.count;
    const triangles = Math.floor(count / 3);
    if (triangles <= 0) return;
    triangleCount += triangles;
    meshes.push({ object, geometry, index, position });
  });

  if (triangleCount <= 0) {
    throw new Error("This model does not contain triangle mesh geometry that can be exported as STL.");
  }

  const solidName = (options.solidName || "nodevision_export").replace(/[^A-Za-z0-9_.-]+/g, "_") || "nodevision_export";
  const lines = [`solid ${solidName}`];
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const normal = new THREE.Vector3();

  function loadVertex(mesh, attributeIndex, target) {
    target.fromBufferAttribute(mesh.position, attributeIndex);
    if (mesh.object.isSkinnedMesh && typeof mesh.object.applyBoneTransform === "function") {
      mesh.object.applyBoneTransform(attributeIndex, target);
    }
    target.applyMatrix4(mesh.object.matrixWorld);
  }

  function writeFace(mesh, a, b, c) {
    loadVertex(mesh, a, vA);
    loadVertex(mesh, b, vB);
    loadVertex(mesh, c, vC);
    cb.subVectors(vC, vB);
    ab.subVectors(vA, vB);
    normal.copy(cb.cross(ab)).normalize();

    lines.push(`  facet normal ${normal.x} ${normal.y} ${normal.z}`);
    lines.push("    outer loop");
    lines.push(`      vertex ${vA.x} ${vA.y} ${vA.z}`);
    lines.push(`      vertex ${vB.x} ${vB.y} ${vB.z}`);
    lines.push(`      vertex ${vC.x} ${vC.y} ${vC.z}`);
    lines.push("    endloop");
    lines.push("  endfacet");
  }

  meshes.forEach((mesh) => {
    if (mesh.index) {
      for (let i = 0; i + 2 < mesh.index.count; i += 3) {
        writeFace(mesh, mesh.index.getX(i), mesh.index.getX(i + 1), mesh.index.getX(i + 2));
      }
      return;
    }
    for (let i = 0; i + 2 < mesh.position.count; i += 3) {
      writeFace(mesh, i, i + 1, i + 2);
    }
  });

  lines.push(`endsolid ${solidName}`);
  return `${lines.join("\n")}\n`;
}

export function exportSceneToSTL(root, pathValue = "model.stl", options = {}) {
  const fileName = stlFileName(pathValue);
  const solidName = fileName.replace(/\.stl$/i, "");
  const stl = serializeSceneToAsciiSTL(root, { solidName, ...options });
  downloadBlob(new Blob([stl], { type: "application/sla;charset=utf-8" }), fileName);
}

export async function exportScadCodeToSTL(scadCode, pathValue = "model.scad") {
  const response = await fetch("/api/scad/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scadCode: String(scadCode || ""), format: "stl" }),
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    const text = json ? "" : await response.text().catch(() => "");
    const details = [json?.error || text || `${response.status} ${response.statusText}`, json?.hint]
      .filter(Boolean)
      .join("\n");
    throw new Error(details || "SCAD STL export failed.");
  }

  const blob = await response.blob();
  downloadBlob(blob, stlFileName(pathValue));
}
