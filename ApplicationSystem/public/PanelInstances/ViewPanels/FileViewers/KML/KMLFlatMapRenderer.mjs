import { formatCoordinates } from "./KMLParser.mjs";
import { createAviationBaseLayerManager, createStreetBaseLayer, KML_BASEMAP_TYPES } from "./KMLBaseLayerManager.mjs";

const LEAFLET_ASSETS = {
  css: "/leaflet/leaflet.css",
  js: "/leaflet/leaflet.js",
  drawCss: "/leaflet-draw/leaflet.draw.css",
  drawJs: "/leaflet-draw/leaflet.draw.js",
};

let leafletPromise = null;

function assetError(label, href) {
  return new Error(label + " failed to load from " + href);
}

function loadStyle(href, label = "Leaflet CSS") {
  const existing = Array.from(document.querySelectorAll("link")).find((node) => node.dataset.nvKmlAsset === href || node.getAttribute("href") === href);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.nvKmlAsset = href;
    link.onload = () => resolve(link);
    link.onerror = () => reject(assetError(label, href));
    document.head.appendChild(link);
  });
}

function restoreGlobalDefine(previousDefine, hadDefine) {
  if (hadDefine) {
    window.define = previousDefine;
    return;
  }
  try {
    delete window.define;
  } catch {
    window.define = undefined;
  }
}

function loadScript(href, label = "Leaflet", { suppressAMD = false } = {}) {
  const existing = Array.from(document.querySelectorAll("script")).find((node) => node.dataset.nvKmlAsset === href || node.getAttribute("src") === href);
  if (existing?.dataset.loaded === "true" && !suppressAMD) return Promise.resolve(existing);
  if (existing) existing.remove();

  return new Promise((resolve, reject) => {
    const previousDefine = window.define;
    const hadDefine = Object.prototype.hasOwnProperty.call(window, "define");
    const shouldSuppressAMD = suppressAMD && Boolean(window.define?.amd);
    if (shouldSuppressAMD) {
      try {
        delete window.define;
      } catch {
        window.define = undefined;
      }
      if (window.define?.amd) window.define = undefined;
    }

    const finish = (callback) => {
      if (shouldSuppressAMD) restoreGlobalDefine(previousDefine, hadDefine);
      callback();
    };

    const script = document.createElement("script");
    script.src = href;
    script.async = false;
    script.dataset.nvKmlAsset = href;
    script.onload = () => {
      script.dataset.loaded = "true";
      finish(() => resolve(script));
    };
    script.onerror = () => finish(() => reject(assetError(label, href)));
    document.head.appendChild(script);
  });
}

export async function ensureLeafletLoaded({ requireDraw = true } = {}) {
  if (window.L?.map && (!requireDraw || (window.L.Draw && window.L.Edit?.Poly))) return window.L;

  if (!leafletPromise) {
    leafletPromise = (async () => {
      await loadStyle(LEAFLET_ASSETS.css, "Leaflet CSS");
      if (!window.L?.map) await loadScript(LEAFLET_ASSETS.js, "Leaflet", { suppressAMD: true });
      if (!window.L?.map) {
        throw new Error("Leaflet loaded from " + LEAFLET_ASSETS.js + " but did not attach window.L.map. Check for AMD/global loader conflicts.");
      }

      if (requireDraw) {
        await loadStyle(LEAFLET_ASSETS.drawCss, "Leaflet.draw CSS");
        if (!window.L.Draw || !window.L.Edit?.Poly) await loadScript(LEAFLET_ASSETS.drawJs, "Leaflet.draw", { suppressAMD: true });
        if (!window.L.Draw) throw assetError("Leaflet.draw", LEAFLET_ASSETS.drawJs);
        if (!window.L.Edit?.Poly) throw new Error("Leaflet.draw loaded from " + LEAFLET_ASSETS.drawJs + ", but edit support is unavailable.");
      }

      return window.L;
    })();
  }


  try {
    const L = await leafletPromise;
    if (requireDraw && (!L.Draw || !L.Edit?.Poly)) {
      leafletPromise = null;
      return ensureLeafletLoaded({ requireDraw: true });
    }
    return L;
  } catch (err) {
    leafletPromise = null;
    throw err;
  }
}

export const ensureLeaflet = ensureLeafletLoaded;

function latLngsFromCoords(coords = []) {
  return coords
    .map((coord) => [Number(coord?.lat), Number(coord?.lon)])
    .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
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
    html: '<span style="width:' + size + 'px;height:' + size + 'px;background:' + color + ';border-color:' + (selected ? '#fff' : '#242424') + '"></span>',
    iconSize: [size + 6, size + 6],
    iconAnchor: [(size + 6) / 2, (size + 6) / 2],
  });
}

function userLocationIcon() {
  return window.L.divIcon({
    className: "nv-kml-user-location-icon",
    html: "<span></span>",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

export async function createKMLFlatMapRenderer(container, { onSelect, onGeometryChange, basemapType = KML_BASEMAP_TYPES.STREET, aviationChartPackPath = "", onBasemapStatus } = {}) {
  const L = await ensureLeafletLoaded({ requireDraw: true });
  if (!L?.map) throw new Error("Leaflet failed to initialize: window.L.map is unavailable.");
  container.innerHTML = "";

  const map = L.map(container, { zoomControl: true, preferCanvas: true }).setView([20, 0], 2);
  let baseLayerManager = null;
  if (basemapType === KML_BASEMAP_TYPES.AVIATION) {
    baseLayerManager = await createAviationBaseLayerManager(L, map, {
      chartPackPath: aviationChartPackPath,
      onStatus: onBasemapStatus,
    });
  } else {
    const streetLayer = createStreetBaseLayer(L).addTo(map);
    baseLayerManager = {
      destroy() {
        if (map.hasLayer(streetLayer)) map.removeLayer(streetLayer);
      },
    };
  }

  const group = L.featureGroup().addTo(map);
  if (group.bringToFront) group.bringToFront();
  const layersById = new Map();
  let selectedId = null;
  let editHandler = null;
  let userLocationMarker = null;
  let userLocationAccuracyCircle = null;

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
    if (group.bringToFront) group.bringToFront();
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

  function flyToLocation(location, options = {}) {
    const lat = Number(location?.lat);
    const lon = Number(location?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const requestedZoom = Number(options?.zoom);
    const targetZoom = Math.max(map.getZoom(), Number.isFinite(requestedZoom) ? requestedZoom : 13);
    map.invalidateSize({ pan: false });
    map.stop?.();
    map.flyTo([lat, lon], targetZoom, { duration: 0.45 });
    globalThis.setTimeout?.(() => {
      const center = map.getCenter();
      const latDelta = Math.abs(Number(center?.lat) - lat);
      const lonDelta = Math.abs(Number(center?.lng) - lon);
      if (latDelta > 0.0001 || lonDelta > 0.0001 || map.getZoom() < targetZoom - 0.1) {
        map.setView([lat, lon], targetZoom, { animate: false });
      }
    }, 560);
  }

  function flyToRecord(record) {
    map.invalidateSize({ pan: false });
    const layer = layersById.get(record?.id);
    if (layer?.getLatLng) {
      map.flyTo(layer.getLatLng(), Math.max(map.getZoom(), 13), { duration: 0.45 });
      return;
    }
    if (layer?.getBounds) {
      map.flyToBounds(layer.getBounds().pad(0.25), { maxZoom: 16, duration: 0.45 });
      return;
    }

    const latLngs = latLngsFromCoords(record?.geometry?.coordinates || []);
    if (!latLngs.length) return;
    if (latLngs.length === 1 || record?.geometry?.type === "Point") {
      map.flyTo(latLngs[0], Math.max(map.getZoom(), 13), { duration: 0.45 });
    } else {
      map.flyToBounds(L.latLngBounds(latLngs).pad(0.25), { maxZoom: 16, duration: 0.45 });
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

  function clearUserLocation() {
    if (userLocationMarker && map.hasLayer(userLocationMarker)) map.removeLayer(userLocationMarker);
    if (userLocationAccuracyCircle && map.hasLayer(userLocationAccuracyCircle)) map.removeLayer(userLocationAccuracyCircle);
    userLocationMarker = null;
    userLocationAccuracyCircle = null;
  }

  function setUserLocation(location) {
    const lat = Number(location?.lat);
    const lon = Number(location?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      clearUserLocation();
      return;
    }
    const latLng = [lat, lon];
    const accuracy = Number(location?.accuracy);
    if (!userLocationMarker) {
      userLocationMarker = L.marker(latLng, {
        icon: userLocationIcon(),
        interactive: false,
        keyboard: false,
        zIndexOffset: 10000,
      }).addTo(map);
    } else {
      userLocationMarker.setLatLng(latLng);
    }
    userLocationMarker.setZIndexOffset?.(10000);

    if (Number.isFinite(accuracy) && accuracy > 0) {
      if (!userLocationAccuracyCircle) {
        userLocationAccuracyCircle = L.circle(latLng, {
          radius: accuracy,
          color: "#0a84ff",
          weight: 1,
          fillColor: "#0a84ff",
          fillOpacity: 0.12,
          interactive: false,
        }).addTo(map);
      } else {
        userLocationAccuracyCircle.setLatLng(latLng);
        userLocationAccuracyCircle.setRadius(accuracy);
      }
      userLocationAccuracyCircle.bringToBack?.();
    } else if (userLocationAccuracyCircle) {
      map.removeLayer(userLocationAccuracyCircle);
      userLocationAccuracyCircle = null;
    }
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
    flyToLocation,
    setRecordVisible,
    editRecord,
    startAddPlacemark: (callback) => startDraw("marker", callback),
    startDrawPath: (callback) => startDraw("polyline", callback),
    startDrawPolygon: (callback) => startDraw("polygon", callback),
    setUserLocation,
    clearUserLocation,
    destroy() {
      clearUserLocation();
      disableEdit();
      baseLayerManager?.destroy?.();
      map.remove();
    },
  };
}

export function coordinatesFromLeafletLayer(layer) {
  if (!layer) return "";
  if (layer.getLatLng) {
    const latLng = layer.getLatLng();
    return formatCoordinates([{ lon: latLng.lng, lat: latLng.lat, alt: null }]);
  }
  if (layer.getLatLngs) return formatCoordinates(coordsFromLatLngs(layer.getLatLngs()));
  return "";
}
