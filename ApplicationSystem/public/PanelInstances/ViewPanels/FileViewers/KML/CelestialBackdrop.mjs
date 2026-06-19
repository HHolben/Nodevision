import * as THREE from "/lib/three/three.module.js";

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const CELESTIAL_RADIUS = 16;
const STAR_LABEL_LIMIT = 1.65;
const SKY_REFRESH_MS = 30000;

export const DEFAULT_CELESTIAL_OPTIONS = Object.freeze({
  showStars: true,
  showSun: true,
  showMoon: true,
  showLabels: false,
  useCurrentTime: true,
  useSunLight: true,
  observationTime: null,
});

const BRIGHT_STARS = Object.freeze([
  { name: "Sirius", ra: 6.7525, dec: -16.7161, mag: -1.46, color: "#dbe8ff" },
  { name: "Canopus", ra: 6.3992, dec: -52.6957, mag: -0.74, color: "#fff0d0" },
  { name: "Arcturus", ra: 14.2610, dec: 19.1825, mag: -0.05, color: "#ffd49a" },
  { name: "Vega", ra: 18.6156, dec: 38.7837, mag: 0.03, color: "#e6efff" },
  { name: "Capella", ra: 5.2782, dec: 45.9980, mag: 0.08, color: "#fff0ba" },
  { name: "Rigel", ra: 5.2423, dec: -8.2016, mag: 0.13, color: "#cfdfff" },
  { name: "Procyon", ra: 7.6550, dec: 5.2250, mag: 0.34, color: "#f8f4df" },
  { name: "Betelgeuse", ra: 5.9195, dec: 7.4071, mag: 0.42, color: "#ffb07c" },
  { name: "Achernar", ra: 1.6286, dec: -57.2368, mag: 0.46, color: "#d9e7ff" },
  { name: "Hadar", ra: 14.0637, dec: -60.3730, mag: 0.61, color: "#dce8ff" },
  { name: "Altair", ra: 19.8464, dec: 8.8683, mag: 0.77, color: "#f0f6ff" },
  { name: "Acrux", ra: 12.4433, dec: -63.0991, mag: 0.76, color: "#d7e5ff" },
  { name: "Aldebaran", ra: 4.5987, dec: 16.5093, mag: 0.86, color: "#ffc48e" },
  { name: "Spica", ra: 13.4199, dec: -11.1613, mag: 0.98, color: "#dce8ff" },
  { name: "Antares", ra: 16.4901, dec: -26.4320, mag: 1.06, color: "#ff9a72" },
  { name: "Pollux", ra: 7.7553, dec: 28.0262, mag: 1.14, color: "#ffdca5" },
  { name: "Fomalhaut", ra: 22.9608, dec: -29.6222, mag: 1.16, color: "#edf4ff" },
  { name: "Deneb", ra: 20.6905, dec: 45.2803, mag: 1.25, color: "#e5efff" },
  { name: "Mimosa", ra: 12.7953, dec: -59.6888, mag: 1.25, color: "#dbe8ff" },
  { name: "Regulus", ra: 10.1395, dec: 11.9672, mag: 1.35, color: "#dde9ff" },
  { name: "Adhara", ra: 6.9771, dec: -28.9721, mag: 1.50, color: "#dbe7ff" },
  { name: "Castor", ra: 7.5767, dec: 31.8883, mag: 1.58, color: "#eff6ff" },
  { name: "Shaula", ra: 17.5601, dec: -37.1038, mag: 1.62, color: "#e2ecff" },
  { name: "Gacrux", ra: 12.5194, dec: -57.1132, mag: 1.63, color: "#ffbd91" },
  { name: "Bellatrix", ra: 5.4189, dec: 6.3497, mag: 1.64, color: "#d8e5ff" },
  { name: "Elnath", ra: 5.4382, dec: 28.6075, mag: 1.65, color: "#e4edff" },
  { name: "Miaplacidus", ra: 9.2201, dec: -69.7172, mag: 1.67, color: "#f2f7ff" },
  { name: "Alnilam", ra: 5.6036, dec: -1.2019, mag: 1.69, color: "#cfdfff" },
  { name: "Alnair", ra: 22.1372, dec: -46.9609, mag: 1.73, color: "#eaf2ff" },
  { name: "Alioth", ra: 12.9005, dec: 55.9598, mag: 1.76, color: "#f0f6ff" },
  { name: "Alnitak", ra: 5.6793, dec: -1.9426, mag: 1.77, color: "#d5e3ff" },
  { name: "Dubhe", ra: 11.0621, dec: 61.7510, mag: 1.79, color: "#ffd6a2" },
  { name: "Mirfak", ra: 3.4054, dec: 49.8612, mag: 1.79, color: "#fff2ca" },
  { name: "Wezen", ra: 7.1399, dec: -26.3932, mag: 1.83, color: "#fff4d0" },
  { name: "Sargas", ra: 17.6219, dec: -42.9980, mag: 1.86, color: "#fff2d0" },
  { name: "Kaus Australis", ra: 18.4029, dec: -34.3846, mag: 1.85, color: "#dfeaff" },
  { name: "Avior", ra: 8.3752, dec: -59.5095, mag: 1.86, color: "#ffd8a8" },
  { name: "Alkaid", ra: 13.7923, dec: 49.3133, mag: 1.86, color: "#d8e6ff" },
  { name: "Menkalinan", ra: 5.9921, dec: 44.9474, mag: 1.90, color: "#eef5ff" },
  { name: "Atria", ra: 16.8111, dec: -69.0277, mag: 1.91, color: "#ffbd90" },
  { name: "Alhena", ra: 6.6285, dec: 16.3994, mag: 1.93, color: "#edf4ff" },
  { name: "Peacock", ra: 20.4275, dec: -56.7351, mag: 1.94, color: "#dce8ff" },
  { name: "Polaris", ra: 2.5303, dec: 89.2641, mag: 1.98, color: "#fff0c5" },
  { name: "Mirzam", ra: 6.3783, dec: -17.9559, mag: 1.98, color: "#dbe8ff" },
  { name: "Alphard", ra: 9.4598, dec: -8.6586, mag: 1.99, color: "#ffcc99" },
  { name: "Hamal", ra: 2.1195, dec: 23.4624, mag: 2.00, color: "#ffd39e" },
  { name: "Diphda", ra: 0.7265, dec: -17.9866, mag: 2.04, color: "#ffd3a0" },
  { name: "Nunki", ra: 18.9211, dec: -26.2967, mag: 2.05, color: "#dce8ff" },
  { name: "Mizar", ra: 13.3987, dec: 54.9254, mag: 2.23, color: "#eff6ff" },
  { name: "Alpheratz", ra: 0.1398, dec: 29.0904, mag: 2.06, color: "#dce8ff" },
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeDegrees(value) {
  return ((Number(value || 0) % 360) + 360) % 360;
}

function normalizeRadians(value) {
  return normalizeDegrees(value * RAD_TO_DEG) * DEG_TO_RAD;
}

function toJulianDate(date) {
  return (date.getTime() / 86400000) + 2440587.5;
}

function gmstDegrees(date) {
  const jd = toJulianDate(date);
  const t = (jd - 2451545.0) / 36525;
  return normalizeDegrees(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t - (t * t * t) / 38710000);
}

function vectorFromLatLon(latDeg, lonDeg, radius = CELESTIAL_RADIUS) {
  const lat = clamp(Number(latDeg || 0), -89.9999, 89.9999) * DEG_TO_RAD;
  const lon = Number(lonDeg || 0) * DEG_TO_RAD;
  const cosLat = Math.cos(lat);
  return new THREE.Vector3(
    radius * cosLat * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * cosLat * Math.sin(lon),
  );
}

function directionFromRaDec(raRad, decRad, date, radius = CELESTIAL_RADIUS) {
  const lonDeg = normalizeDegrees((raRad * RAD_TO_DEG) - gmstDegrees(date));
  const wrappedLon = lonDeg > 180 ? lonDeg - 360 : lonDeg;
  return vectorFromLatLon(decRad * RAD_TO_DEG, wrappedLon, radius);
}

function sunRaDec(date) {
  const jd = toJulianDate(date);
  const n = jd - 2451545.0;
  const meanLongitude = normalizeDegrees(280.460 + 0.9856474 * n);
  const meanAnomaly = normalizeDegrees(357.528 + 0.9856003 * n) * DEG_TO_RAD;
  const eclipticLongitude = normalizeDegrees(meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.020 * Math.sin(2 * meanAnomaly)) * DEG_TO_RAD;
  const obliquity = (23.439 - 0.0000004 * n) * DEG_TO_RAD;
  const ra = normalizeRadians(Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude)));
  const dec = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  return { ra, dec };
}

function moonRaDec(date) {
  const d = toJulianDate(date) - 2451543.5;
  const node = normalizeDegrees(125.1228 - 0.0529538083 * d) * DEG_TO_RAD;
  const inclination = 5.1454 * DEG_TO_RAD;
  const periapsis = normalizeDegrees(318.0634 + 0.1643573223 * d) * DEG_TO_RAD;
  const eccentricity = 0.0549;
  const meanAnomaly = normalizeDegrees(115.3654 + 13.0649929509 * d) * DEG_TO_RAD;
  const eccentricAnomaly = meanAnomaly + eccentricity * Math.sin(meanAnomaly) * (1 + eccentricity * Math.cos(meanAnomaly));
  const xv = Math.cos(eccentricAnomaly) - eccentricity;
  const yv = Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(eccentricAnomaly);
  const trueAnomaly = Math.atan2(yv, xv);
  const radius = Math.sqrt(xv * xv + yv * yv);
  const argument = trueAnomaly + periapsis;
  const xh = radius * (Math.cos(node) * Math.cos(argument) - Math.sin(node) * Math.sin(argument) * Math.cos(inclination));
  const yh = radius * (Math.sin(node) * Math.cos(argument) + Math.cos(node) * Math.sin(argument) * Math.cos(inclination));
  const zh = radius * (Math.sin(argument) * Math.sin(inclination));
  const obliquity = (23.4393 - 0.0000003563 * d) * DEG_TO_RAD;
  const xe = xh;
  const ye = yh * Math.cos(obliquity) - zh * Math.sin(obliquity);
  const ze = yh * Math.sin(obliquity) + zh * Math.cos(obliquity);
  return {
    ra: normalizeRadians(Math.atan2(ye, xe)),
    dec: Math.atan2(ze, Math.sqrt(xe * xe + ye * ye)),
  };
}

function normalizedOptions(next = {}) {
  return {
    ...DEFAULT_CELESTIAL_OPTIONS,
    ...next,
    showStars: next.showStars !== false,
    showSun: next.showSun !== false,
    showMoon: next.showMoon !== false,
    showLabels: next.showLabels === true,
    useCurrentTime: next.useCurrentTime !== false,
    useSunLight: next.useSunLight !== false,
  };
}

function resolveObservationTime(options) {
  if (options.useCurrentTime || !options.observationTime) return new Date();
  const date = options.observationTime instanceof Date ? options.observationTime : new Date(options.observationTime);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function makeBodyLabel(text, color = "#f8fafc") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 112;
  const ctx = canvas.getContext("2d");
  ctx.font = "34px system-ui, -apple-system, Segoe UI, sans-serif";
  const width = Math.min(492, Math.ceil(ctx.measureText(text).width + 36));
  ctx.fillStyle = "rgba(8,13,24,0.76)";
  ctx.strokeStyle = "rgba(226,232,240,0.45)";
  ctx.lineWidth = 2;
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(8, 18, width, 58, 12);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(8, 18, width, 58);
    ctx.strokeRect(8, 18, width, 58);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, 26, 57);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.7, 0.153, 1);
  sprite.userData.celestialLabel = true;
  return sprite;
}

function disposeObject(object) {
  object.traverse?.((node) => {
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) {
      node.material.forEach((material) => {
        material.map?.dispose?.();
        material.dispose?.();
      });
    } else {
      node.material?.map?.dispose?.();
      node.material?.dispose?.();
    }
  });
}

function starColor(star) {
  return new THREE.Color(star.color || "#f8fbff");
}

function createStarPoints(date) {
  const positions = new Float32Array(BRIGHT_STARS.length * 3);
  const colors = new Float32Array(BRIGHT_STARS.length * 3);
  BRIGHT_STARS.forEach((star, index) => {
    const position = directionFromRaDec(star.ra * 15 * DEG_TO_RAD, star.dec * DEG_TO_RAD, date, CELESTIAL_RADIUS);
    positions[index * 3] = position.x;
    positions[index * 3 + 1] = position.y;
    positions[index * 3 + 2] = position.z;
    const color = starColor(star);
    const brightness = clamp(1.25 - ((star.mag + 1.5) / 5), 0.38, 1);
    colors[index * 3] = color.r * brightness;
    colors[index * 3 + 1] = color.g * brightness;
    colors[index * 3 + 2] = color.b * brightness;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.06,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    depthTest: true,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "Celestial Bright Star Field";
  return points;
}

function updateStarPoints(points, date) {
  const positions = points.geometry.getAttribute("position");
  BRIGHT_STARS.forEach((star, index) => {
    const position = directionFromRaDec(star.ra * 15 * DEG_TO_RAD, star.dec * DEG_TO_RAD, date, CELESTIAL_RADIUS);
    positions.setXYZ(index, position.x, position.y, position.z);
  });
  positions.needsUpdate = true;
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    disposeObject(child);
  }
}

export function createCelestialBackdrop(scene, options = {}) {
  let state = normalizedOptions(options);
  let lastUpdateMs = 0;
  let lastDate = resolveObservationTime(state);

  const root = new THREE.Group();
  root.name = "KML Celestial Backdrop";
  scene.add(root);

  const bodyGroup = new THREE.Group();
  bodyGroup.name = "Celestial Bodies";
  root.add(bodyGroup);

  const starPoints = createStarPoints(lastDate);
  root.add(starPoints);

  const starLabelGroup = new THREE.Group();
  starLabelGroup.name = "Celestial Star Labels";
  root.add(starLabelGroup);

  const sunGroup = new THREE.Group();
  sunGroup.name = "Sun";
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 32, 24),
    new THREE.MeshBasicMaterial({ color: "#ffd35a", transparent: true, opacity: 0.98, depthTest: true }),
  );
  const sunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 32, 24),
    new THREE.MeshBasicMaterial({ color: "#ffb84d", transparent: true, opacity: 0.16, depthWrite: false, depthTest: true }),
  );
  const sunLabel = makeBodyLabel("Sun", "#ffdf7a");
  sunGroup.add(sunHalo, sunMesh, sunLabel);
  bodyGroup.add(sunGroup);

  const moonGroup = new THREE.Group();
  moonGroup.name = "Moon";
  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 32, 20),
    new THREE.MeshStandardMaterial({ color: "#d9dde3", roughness: 0.7, metalness: 0.0, emissive: "#151922", emissiveIntensity: 0.08 }),
  );
  const moonLabel = makeBodyLabel("Moon", "#e5e7eb");
  moonGroup.add(moonMesh, moonLabel);
  bodyGroup.add(moonGroup);

  const sunLight = new THREE.DirectionalLight("#fff3cf", 1.65);
  sunLight.name = "Celestial Sun Directional Light";
  scene.add(sunLight);

  function updateLabels(date) {
    clearGroup(starLabelGroup);
    if (!state.showLabels || !state.showStars) return;
    BRIGHT_STARS
      .filter((star) => star.mag <= STAR_LABEL_LIMIT)
      .forEach((star) => {
        const label = makeBodyLabel(star.name, "#dbeafe");
        label.scale.set(0.52, 0.114, 1);
        const position = directionFromRaDec(star.ra * 15 * DEG_TO_RAD, star.dec * DEG_TO_RAD, date, CELESTIAL_RADIUS * 0.985);
        label.position.copy(position);
        starLabelGroup.add(label);
      });
  }

  function update(nextOptions = null) {
    if (nextOptions) state = normalizedOptions({ ...state, ...nextOptions });
    const date = resolveObservationTime(state);
    lastDate = date;
    lastUpdateMs = Date.now();

    updateStarPoints(starPoints, date);
    const sunPositionData = sunRaDec(date);
    const moonPositionData = moonRaDec(date);
    const sunPosition = directionFromRaDec(sunPositionData.ra, sunPositionData.dec, date, CELESTIAL_RADIUS * 0.92);
    const moonPosition = directionFromRaDec(moonPositionData.ra, moonPositionData.dec, date, CELESTIAL_RADIUS * 0.86);

    sunGroup.position.copy(sunPosition);
    sunLabel.position.set(0.28, 0.22, 0);
    moonGroup.position.copy(moonPosition);
    moonLabel.position.set(0.2, 0.16, 0);

    sunLight.position.copy(sunPosition.clone().normalize().multiplyScalar(6));
    sunLight.visible = state.showSun && state.useSunLight;
    starPoints.visible = state.showStars;
    starLabelGroup.visible = state.showStars && state.showLabels;
    sunGroup.visible = state.showSun;
    moonGroup.visible = state.showMoon;
    sunLabel.visible = state.showLabels;
    moonLabel.visible = state.showLabels;
    root.visible = state.showStars || state.showSun || state.showMoon;
    updateLabels(date);
    return date;
  }

  update();

  return {
    object: root,
    sunLight,
    update,
    tick() {
      if (!state.useCurrentTime) return;
      if (Date.now() - lastUpdateMs >= SKY_REFRESH_MS) update();
    },
    setOptions(nextOptions = {}) {
      if (nextOptions.useCurrentTime === false && state.useCurrentTime !== false && !nextOptions.observationTime) {
        nextOptions = { ...nextOptions, observationTime: lastDate.toISOString() };
      }
      update(nextOptions);
      return this.getOptions();
    },
    getOptions() {
      return { ...state, observationTime: lastDate.toISOString() };
    },
    refreshNow() {
      update({ observationTime: new Date().toISOString() });
      return this.getOptions();
    },
    destroy() {
      scene.remove(root);
      scene.remove(sunLight);
      clearGroup(root);
      disposeObject(root);
      sunLight.dispose?.();
    },
  };
}
