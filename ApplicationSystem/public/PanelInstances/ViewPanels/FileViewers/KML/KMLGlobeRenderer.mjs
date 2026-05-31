import { formatCoordinates } from "./KMLParser.mjs";
import * as THREE from "/lib/three/three.module.js";
import { OrbitControls } from "/lib/three/OrbitControls.js";

const EARTH_RADIUS = 1;
const POINT_SIZE = 0.018;
const SELECTED_POINT_SIZE = 0.028;
const FEATURE_ARC_ALTITUDE = 0.034;
const DRAW_ARC_ALTITUDE = 0.04;
const ARC_MAX_STEP_RADIANS = Math.PI / 72;
const DEFAULT_STROKE = "#2f6fed";
const SELECTED_COLOR = "#f7c948";
const NATURAL_EARTH_TEXTURE_URL = "/assets/earth/natural-earth-1-4096.jpg";

function toRad(value) {
  return Number(value || 0) * Math.PI / 180;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function colorValue(value, fallback = DEFAULT_STROKE) {
  const raw = String(value || "").trim();
  if (/^#[0-9a-f]{3,8}$/i.test(raw)) return raw.slice(0, 7);
  return fallback;
}

function pointFromCoord(coord, radius = EARTH_RADIUS + 0.01) {
  const lat = clamp(Number(coord?.lat || 0), -89.999, 89.999);
  const lon = Number(coord?.lon || 0);
  const phi = toRad(90 - lat);
  const theta = toRad(lon + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function arcPointsBetweenCoords(startCoord, endCoord, radius) {
  const start = pointFromCoord(startCoord, 1).normalize();
  const end = pointFromCoord(endCoord, 1).normalize();
  const angle = Math.acos(clamp(start.dot(end), -1, 1));
  if (angle < 0.000001) return [start.multiplyScalar(radius)];

  const steps = Math.max(2, Math.ceil(angle / ARC_MAX_STEP_RADIANS));
  const sinAngle = Math.sin(angle);
  const points = [];

  let rotationAxis = null;
  if (Math.abs(sinAngle) < 0.000001) {
    rotationAxis = new THREE.Vector3(0, 1, 0).cross(start);
    if (rotationAxis.lengthSq() < 0.000001) {
      rotationAxis = new THREE.Vector3(1, 0, 0).cross(start);
    }
    rotationAxis.normalize();
  }

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const point = rotationAxis
      ? start.clone().applyAxisAngle(rotationAxis, angle * t)
      : start.clone()
        .multiplyScalar(Math.sin((1 - t) * angle) / sinAngle)
        .add(end.clone().multiplyScalar(Math.sin(t * angle) / sinAngle));
    points.push(point.normalize().multiplyScalar(radius));
  }
  return points;
}

function arcPointsFromCoords(coords, radius) {
  const points = [];
  for (let index = 0; index < coords.length - 1; index += 1) {
    const segmentPoints = arcPointsBetweenCoords(coords[index], coords[index + 1], radius);
    if (index > 0) segmentPoints.shift();
    points.push(...segmentPoints);
  }
  return points;
}

function coordFromPoint(point) {
  const normalized = point.clone().normalize();
  const lat = 90 - (Math.acos(clamp(normalized.y, -1, 1)) * 180 / Math.PI);
  const lon = (Math.atan2(normalized.z, -normalized.x) * 180 / Math.PI) - 180;
  const wrappedLon = ((lon + 540) % 360) - 180;
  return { lon: wrappedLon, lat, alt: null };
}

function coordsFromLineObject(object) {
  return Array.from(object?.userData?.coords || []).map((coord) => ({ ...coord }));
}

function createEarthTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  const ocean = ctx.createLinearGradient(0, 0, 0, canvas.height);
  ocean.addColorStop(0, "#163d66");
  ocean.addColorStop(0.48, "#205f91");
  ocean.addColorStop(1, "#102e51");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#6d9f60";
  const land = [
    [290, 245, 210, 150], [410, 390, 145, 260], [770, 250, 360, 160],
    [1010, 420, 250, 210], [1380, 305, 300, 180], [1530, 510, 150, 120],
    [1760, 640, 120, 80], [965, 720, 560, 70],
  ];
  land.forEach(([x, y, w, h]) => {
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.globalAlpha = 0.24;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * canvas.width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * canvas.height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function loadEarthTexture(renderer, applyTexture) {
  const fallbackTexture = createEarthTexture();
  const loader = new THREE.TextureLoader();
  loader.load(
    NATURAL_EARTH_TEXTURE_URL,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 1);
      applyTexture?.(texture);
    },
    undefined,
    () => {
      applyTexture?.(fallbackTexture);
    },
  );
  return fallbackTexture;
}

function firstCoord(record) {
  return record?.geometry?.coordinates?.[0] || null;
}

function recordCenter(record) {
  const coords = record?.geometry?.coordinates || [];
  if (!coords.length) return null;
  const sum = coords.reduce((acc, coord) => {
    acc.lat += Number(coord.lat || 0);
    acc.lon += Number(coord.lon || 0);
    return acc;
  }, { lat: 0, lon: 0 });
  return { lat: sum.lat / coords.length, lon: sum.lon / coords.length, alt: null };
}

function makeSpriteLabel(text) {
  const label = String(text || "").trim();
  if (!label) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.font = "32px system-ui, -apple-system, Segoe UI, sans-serif";
  const width = Math.min(496, Math.ceil(ctx.measureText(label).width + 34));
  ctx.fillStyle = "rgba(248,250,252,0.9)";
  ctx.strokeStyle = "rgba(15,23,42,0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(6, 16, width, 54, 12);
  } else {
    ctx.rect(6, 16, width, 54);
  }
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#111827";
  ctx.fillText(label.slice(0, 34), 22, 53);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(0.38, 0.071, 1);
  sprite.renderOrder = 10;
  return sprite;
}

export async function createKMLGlobeRenderer(container, { onSelect, onGeometryChange } = {}) {
  container.innerHTML = "";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#07111f");

  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
  camera.position.set(0, 0.75, 3.1);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.35;
  controls.maxDistance = 7;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;

  scene.add(new THREE.HemisphereLight("#dceeff", "#07111f", 2.2));
  const sun = new THREE.DirectionalLight("#ffffff", 2.4);
  sun.position.set(3, 2, 4);
  scene.add(sun);

  let rendererDestroyed = false;
  const globeMaterial = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0.0 });
  const initialEarthTexture = loadEarthTexture(renderer, (texture) => {
    if (rendererDestroyed) {
      texture.dispose?.();
      return;
    }
    if (globeMaterial.map && globeMaterial.map !== texture) globeMaterial.map.dispose?.();
    globeMaterial.map = texture;
    globeMaterial.needsUpdate = true;
  });
  globeMaterial.map = initialEarthTexture;

  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS, 96, 64),
    globeMaterial,
  );
  globe.name = "KML Globe";
  scene.add(globe);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS * 1.012, 96, 64),
    new THREE.MeshBasicMaterial({ color: "#5fb3ff", transparent: true, opacity: 0.1, side: THREE.BackSide }),
  );
  scene.add(atmosphere);

  const featureGroup = new THREE.Group();
  scene.add(featureGroup);
  const drawGroup = new THREE.Group();
  scene.add(drawGroup);

  const raycaster = new THREE.Raycaster();
  raycaster.params.Line.threshold = 0.035;
  const pointer = new THREE.Vector2();
  const layersById = new Map();
  const pickables = [];
  let selectedId = null;
  let drawState = null;
  let animationFrame = null;
  let flyAnimationFrame = null;

  function resize() {
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width || container.clientWidth || 1));
    const height = Math.max(1, Math.floor(rect.height || container.clientHeight || 1));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function setPointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
  }

  function clearGroup(group) {
    while (group.children.length) {
      const child = group.children.pop();
      child.traverse?.((node) => {
        node.geometry?.dispose?.();
        if (Array.isArray(node.material)) node.material.forEach((mat) => mat.dispose?.());
        else node.material?.dispose?.();
      });
    }
  }

  function makeFeatureObject(record) {
    const geometry = record.geometry;
    const coords = geometry?.coordinates || [];
    if (!geometry || !coords.length) return null;

    const selected = record.id === selectedId;
    const color = new THREE.Color(selected ? SELECTED_COLOR : colorValue(record.style?.stroke || record.style?.marker));
    const root = new THREE.Group();
    root.userData.kmlRecord = record;

    if (geometry.type === "Point") {
      const point = pointFromCoord(coords[0], EARTH_RADIUS + 0.026);
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(selected ? SELECTED_POINT_SIZE : POINT_SIZE, 24, 16),
        new THREE.MeshStandardMaterial({ color, emissive: selected ? new THREE.Color("#806000") : new THREE.Color("#000000"), roughness: 0.42 }),
      );
      marker.position.copy(point);
      marker.userData.kmlRecord = record;
      marker.userData.pickable = true;
      root.add(marker);

      const label = selected ? makeSpriteLabel(record.name) : null;
      if (label) {
        label.position.copy(point.clone().multiplyScalar(1.055));
        root.add(label);
      }
    } else if (geometry.type === "LineString" || geometry.type === "Polygon") {
      const lineCoords = geometry.type === "Polygon" && coords.length > 2
        ? [...coords, coords[0]]
        : coords;
      const points = arcPointsFromCoords(lineCoords, EARTH_RADIUS + FEATURE_ARC_ALTITUDE);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color, linewidth: selected ? 4 : 2 }),
      );
      line.userData.kmlRecord = record;
      line.userData.coords = coords;
      line.userData.pickable = true;
      root.add(line);

      if (selected) {
        coords.forEach((coord) => {
          const vertex = new THREE.Mesh(
            new THREE.SphereGeometry(0.012, 12, 8),
            new THREE.MeshBasicMaterial({ color: SELECTED_COLOR }),
          );
          vertex.position.copy(pointFromCoord(coord, EARTH_RADIUS + 0.032));
          root.add(vertex);
        });
      }
    }

    root.traverse((node) => {
      if (node.userData?.pickable) pickables.push(node);
    });
    return root;
  }

  function render(records = []) {
    clearGroup(featureGroup);
    layersById.clear();
    pickables.length = 0;
    records.filter((record) => record.geometry && record.visible !== false).forEach((record) => {
      const object = makeFeatureObject(record);
      if (!object) return;
      layersById.set(record.id, object);
      featureGroup.add(object);
    });
  }

  function setSelected(id) {
    selectedId = id;
    const records = Array.from(layersById.values()).map((object) => object.userData.kmlRecord).filter(Boolean);
    render(records);
  }

  function cameraPlacementForCoord(coord, distance = Math.max(2.1, camera.position.length())) {
    const target = pointFromCoord(coord, EARTH_RADIUS);
    return {
      target: target.clone().multiplyScalar(0.4),
      position: target.clone().normalize().multiplyScalar(distance),
    };
  }

  function cancelFlyAnimation() {
    if (flyAnimationFrame) cancelAnimationFrame(flyAnimationFrame);
    flyAnimationFrame = null;
  }

  function cameraToCoord(coord, distance = Math.max(2.1, camera.position.length())) {
    cancelFlyAnimation();
    const placement = cameraPlacementForCoord(coord, distance);
    controls.target.copy(placement.target);
    camera.position.copy(placement.position);
    camera.lookAt(controls.target);
    controls.update();
  }

  function flyCameraToCoord(coord, distance = Math.max(2.1, camera.position.length())) {
    cancelFlyAnimation();
    const placement = cameraPlacementForCoord(coord, distance);
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    const duration = 520;
    const startedAt = performance.now();

    const step = (now) => {
      const rawT = Math.min(1, (now - startedAt) / duration);
      const t = 1 - Math.pow(1 - rawT, 3);
      camera.position.lerpVectors(startPosition, placement.position, t);
      controls.target.lerpVectors(startTarget, placement.target, t);
      camera.lookAt(controls.target);
      controls.update();
      if (rawT < 1) {
        flyAnimationFrame = requestAnimationFrame(step);
      } else {
        flyAnimationFrame = null;
      }
    };

    flyAnimationFrame = requestAnimationFrame(step);
  }

  function fitAll() {
    const records = Array.from(layersById.values()).map((object) => object.userData.kmlRecord).filter(Boolean);
    const coords = records.flatMap((record) => record.geometry?.coordinates || []);
    if (!coords.length) return;
    const center = {
      lat: coords.reduce((sum, coord) => sum + Number(coord.lat || 0), 0) / coords.length,
      lon: coords.reduce((sum, coord) => sum + Number(coord.lon || 0), 0) / coords.length,
      alt: null,
    };
    cameraToCoord(center, coords.length > 1 ? 2.7 : 2.05);
  }

  function flyToRecord(record) {
    const center = recordCenter(record) || firstCoord(record);
    if (!center) return;
    flyCameraToCoord(center, record.geometry?.type === "Point" ? 1.75 : 2.25);
  }

  function removePickablesForRecord(recordId) {
    for (let index = pickables.length - 1; index >= 0; index -= 1) {
      if (pickables[index]?.userData?.kmlRecord?.id === recordId) pickables.splice(index, 1);
    }
  }

  function setRecordVisible(record, visible) {
    record.visible = visible;
    if (!visible) {
      const object = layersById.get(record.id);
      if (object) {
        featureGroup.remove(object);
        layersById.delete(record.id);
        removePickablesForRecord(record.id);
      }
      return;
    }
    if (visible && !layersById.has(record.id) && record.geometry) {
      const object = makeFeatureObject(record);
      if (object) {
        layersById.set(record.id, object);
        featureGroup.add(object);
      }
    }
  }

  function pointOnGlobeFromEvent(event) {
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(globe, false);
    return hits[0]?.point ? coordFromPoint(hits[0].point) : null;
  }

  function pickFeature(event) {
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    const record = hits[0]?.object?.userData?.kmlRecord;
    if (record) onSelect?.(record);
  }

  function updateDrawPreview() {
    clearGroup(drawGroup);
    if (!drawState?.coords?.length) return;
    const color = new THREE.Color(SELECTED_COLOR);
    drawState.coords.forEach((coord) => {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 12, 8),
        new THREE.MeshBasicMaterial({ color }),
      );
      marker.position.copy(pointFromCoord(coord, EARTH_RADIUS + 0.04));
      drawGroup.add(marker);
    });
    if (drawState.coords.length > 1) {
      const lineCoords = drawState.type === "polygon" && drawState.coords.length > 2
        ? [...drawState.coords, drawState.coords[0]]
        : drawState.coords;
      drawGroup.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(arcPointsFromCoords(lineCoords, EARTH_RADIUS + DRAW_ARC_ALTITUDE)),
        new THREE.LineBasicMaterial({ color }),
      ));
    }
  }

  function finishDraw() {
    if (!drawState) return;
    const { type, callback, coords } = drawState;
    drawState = null;
    clearGroup(drawGroup);
    const min = type === "marker" ? 1 : type === "polyline" ? 2 : 3;
    if (coords.length >= min) callback?.(coords.slice());
  }

  function startDraw(type, callback) {
    drawState = { type, callback, coords: [] };
  }

  function onClick(event) {
    if (drawState) {
      const coord = pointOnGlobeFromEvent(event);
      if (!coord) return;
      drawState.coords.push(coord);
      updateDrawPreview();
      if (drawState.type === "marker") finishDraw();
      return;
    }
    pickFeature(event);
  }

  function onDoubleClick(event) {
    if (!drawState) return;
    event.preventDefault();
    finishDraw();
  }

  function editRecord(record) {
    if (record?.geometry?.type === "Point") {
      startDraw("marker", (coords) => onGeometryChange?.(record, coords));
      return true;
    }
    return false;
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  function onContextMenu(event) {
    if (!drawState) return;
    event.preventDefault();
    finishDraw();
  }

  renderer.domElement.addEventListener("click", onClick);
  renderer.domElement.addEventListener("dblclick", onDoubleClick);
  renderer.domElement.addEventListener("contextmenu", onContextMenu);

  function animate() {
    controls.update();
    renderer.render(scene, camera);
    animationFrame = requestAnimationFrame(animate);
  }
  resize();
  animate();

  return {
    map: { type: "three-globe", scene, camera, renderer },
    render,
    setSelected,
    fitAll,
    flyToRecord,
    setRecordVisible,
    editRecord,
    startAddPlacemark: (callback) => startDraw("marker", callback),
    startDrawPath: (callback) => startDraw("polyline", callback),
    startDrawPolygon: (callback) => startDraw("polygon", callback),
    destroy() {
      rendererDestroyed = true;
      cancelFlyAnimation();
      if (animationFrame) cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("dblclick", onDoubleClick);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);
      controls.dispose();
      clearGroup(featureGroup);
      clearGroup(drawGroup);
      globe.geometry?.dispose?.();
      globe.material?.map?.dispose?.();
      globe.material?.dispose?.();
      atmosphere.geometry?.dispose?.();
      atmosphere.material?.dispose?.();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export function coordinatesFromGlobeLayer(layer) {
  if (!layer) return "";
  if (layer.userData?.coords) return formatCoordinates(coordsFromLineObject(layer));
  if (layer.position) return formatCoordinates([coordFromPoint(layer.position)]);
  return "";
}
