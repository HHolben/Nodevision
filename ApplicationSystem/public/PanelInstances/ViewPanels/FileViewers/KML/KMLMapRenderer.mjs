import { formatCoordinates } from "./KMLParser.mjs";

let leafletPromise = null;

function loadStyle(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export async function ensureLeaflet() {
  if (window.L?.map && window.L?.Draw) return window.L;
  if (!leafletPromise) {
    leafletPromise = (async () => {
      loadStyle("/vendor/leaflet/leaflet.css");
      loadStyle("/vendor/leaflet-draw/leaflet.draw.css");
      if (!window.L?.map) await loadScript("/vendor/leaflet/leaflet.js");
      if (!window.L?.Draw) await loadScript("/vendor/leaflet-draw/leaflet.draw.js");
      return window.L;
    })();
  }
  return leafletPromise;
}

function latLngsFromCoords(coords = []) {
  return coords.map((coord) => [coord.lat, coord.lon]);
}

function coordsFromLatLngs(latLngs = []) {
  return latLngs
    .flat(Infinity)
    .filter((item) => item && Number.isFinite(item.lat) && Number.isFinite(item.lng))
    .map((latLng) => ({ lon: Number(latLng.lng), lat: Number(latLng.lat), alt: null }));
}

function markerIcon(color = "#d93b30", selected = false) {
  const size = selected ? 18 : 14;
  return window.L.divIcon({
    className: "nv-kml-marker-icon",
    html: `<span style="width:${size}px;height:${size}px;background:${color};border-color:${selected ? "#fff" : "#242424"}"></span>`,
    iconSize: [size + 6, size + 6],
    iconAnchor: [(size + 6) / 2, (size + 6) / 2],
  });
}

export async function createKMLMapRenderer(container, { onSelect, onGeometryChange } = {}) {
  const L = await ensureLeaflet();
  container.innerHTML = "";

  const map = L.map(container, { zoomControl: true, preferCanvas: true }).setView([20, 0], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  const group = L.featureGroup().addTo(map);
  const layersById = new Map();
  let selectedId = null;
  let editHandler = null;

  function defaultPathStyle(record, selected = false) {
    return {
      color: selected ? "#f7c948" : record.style?.stroke || "#2f6fed",
      weight: selected ? Math.max(4, (record.style?.weight || 3) + 2) : record.style?.weight || 3,
      fillColor: selected ? "#f7c948" : record.style?.fill || "rgba(47, 111, 237, 0.25)",
      fillOpacity: record.geometry?.type === "Polygon" ? (selected ? 0.38 : 0.24) : 0,
      opacity: 0.95,
    };
  }

  function layerForRecord(record) {
    const geometry = record.geometry;
    const coords = geometry?.coordinates || [];
    if (!geometry || !coords.length) return null;

    let layer = null;
    if (geometry.type === "Point") {
      const first = coords[0];
      layer = L.marker([first.lat, first.lon], {
        draggable: true,
        icon: markerIcon(record.style?.marker, record.id === selectedId),
        title: record.name,
      });
      layer.on("dragend", () => {
        const latLng = layer.getLatLng();
        onGeometryChange?.(record, [{ lon: latLng.lng, lat: latLng.lat, alt: coords[0]?.alt ?? null }]);
      });
    } else if (geometry.type === "LineString") {
      layer = L.polyline(latLngsFromCoords(coords), defaultPathStyle(record, record.id === selectedId));
    } else if (geometry.type === "Polygon") {
      layer = L.polygon(latLngsFromCoords(coords), defaultPathStyle(record, record.id === selectedId));
    }

    if (!layer) return null;
    layer.__kmlRecord = record;
    layer.on("click", () => onSelect?.(record));
    return layer;
  }

  function render(records = []) {
    disableEdit();
    group.clearLayers();
    layersById.clear();
    records.filter((record) => record.geometry && record.visible !== false).forEach((record) => {
      const layer = layerForRecord(record);
      if (!layer) return;
      layersById.set(record.id, layer);
      group.addLayer(layer);
    });
    setSelected(selectedId);
  }

  function setSelected(id) {
    selectedId = id;
    for (const [recordId, layer] of layersById.entries()) {
      const selected = recordId === selectedId;
      const record = layer.__kmlRecord;
      if (layer.setStyle && record) layer.setStyle(defaultPathStyle(record, selected));
      if (layer.setIcon && record) layer.setIcon(markerIcon(record.style?.marker, selected));
    }
  }

  function fitAll() {
    if (group.getLayers().length === 0) return;
    map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 16 });
  }

  function flyToRecord(record) {
    const layer = layersById.get(record?.id);
    if (!layer) return;
    if (layer.getLatLng) {
      map.flyTo(layer.getLatLng(), Math.max(map.getZoom(), 13), { duration: 0.45 });
    } else if (layer.getBounds) {
      map.flyToBounds(layer.getBounds().pad(0.25), { maxZoom: 16, duration: 0.45 });
    }
  }

  function setRecordVisible(record, visible) {
    record.visible = visible;
    const existing = layersById.get(record.id);
    if (!visible && existing) {
      group.removeLayer(existing);
      layersById.delete(record.id);
      return;
    }
    if (visible && !existing && record.geometry) {
      const layer = layerForRecord(record);
      if (layer) {
        layersById.set(record.id, layer);
        group.addLayer(layer);
      }
    }
    setSelected(selectedId);
  }

  function disableEdit() {
    if (editHandler?.disable) editHandler.disable();
    editHandler = null;
  }

  function editRecord(record) {
    disableEdit();
    const layer = layersById.get(record?.id);
    if (!layer) return false;
    if (layer.dragging?.enable) {
      layer.dragging.enable();
      return true;
    }
    if (window.L.Edit?.Poly && (record.geometry?.type === "LineString" || record.geometry?.type === "Polygon")) {
      editHandler = new window.L.Edit.Poly(layer);
      editHandler.enable();
      layer.on("mouseup", () => onGeometryChange?.(record, coordsFromLatLngs(layer.getLatLngs())));
      return true;
    }
    return false;
  }

  function startDraw(type, callback) {
    disableEdit();
    const drawOptions = type === "marker" ? {} : { shapeOptions: { color: "#2f6fed", weight: 3, fillOpacity: 0.24 } };
    const Tool = type === "marker" ? L.Draw.Marker : type === "polyline" ? L.Draw.Polyline : L.Draw.Polygon;
    const tool = new Tool(map, drawOptions);
    const done = (event) => {
      map.off(L.Draw.Event.CREATED, done);
      const layer = event.layer;
      let coords = [];
      if (type === "marker") {
        const latLng = layer.getLatLng();
        coords = [{ lon: latLng.lng, lat: latLng.lat, alt: null }];
      } else {
        coords = coordsFromLatLngs(layer.getLatLngs());
      }
      callback?.(coords);
    };
    map.on(L.Draw.Event.CREATED, done);
    tool.enable();
  }

  setTimeout(() => map.invalidateSize(), 0);

  return {
    map,
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
      disableEdit();
      map.remove();
    },
  };
}

export function coordinatesFromLayer(layer) {
  if (!layer) return "";
  if (layer.getLatLng) {
    const latLng = layer.getLatLng();
    return formatCoordinates([{ lon: latLng.lng, lat: latLng.lat, alt: null }]);
  }
  if (layer.getLatLngs) return formatCoordinates(coordsFromLatLngs(layer.getLatLngs()));
  return "";
}
