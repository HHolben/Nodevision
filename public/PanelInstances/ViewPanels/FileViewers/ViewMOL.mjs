// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewMOL.mjs
// Viewer for MDL MOL files (.mol) – 2D diagram + 3D model with element labels

import * as THREE from '/lib/three/three.module.js';
import { OrbitControls } from '/lib/three/OrbitControls.js';

const viewers = new WeakMap();


// --------------------------------------------------
// Rendering constants
// --------------------------------------------------

// Atom sizing
const ATOM_RADIUS = 0.45;     // ← increase this to make atoms larger
const ATOM_SEGMENTS = 24;    // sphere smoothness

// Bond sizing
const BOND_RADIUS = 0.12;
const BOND_OFFSET = 0.5;    // separation for double/triple bonds

// Text
const LABEL_SCALE = 0.6;


// Label positioning
const LABEL_OFFSET = 0.9; // lift labels above atoms



/* ========================== BOND STYLES ========================== */
/*
  MOL bond orders:
  1 = single
  2 = double
  3 = triple
  4 = aromatic (often encoded this way)
*/

const BOND_STYLE = {
  1: { count: 1, color: 0x333333 }, // single
  2: { count: 2, color: 0x1f77b4 }, // double (blue)
  3: { count: 3, color: 0xd62728 }, // triple (red)
  4: { count: 2, color: 0x2ca02c }  // aromatic (green, dashed later if desired)
};


/* =============================== ENTRY ================================= */

export async function renderFile(filePath, panel, iframe, serverBase) {
  panel.innerHTML = '';

  if (!filePath || !filePath.toLowerCase().endsWith('.mol')) {
    panel.innerHTML = `<p>No MOL file selected.</p>`;
    return;
  }

  try {
    const res = await fetch(`${serverBase}/${filePath}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    const mol = parseMOL(text);

    render2D(mol, panel);
    render3D(mol, panel);

  } catch (err) {
    console.error('[ViewMOL]', err);
    panel.innerHTML = `<p style="color:red;">Error loading MOL file</p>`;
  }
}

/* ============================== PARSER ================================= */

function parseMOL(text) {
  const lines = text.split(/\r?\n/);

  const counts = lines[3];
  const atomCount = parseInt(counts.slice(0, 3));
  const bondCount = parseInt(counts.slice(3, 6));

  const atoms = [];
  const bonds = [];

  let idx = 4;

  for (let i = 0; i < atomCount; i++, idx++) {
    const l = lines[idx];
    atoms.push({
      x: parseFloat(l.slice(0, 10)),
      y: parseFloat(l.slice(10, 20)),
      z: parseFloat(l.slice(20, 30)),
      element: l.slice(31, 34).trim()
    });
  }

  for (let i = 0; i < bondCount; i++, idx++) {
    const l = lines[idx];
    bonds.push({
      a: parseInt(l.slice(0, 3)) - 1,
      b: parseInt(l.slice(3, 6)) - 1,
      order: parseInt(l.slice(6, 9))
    });
  }

  return { atoms, bonds };
}

/* ============================== 2D VIEW ================================ */
function drawBondLines(svg, x1, y1, x2, y2, order) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;

  // perpendicular unit vector
  const px = -dy / len;
  const py = dx / len;

  const spacing = 4; // px between parallel bonds
  const count = order === 2 ? 2 : order === 3 ? 3 : 1;

  for (let i = 0; i < count; i++) {
    const shift = (i - (count - 1) / 2) * spacing;

    const line = document.createElementNS(svg.namespaceURI, 'line');
    line.setAttribute('x1', x1 + px * shift);
    line.setAttribute('y1', y1 + py * shift);
    line.setAttribute('x2', x2 + px * shift);
    line.setAttribute('y2', y2 + py * shift);
    line.setAttribute('stroke', '#000');
    line.setAttribute('stroke-width', 2);

    svg.appendChild(line);
  }
}



function render2D(mol, container) {
  const width = container.clientWidth || 600;
  const height = 300;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.style.border = '1px solid #ccc';
  svg.style.background = '#fafafa';

  const xs = mol.atoms.map(a => a.x);
  const ys = mol.atoms.map(a => a.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  const scale = Math.min(
    (width - 40) / (maxX - minX || 1),
    (height - 40) / (maxY - minY || 1)
  );

  const tx = x => (x - minX) * scale + 20;
  const ty = y => height - ((y - minY) * scale + 20);

mol.bonds.forEach(b => {
  const a = mol.atoms[b.a];
  const c = mol.atoms[b.b];

  drawBondLines(
    svg,
    tx(a.x),
    ty(a.y),
    tx(c.x),
    ty(c.y),
    b.order
  );
});

  mol.atoms.forEach(a => {
    const text = document.createElementNS(svg.namespaceURI, 'text');
    text.setAttribute('x', tx(a.x));
    text.setAttribute('y', ty(a.y));
    text.setAttribute('font-size', '12');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.textContent = a.element;
    svg.appendChild(text);
  });

  container.insertAdjacentHTML('beforeend', `<h3>2D Structure</h3>`);
  container.appendChild(svg);
}

/* ============================== 3D VIEW ================================ */

class MOLViewer {
  constructor(container) {
    this.container = container;
    this.init();
  }

  init() {
    this.container.style.height = '400px';
    this.container.style.border = '1px solid #ccc';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    this.camera = new THREE.PerspectiveCamera(
      45,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      10000
    );
    this.camera.position.set(20, 20, 20);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.scene.add(new THREE.AmbientLight(0x888888));
    const d = new THREE.DirectionalLight(0xffffff, 1);
    d.position.set(1, 1, 1);
    this.scene.add(d);

    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

 clear() {
  this.scene.children = this.scene.children.filter(
    obj =>
      !obj.userData?.isAtom &&
      !obj.userData?.isBond &&
      !obj.userData?.isLabel
  );
}


loadMolecule(mol) {
  this.clear();

  const sphereGeom = new THREE.SphereGeometry(ATOM_RADIUS, 24, 24);

mol.atoms.forEach(a => {
  const atomMesh = new THREE.Mesh(
    sphereGeom,
    new THREE.MeshPhongMaterial({ color: atomColor(a.element) })
  );

  atomMesh.position.set(a.x, a.y, a.z);
  atomMesh.userData.isAtom = true;
  this.scene.add(atomMesh);

  // === Element label ===
  const label = createElementLabel(a.element, atomColor(a.element));
  label.position.copy(atomMesh.position);
  label.position.y += LABEL_OFFSET;
  label.userData.isLabel = true;
  this.scene.add(label);
});


  /* ===================== BONDS ===================== */

  for (const bond of mol.bonds) {
    const a = mol.atoms[bond.a];
    const b = mol.atoms[bond.b];

    const start = new THREE.Vector3(a.x, a.y, a.z);
    const end   = new THREE.Vector3(b.x, b.y, b.z);

    const style = BOND_STYLE[bond.order] || BOND_STYLE[1];
    const offsetDistance = 0.25;

    const dir = new THREE.Vector3().subVectors(end, start).normalize();

    // Robust perpendicular vector
    const perp = Math.abs(dir.x) < 0.9
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);

    perp.cross(dir).normalize();

    for (let i = 0; i < style.count; i++) {
      const shift = (i - (style.count - 1) / 2) * offsetDistance;
      const offset = perp.clone().multiplyScalar(shift);

 const points = [
  start.clone().add(offset),
  end.clone().add(offset)
];

const geometry = new THREE.BufferGeometry().setFromPoints(points);

const material = new THREE.LineBasicMaterial({
  color: style.color
});

const bondLine = new THREE.Line(geometry, material);
bondLine.userData.isBond = true;
this.scene.add(bondLine);


    }
  }
}

}

function render3D(mol, container) {
  container.insertAdjacentHTML('beforeend', `<h3>3D Model</h3>`);
  const div = document.createElement('div');
  container.appendChild(div);

  let viewer = viewers.get(div);
  if (!viewer) {
    viewer = new MOLViewer(div);
    viewers.set(div, viewer);
  }
  viewer.loadMolecule(mol);
}

/* ============================== LABELS ================================= */

function createElementLabel(text, color) {
  const canvas = document.createElement('canvas');
  const size = 256;
  canvas.width = canvas.height = size;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fill();

  ctx.font = 'bold 120px sans-serif';
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true })
  );

  sprite.scale.set(2.5, 2.5, 1);
  sprite.userData.isLabel = true;

  return sprite;
}

/* ============================== UTIL =================================== */

function atomColor(el) {
  return {
    H: 0xffffff,
    C: 0x909090,
    N: 0x3050f8,
    O: 0xff0d0d,
    S: 0xffff30,
    P: 0xff8000
  }[el] || 0xaaaaaa;
}
