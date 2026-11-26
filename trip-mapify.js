import {
  ICONS,
  appStore,
  esc,
  getCategoryMeta,
  getStopMapUrl,
  getStopLocationLabel,
  showToast
} from './trip-planner.js';

import {
  formatDuration,
  formatDistance,
  getTripMapData,
  haversineMiles
} from './trip-timeline-engine.js';

/**
 * Callback Registry (Connected by main.js so Mapify popups can scroll/focus timeline cards)
 */
export const mapifyHooks = {
  focusTimelineEvent: () => {}
};

export function registerMapifyHooks(overrides = {}) {
  Object.assign(mapifyHooks, overrides);
}

/**
 * Map Tile Themes (100% Free, Zero-API-Key Esri Basemaps)
 * - Dark: Dark canvas + cute animated nearby places (restaurants, attractions, restrooms, gas, parking)
 * - Street: Unchanged Esri World Street Map
 * - Basemap: Clean, crisp, pastel Esri World Topographic Map + smart non-overlapping route pills & soft halos
 */
const MAP_TILE_THEMES = {
  dark: {
    label: 'Dark',
    layers: [
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        maxNativeZoom: 16,
        zIndex: 1
      },
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        maxNativeZoom: 16,
        zIndex: 2
      }
    ],
    attribution: 'Tiles &copy; Esri &middot; Places &copy; OpenStreetMap',
    maxZoom: 19
  },
  street: {
    label: 'Street',
    layers: [
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        maxNativeZoom: 18,
        zIndex: 1
      }
    ],
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19
  },
  basemap: {
    label: 'Basemap',
    layers: [
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        className: 'mapify-basemap-tiles',
        maxNativeZoom: 18,
        zIndex: 1
      }
    ],
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19
  }
};

const DAY_ROUTE_PALETTE = [
  { hex: '#fb923c', basemapHex: '#ea580c', rgb: '251, 146, 60', name: 'Sunset Orange' },
  { hex: '#38bdf8', basemapHex: '#0284c7', rgb: '56, 189, 248', name: 'Electric Sky' },
  { hex: '#34d399', basemapHex: '#059669', rgb: '52, 211, 153', name: 'Emerald Mint' },
  { hex: '#a78bfa', basemapHex: '#7c3aed', rgb: '167, 139, 250', name: 'Cosmic Violet' },
  { hex: '#f472b6', basemapHex: '#db2777', rgb: '244, 114, 182', name: 'Rose Quartz' },
  { hex: '#fbbf24', basemapHex: '#d97706', rgb: '251, 191, 36', name: 'Golden Amber' }
];

/**
 * Dark Mode Nearby Place Categories (Cute Custom SVGs, Colors & Animations)
 */
const DARK_POI_CATEGORIES = {
  restaurant: {
    key: 'restaurant',
    label: 'Food',
    fullLabel: 'Restaurant & Cafe',
    accent: '#fb923c',
    pillActive: 'bg-orange-500/25 border-orange-400/60 text-orange-100',
    pinClass: 'mapify-poi-pin--restaurant',
    maxItems: 10,
    photonQuery: 'restaurant',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`
  },
  attraction: {
    key: 'attraction',
    label: 'Sights',
    fullLabel: 'Attraction & Landmark',
    accent: '#e879f9',
    pillActive: 'bg-fuchsia-500/25 border-fuchsia-400/60 text-fuchsia-100',
    pinClass: 'mapify-poi-pin--attraction',
    maxItems: 10,
    photonQuery: 'park museum attraction',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/></svg>`
  },
  restroom: {
    key: 'restroom',
    label: 'Restroom',
    fullLabel: 'Public Restroom',
    accent: '#38bdf8',
    pillActive: 'bg-sky-500/25 border-sky-400/60 text-sky-100',
    pinClass: 'mapify-poi-pin--restroom',
    maxItems: 8,
    photonQuery: 'restroom',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><circle cx="8" cy="5.5" r="1.8"/><path d="M6 10h4l.8 5H9.5v5h-3v-5H5.2L6 10Z"/><circle cx="16.5" cy="5.5" r="1.8"/><path d="M14.3 10h4.4l1.3 5h-2v5h-3v-5h-2l1.3-5Z"/></svg>`
  },
  gas: {
    key: 'gas',
    label: 'Gas',
    fullLabel: 'Gas Station',
    accent: '#34d399',
    pillActive: 'bg-emerald-500/25 border-emerald-400/60 text-emerald-100',
    pinClass: 'mapify-poi-pin--gas',
    maxItems: 8,
    photonQuery: 'gas station',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M4 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14"/><path d="M2 20h14"/><path d="M6 8h6"/><path d="M14 12h2a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0V9.5L18.5 7"/></svg>`
  },
  parking: {
    key: 'parking',
    label: 'Parking',
    fullLabel: 'Parking Area',
    accent: '#818cf8',
    pillActive: 'bg-indigo-500/25 border-indigo-400/60 text-indigo-100',
    pinClass: 'mapify-poi-pin--parking',
    maxItems: 8,
    photonQuery: 'parking',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M9.5 16V8h3.2a2.4 2.4 0 0 1 0 4.8H9.5"/></svg>`
  }
};

/**
 * Active Public Overpass Mirrors (Private.coffee first — fast, no strict rate limits)
 */
const OVERPASS_ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];
const POI_CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Internal Mapify Controller State
 */
const mapState = {
  map: null,
  tileLayers: [],
  routeLayerGroup: null,
  markerLayerGroup: null,
  basemapHaloLayerGroup: null,
  basemapBadgeLayerGroup: null,
  poiLayerGroup: null,
  tourLayerGroup: null,
  resizeObserver: null,
  theme: 'dark',
  isCollapsed: false,
  isExpandedHeight: false,
  markersByEventId: new Map(),
  tourSequence: [],
  currentBoundsPoints: [],
  basemapLegCandidates: [],
  basemapStopCoords: [],
  lastFitSignature: '',
  lastTripStats: null,
  lastMapData: null,
  tourTimer: null,
  isTourPlaying: false,
  // Dark Mode Nearby POI Discovery State
  activePoiCategories: new Set(['restaurant', 'attraction', 'restroom', 'gas', 'parking']),
  poiCache: new Map(),
  currentPois: [],
  lastPoiSignature: '',
  poiLoading: false,
  poiRequestId: 0,
  poiNeedsAreaScan: false,
  ignoreNextMoveEnd: false
};

function stopRouteTour(updateBtn = true) {
  if (mapState.tourTimer) {
    clearInterval(mapState.tourTimer);
    mapState.tourTimer = null;
  }
  mapState.isTourPlaying = false;
  if (mapState.tourLayerGroup) {
    mapState.tourLayerGroup.clearLayers();
  }
  if (updateBtn) {
    const btn = document.getElementById('mapifyTourBtn');
    const lbl = document.getElementById('mapifyTourLabel');
    if (btn) {
      btn.classList.remove('from-emerald-500/80', 'to-sky-500/80', 'border-emerald-300/60');
    }
    if (lbl) lbl.textContent = 'Play Tour';
  }
}

/**
 * Sync Canvas Theme Classes, Legend Styling & Dark Nearby POI Bar Visibility
 */
function syncThemeChrome() {
  const canvasEl = document.getElementById('mapifyCanvas');
  const stageWrap = document.getElementById('mapifyStageWrap');
  const legendPill = document.getElementById('mapifyLegendPill');
  const poiDock = document.getElementById('mapifyPoiDock');

  const isBasemap = mapState.theme === 'basemap';
  const isDark = mapState.theme === 'dark';

  if (canvasEl) {
    canvasEl.classList.toggle('mapify-theme--basemap', isBasemap);
    canvasEl.classList.toggle('mapify-theme--dark', isDark);
  }
  if (stageWrap) {
    stageWrap.style.backgroundColor = isBasemap ? '#eaf2f8' : '#0b0e15';
  }

  if (legendPill) {
    if (isBasemap) {
      legendPill.className = 'pointer-events-none absolute top-3 left-3 z-[400] hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-xl border border-slate-900/12 text-[10px] font-semibold text-slate-700 shadow-md';
      legendPill.innerHTML = `
        <span class="inline-flex items-center gap-1.5"><span class="w-3 h-0.5 bg-sky-600 inline-block rounded-full"></span>Drive</span>
        <span class="inline-flex items-center gap-1.5"><span class="w-3 h-0.5 border-b-2 border-dotted border-emerald-600 inline-block"></span>Walk</span>
        <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>Fixed</span>
        <span class="pl-2 border-l border-slate-900/15 text-sky-600 font-bold">Clean Basemap</span>
      `;
    } else {
      legendPill.className = 'pointer-events-none absolute top-3 left-3 z-[400] hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-full bg-[#12151f]/85 backdrop-blur-xl border border-white/15 text-[10px] font-semibold text-white/80 shadow-lg';
      legendPill.innerHTML = `
        <span class="inline-flex items-center gap-1.5"><span class="w-3 h-0.5 bg-sky-400 inline-block"></span>Drive</span>
        <span class="inline-flex items-center gap-1.5"><span class="w-3 h-0.5 border-b-2 border-dotted border-emerald-400 inline-block"></span>Walk</span>
        <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>Fixed</span>
      `;
    }
  }

  if (poiDock) {
    const showDock = isDark && !mapState.isCollapsed && (mapState.lastMapData?.stops?.length || 0) > 0;
    poiDock.classList.toggle('hidden', !showDock);
  }
}

function setMapTileTheme(themeKey) {
  if (!MAP_TILE_THEMES[themeKey]) return;
  mapState.theme = themeKey;

  document.querySelectorAll('[data-mapify-theme]').forEach((btn) => {
    const active = btn.dataset.mapifyTheme === themeKey;
    btn.className = active
      ? 'px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/22 text-white shadow cursor-pointer transition-all'
      : 'px-2.5 py-1 rounded-full text-[11px] font-medium text-white/60 hover:text-white cursor-pointer transition-all';
  });

  syncThemeChrome();

  if (!mapState.map || !window.L) return;

  mapState.tileLayers.forEach((layer) => mapState.map.removeLayer(layer));
  mapState.tileLayers = [];

  const cfg = MAP_TILE_THEMES[themeKey];
  cfg.layers.forEach((layerCfg) => {
    const tileOpts = {
      attribution: cfg.attribution,
      maxNativeZoom: layerCfg.maxNativeZoom || 18,
      maxZoom: cfg.maxZoom || 19,
      zIndex: layerCfg.zIndex || 1
    };
    if (layerCfg.subdomains) tileOpts.subdomains = layerCfg.subdomains;
    if (layerCfg.className) tileOpts.className = layerCfg.className;

    const layer = window.L.tileLayer(layerCfg.url, tileOpts).addTo(mapState.map);
    mapState.tileLayers.push(layer);
  });

  // Re-draw vector overlays immediately so Basemap halos/pills or Dark POIs update right away
  if (mapState.lastMapData) {
    drawMapifyVectorLayers(mapState.lastMapData, false);
  }

  if (themeKey === 'dark') {
    syncDarkNearbyPois(false);
  } else {
    mapState.poiLayerGroup?.clearLayers();
    renderPoiFilterBar();
  }
}

export function invalidateMapifySize(refit = false) {
  if (!mapState.map || mapState.isCollapsed) return;
  mapState.map.invalidateSize({ animate: false });
  if (refit && mapState.currentBoundsPoints.length > 0) {
    fitMapToBounds(mapState.currentBoundsPoints, true);
  }
  if (mapState.theme === 'basemap') {
    renderBasemapLegBadges();
  }
}

function fitMapToBounds(points, force = false) {
  if (!mapState.map || !window.L || points.length === 0) return;

  const sig = points.map((p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join('|');
  if (!force && sig === mapState.lastFitSignature) return;
  mapState.lastFitSignature = sig;

  mapState.ignoreNextMoveEnd = true;

  if (points.length === 1) {
    mapState.map.setView(points[0], 13, { animate: true });
    return;
  }

  const bounds = window.L.latLngBounds(points);
  if (bounds.isValid()) {
    mapState.map.fitBounds(bounds, {
      paddingTopLeft: [36, 52],
      paddingBottomRight: [36, 62],
      maxZoom: 14,
      animate: true
    });
  }
}

/**
 * Group Co-Located Stops (e.g., Hotel Check-In at Stop 2 & Return to Hotel at Stop 6)
 */
function areCoordsCoLocated(a, b) {
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < 0.00025 && Math.abs(a.lng - b.lng) < 0.00025;
}

function groupCoLocatedStops(stops) {
  const groups = [];
  stops.forEach((stop) => {
    const existingGroup = groups.find((g) => areCoordsCoLocated(g.coords, stop.coords));
    if (existingGroup) {
      existingGroup.stops.push(stop);
    } else {
      groups.push({
        coords: stop.coords,
        stops: [stop]
      });
    }
  });
  return groups;
}

function formatGroupPinLabel(groupStops, showAllDays) {
  const tokens = groupStops.map((s) =>
    showAllDays ? `D${s.dayIndex + 1}·${s.stopIndex + 1}` : `${s.stopIndex + 1}`
  );
  if (tokens.length === 1) return tokens[0];
  if (tokens.length === 2) return `${tokens[0]} & ${tokens[1]}`;
  return `${tokens.slice(0, -1).join(', ')} & ${tokens[tokens.length - 1]}`;
}

/**
 * ============================================================================
 * DARK MODE: LIVE NEARBY PLACES ENGINE (Fast Overpass + Photon Backup Engine)
 * ============================================================================
 */

function classifyOverpassElement(el) {
  const tags = el?.tags || {};
  const amenity = String(tags.amenity || '').toLowerCase();
  const tourism = String(tags.tourism || '').toLowerCase();
  const leisure = String(tags.leisure || '').toLowerCase();

  let category = null;
  if (['restaurant', 'cafe', 'fast_food', 'bakery', 'ice_cream', 'food_court'].includes(amenity)) {
    category = 'restaurant';
  } else if (['attraction', 'museum', 'zoo', 'theme_park', 'viewpoint', 'gallery', 'artwork'].includes(tourism) || leisure === 'park') {
    category = 'attraction';
  } else if (amenity === 'toilets') {
    category = 'restroom';
  } else if (amenity === 'fuel') {
    category = 'gas';
  } else if (amenity === 'parking') {
    category = 'parking';
  }

  if (!category) return null;

  const lat = Number(el.lat ?? el.center?.lat);
  const lng = Number(el.lon ?? el.center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const rawName = String(tags.name || tags.brand || tags.operator || '').trim();
  const fallbackNames = {
    restaurant: 'Local Dining Spot',
    attraction: tourism ? `${tourism.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}` : 'Scenic Park & Sight',
    restroom: 'Public Restroom',
    gas: 'Gas Station',
    parking: tags.parking === 'multi-storey' ? 'Parking Structure' : 'Public Parking'
  };

  if ((category === 'restaurant' || category === 'attraction') && !rawName) return null;

  const cuisine = tags.cuisine
    ? String(tags.cuisine).split(';')[0].replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '';

  const addressParts = [
    [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    tags['addr:city']
  ].filter(Boolean);

  const detailTags = [];
  if (cuisine) detailTags.push(cuisine);
  if (tags.opening_hours) detailTags.push(String(tags.opening_hours).slice(0, 32));
  if (category === 'parking' && tags.fee) detailTags.push(tags.fee === 'no' ? 'Free Parking' : 'Paid Parking');
  if (category === 'restroom' && tags.wheelchair === 'yes') detailTags.push('Accessible');
  if (category === 'gas' && tags.brand && tags.brand !== rawName) detailTags.push(tags.brand);

  return {
    id: `${el.type || 'n'}-${el.id}`,
    category,
    name: rawName || fallbackNames[category],
    lat,
    lng,
    address: addressParts.join(', '),
    metaLine: detailTags.join(' · ')
  };
}

/**
 * Lightweight Overpass Queries (2 fast `nw` filters per center — 80% faster than `nwr`)
 */
function buildOverpassQueryForCenters(centers, radiusMeters = 1100) {
  const blocks = [];
  centers.forEach(({ lat, lng }) => {
    const c = `around:${radiusMeters},${lat.toFixed(4)},${lng.toFixed(4)}`;
    blocks.push(
      `nw["amenity"~"^(restaurant|cafe|fast_food|bakery|toilets|fuel|parking)$"](${c});`,
      `nw["tourism"~"^(attraction|museum|zoo|theme_park|viewpoint|gallery)$"](${c});`
    );
  });
  return `[out:json][timeout:10];(${blocks.join('')});out center 120;`;
}

function buildOverpassQueryForViewport(bounds) {
  const s = bounds.getSouth().toFixed(4);
  const w = bounds.getWest().toFixed(4);
  const n = bounds.getNorth().toFixed(4);
  const e = bounds.getEast().toFixed(4);
  const b = `${s},${w},${n},${e}`;
  return `[out:json][timeout:10];(
    nw["amenity"~"^(restaurant|cafe|fast_food|bakery|toilets|fuel|parking)$"](${b});
    nw["tourism"~"^(attraction|museum|zoo|theme_park|viewpoint|gallery)$"](${b});
  );out center 120;`;
}

async function fetchOverpassJson(query) {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      if (data && Array.isArray(data.elements)) return data.elements;
    } catch (err) {
      clearTimeout(timer);
    }
  }
  return null;
}

/**
 * Automatic Backup POI Discovery via Photon (Used if all Overpass servers are temporarily busy)
 */
async function fetchPhotonFallbackPois(anchorCenters) {
  const primary = anchorCenters[0];
  if (!primary) return [];

  const fetchOneCategory = async (cat) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);
    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(cat.photonQuery)}&lat=${primary.lat.toFixed(4)}&lon=${primary.lng.toFixed(4)}&limit=10`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return [];
      const data = await res.json();
      const features = Array.isArray(data?.features) ? data.features : [];
      const items = [];

      features.forEach((f, idx) => {
        const coords = f?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return;
        const lng = Number(coords[0]);
        const lat = Number(coords[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        // Keep only genuinely nearby matches (within 6 miles of an itinerary anchor)
        const nearest = Math.min(...anchorCenters.map((a) => haversineMiles({ lat, lng }, a)));
        if (!Number.isFinite(nearest) || nearest > 6) return;

        const p = f.properties || {};
        const name = String(p.name || '').trim();
        if (!name && (cat.key === 'restaurant' || cat.key === 'attraction')) return;

        const addr = [
          [p.housenumber, p.street].filter(Boolean).join(' '),
          p.city || p.town || p.locality
        ].filter(Boolean).join(', ');

        items.push({
          id: `ph-${cat.key}-${p.osm_id || idx}`,
          category: cat.key,
          name: name || cat.fullLabel,
          lat,
          lng,
          address: addr,
          metaLine: p.osm_value ? String(p.osm_value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : ''
        });
      });

      return items;
    } catch (err) {
      clearTimeout(timer);
      return [];
    }
  };

  const results = await Promise.all(Object.values(DARK_POI_CATEGORIES).map(fetchOneCategory));
  return results.flat();
}

/**
 * Deduplicate & Spatially Space Nearby POIs so Pins Stay Crisp, Cute & Uncluttered
 */
function curateNearbyPois(parsedItems, anchorCoordsList) {
  const buckets = {
    restaurant: [],
    attraction: [],
    restroom: [],
    gas: [],
    parking: []
  };

  parsedItems.forEach((poi) => {
    if (!poi || !buckets[poi.category]) return;
    let minMiles = Infinity;
    anchorCoordsList.forEach((anchor) => {
      const d = haversineMiles({ lat: poi.lat, lng: poi.lng }, anchor);
      if (d < minMiles) minMiles = d;
    });
    poi.distanceMiles = Number.isFinite(minMiles) ? Number(minMiles.toFixed(2)) : null;
    buckets[poi.category].push(poi);
  });

  const curated = [];

  Object.entries(DARK_POI_CATEGORIES).forEach(([catKey, catMeta]) => {
    const sorted = (buckets[catKey] || []).sort((a, b) => {
      const da = a.distanceMiles ?? 99;
      const db = b.distanceMiles ?? 99;
      return da - db;
    });

    const chosen = [];
    const seenNames = new Set();

    for (const item of sorted) {
      if (chosen.length >= catMeta.maxItems) break;

      const normName = item.name.toLowerCase();
      if (catKey === 'restaurant' || catKey === 'attraction') {
        if (seenNames.has(normName)) continue;
      }

      // Avoid stacking two POIs of the same type right on top of each other (~120m spacing)
      const tooCloseSameCat = chosen.some(
        (other) => Math.abs(other.lat - item.lat) < 0.0011 && Math.abs(other.lng - item.lng) < 0.0011
      );
      if (tooCloseSameCat) continue;

      // Avoid hiding right underneath an itinerary stop marker
      const overlapsStop = anchorCoordsList.some(
        (anchor) => Math.abs(anchor.lat - item.lat) < 0.00025 && Math.abs(anchor.lng - item.lng) < 0.00025
      );
      if (overlapsStop) continue;

      seenNames.add(normName);
      chosen.push(item);
    }

    curated.push(...chosen);
  });

  return curated;
}

function getPoiAnchorCenters(stops) {
  const unique = [];
  (stops || []).forEach((s) => {
    if (!s?.coords) return;
    const exists = unique.some(
      (u) => Math.abs(u.lat - s.coords.lat) < 0.015 && Math.abs(u.lng - s.coords.lng) < 0.015
    );
    if (!exists) unique.push(s.coords);
  });
  return unique.slice(0, 3);
}

function buildPoiPopupHtml(poi) {
  const meta = DARK_POI_CATEGORIES[poi.category] || DARK_POI_CATEGORIES.restaurant;
  const searchQuery = poi.address ? `${poi.name}, ${poi.address}` : `${poi.name} ${poi.lat.toFixed(5)},${poi.lng.toFixed(5)}`;
  const mapsUrl = getStopMapUrl(searchQuery);
  const distLabel = Number.isFinite(poi.distanceMiles)
    ? (poi.distanceMiles < 0.1 ? 'Steps away' : `${formatDistance(poi.distanceMiles)} from stop`)
    : 'Nearby';

  return `
    <div class="space-y-2 text-xs text-white min-w-[210px] max-w-[265px]">
      <div class="flex items-center justify-between gap-2">
        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${meta.pillActive}">
          <span>${meta.svg}</span>
          <span>${esc(meta.fullLabel)}</span>
        </span>
      </div>

      <div>
        <h4 class="text-sm font-bold text-white leading-snug">${esc(poi.name)}</h4>
        ${poi.metaLine ? `<div class="text-[11px] text-white/65 mt-0.5">${esc(poi.metaLine)}</div>` : ''}
      </div>

      ${poi.address ? `
        <div class="text-[11px] text-white/75 flex items-start gap-1.5">
          <span class="text-sky-300 shrink-0 mt-0.5">${ICONS.pin}</span>
          <span class="break-words">${esc(poi.address)}</span>
        </div>
      ` : ''}

      <div class="pt-1.5 border-t border-white/12 flex items-center justify-between gap-2">
        <span class="text-[10px] font-semibold text-white/60 tabular-nums">${esc(distLabel)}</span>
        <a
          href="${esc(mapsUrl)}"
          target="_blank"
          rel="noopener noreferrer"
          class="px-2.5 py-1 rounded-xl bg-white/12 hover:bg-sky-500/30 border border-white/15 text-white text-[10px] font-semibold transition-colors"
        >Open Maps ↗</a>
      </div>
    </div>
  `;
}

function renderPoiMarkers() {
  if (!mapState.poiLayerGroup || !window.L) return;
  mapState.poiLayerGroup.clearLayers();

  if (mapState.theme !== 'dark' || mapState.isCollapsed) return;

  const L = window.L;
  const visiblePois = mapState.currentPois.filter((p) => mapState.activePoiCategories.has(p.category));

  visiblePois.forEach((poi, idx) => {
    const meta = DARK_POI_CATEGORIES[poi.category];
    if (!meta) return;

    const popDelay = Math.min(idx * 24, 480);
    const ringDelay = (idx % 6) * 380;

    const icon = L.divIcon({
      className: 'mapify-poi-wrap',
      html: `
        <div class="mapify-poi-pin ${meta.pinClass}" style="--poi-delay: ${popDelay}ms; --poi-ring-delay: ${ringDelay}ms;" title="${esc(poi.name)} · ${esc(meta.fullLabel)}">
          <span class="mapify-poi-ring"></span>
          <span class="mapify-poi-glyph">${meta.svg}</span>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -16]
    });

    const marker = L.marker([poi.lat, poi.lng], {
      icon,
      zIndexOffset: -50
    }).addTo(mapState.poiLayerGroup);

    marker.bindPopup(buildPoiPopupHtml(poi), {
      className: 'mapify-glass-popup',
      maxWidth: 280
    });
  });
}

function renderPoiFilterBar() {
  const dock = document.getElementById('mapifyPoiDock');
  if (!dock) return;

  const hasStops = (mapState.lastMapData?.stops?.length || 0) > 0;
  if (mapState.theme !== 'dark' || mapState.isCollapsed || !hasStops) {
    dock.classList.add('hidden');
    return;
  }

  dock.classList.remove('hidden');

  const counts = { restaurant: 0, attraction: 0, restroom: 0, gas: 0, parking: 0 };
  mapState.currentPois.forEach((p) => {
    if (counts[p.category] !== undefined) counts[p.category]++;
  });

  const pillsHtml = Object.values(DARK_POI_CATEGORIES).map((cat) => {
    const isActive = mapState.activePoiCategories.has(cat.key);
    const count = counts[cat.key] || 0;
    return `
      <button
        type="button"
        data-poi-toggle="${cat.key}"
        title="Toggle nearby ${esc(cat.fullLabel)}"
        class="mapify-poi-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] sm:text-[11px] font-semibold cursor-pointer ${
          isActive
            ? cat.pillActive
            : 'bg-white/[0.04] border-white/10 text-white/40 hover:text-white/75'
        }"
      >
        <span class="shrink-0" style="color: ${isActive ? cat.accent : 'currentColor'};">${cat.svg}</span>
        <span>${esc(cat.label)}</span>
        <span class="text-[9px] opacity-80 tabular-nums">${count}</span>
      </button>
    `;
  }).join('');

  const scanHighlight = mapState.poiNeedsAreaScan && !mapState.poiLoading
    ? 'bg-sky-500/30 border-sky-300/60 text-white animate-pulse'
    : 'bg-white/10 hover:bg-white/20 border-white/15 text-white/85';

  dock.innerHTML = `
    <div class="mapify-poi-bar inline-flex flex-wrap items-center gap-1.5 px-2.5 py-2 rounded-2xl max-w-full">
      <span class="hidden md:inline-flex items-center gap-1.5 pr-1.5 mr-0.5 border-r border-white/12 text-[10px] font-bold uppercase tracking-wider text-white/65">
        <span class="w-1.5 h-1.5 rounded-full ${mapState.poiLoading ? 'bg-amber-300 animate-ping' : 'bg-emerald-400'}"></span>
        <span>${mapState.poiLoading ? 'Scanning…' : 'Nearby'}</span>
      </span>
      ${pillsHtml}
      <button
        type="button"
        id="mapifyPoiScanBtn"
        title="Scan visible map area for restaurants, sights, restrooms, gas & parking"
        class="mapify-poi-pill inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-semibold cursor-pointer ${scanHighlight}"
      >
        <span>${mapState.poiLoading ? 'Loading…' : mapState.poiNeedsAreaScan ? 'Scan Area' : 'Refresh'}</span>
      </button>
    </div>
  `;

  dock.querySelectorAll('[data-poi-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.dataset.poiToggle;
      if (mapState.activePoiCategories.has(key)) {
        mapState.activePoiCategories.delete(key);
      } else {
        mapState.activePoiCategories.add(key);
      }
      renderPoiFilterBar();
      renderPoiMarkers();
    });
  });

  document.getElementById('mapifyPoiScanBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    syncDarkNearbyPois(true, true);
  });
}

async function syncDarkNearbyPois(forceRefresh = false, useViewportBounds = false) {
  if (mapState.theme !== 'dark' || mapState.isCollapsed || !mapState.map) return;

  const stops = mapState.lastMapData?.stops || [];
  if (stops.length === 0) {
    mapState.currentPois = [];
    mapState.poiLayerGroup?.clearLayers();
    renderPoiFilterBar();
    return;
  }

  let query = '';
  let cacheKey = '';
  let anchorCenters = getPoiAnchorCenters(stops);

  if (useViewportBounds && mapState.map) {
    const bounds = mapState.map.getBounds();
    const latSpan = Math.abs(bounds.getNorth() - bounds.getSouth());
    const lngSpan = Math.abs(bounds.getEast() - bounds.getWest());
    const center = mapState.map.getCenter();

    if (latSpan <= 0.18 && lngSpan <= 0.22) {
      query = buildOverpassQueryForViewport(bounds);
      cacheKey = `vp:${bounds.getSouth().toFixed(2)},${bounds.getWest().toFixed(2)},${bounds.getNorth().toFixed(2)},${bounds.getEast().toFixed(2)}`;
      anchorCenters = [{ lat: center.lat, lng: center.lng }];
    } else {
      const centerList = [{ lat: center.lat, lng: center.lng }, ...anchorCenters.slice(0, 2)];
      query = buildOverpassQueryForCenters(centerList, 1300);
      cacheKey = `ct:${center.lat.toFixed(2)},${center.lng.toFixed(2)}`;
      anchorCenters = centerList;
    }
  } else {
    if (anchorCenters.length === 0) return;
    const radius = anchorCenters.length === 1 ? 1500 : 1100;
    query = buildOverpassQueryForCenters(anchorCenters, radius);
    cacheKey = `st:${anchorCenters.map((c) => `${c.lat.toFixed(2)},${c.lng.toFixed(2)}`).join('|')}`;
  }

  if (!forceRefresh && cacheKey === mapState.lastPoiSignature && mapState.currentPois.length > 0) {
    mapState.poiNeedsAreaScan = false;
    renderPoiFilterBar();
    renderPoiMarkers();
    return;
  }

  const cached = mapState.poiCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < POI_CACHE_TTL_MS) {
    mapState.lastPoiSignature = cacheKey;
    mapState.currentPois = cached.items;
    mapState.poiNeedsAreaScan = false;
    renderPoiFilterBar();
    renderPoiMarkers();
    return;
  }

  const reqId = ++mapState.poiRequestId;
  mapState.poiLoading = true;
  mapState.poiNeedsAreaScan = false;
  renderPoiFilterBar();

  // 1. Primary fast lookup via Overpass mirrors
  let parsedPois = null;
  const elements = await fetchOverpassJson(query);
  if (reqId !== mapState.poiRequestId) return;

  if (elements && elements.length > 0) {
    parsedPois = elements.map(classifyOverpassElement).filter(Boolean);
  }

  // 2. Automatic backup lookup via Photon if Overpass servers are busy or returned empty
  if (!parsedPois || parsedPois.length === 0) {
    const fallbackItems = await fetchPhotonFallbackPois(anchorCenters);
    if (reqId !== mapState.poiRequestId) return;
    if (fallbackItems.length > 0) {
      parsedPois = fallbackItems;
    }
  }

  mapState.poiLoading = false;

  if (parsedPois && parsedPois.length > 0) {
    const curated = curateNearbyPois(parsedPois, anchorCenters);
    mapState.poiCache.set(cacheKey, { items: curated, fetchedAt: Date.now() });
    mapState.lastPoiSignature = cacheKey;
    mapState.currentPois = curated;

    if (mapState.theme === 'dark') {
      renderPoiMarkers();
      if (forceRefresh) {
        showToast(`Found ${curated.length} nearby places in this area`);
      }
    }
  } else if (forceRefresh) {
    showToast('No nearby places found here — try zooming closer to a stop', 'error');
  }

  renderPoiFilterBar();
}

/**
 * Pixel-Aware Basemap Route Pills (Never Overlap Each Other or Stop Pins)
 */
function renderBasemapLegBadges() {
  if (!mapState.basemapBadgeLayerGroup || !mapState.map || !window.L) return;
  mapState.basemapBadgeLayerGroup.clearLayers();

  if (mapState.theme !== 'basemap' || mapState.isCollapsed) return;

  const L = window.L;
  const map = mapState.map;
  const stopScreenPts = (mapState.basemapStopCoords || []).map((c) =>
    map.latLngToContainerPoint([c.lat, c.lng])
  );
  const placedBadgePts = [];

  (mapState.basemapLegCandidates || []).forEach((item) => {
    const startPt = map.latLngToContainerPoint(item.startLatLng);
    const endPt = map.latLngToContainerPoint(item.endLatLng);

    // Hide pill on very short on-screen segments (automatically appears as you zoom in)
    if (startPt.distanceTo(endPt) < 88) return;

    const midPt = map.latLngToContainerPoint(item.midLatLng);

    // Keep clear of all numbered stop pins
    const hitsStop = stopScreenPts.some(
      (sp) => Math.abs(sp.x - midPt.x) < 76 && Math.abs(sp.y - midPt.y) < 34
    );
    if (hitsStop) return;

    // Keep clear of previously placed route pills
    const hitsBadge = placedBadgePts.some(
      (bp) => Math.abs(bp.x - midPt.x) < 134 && Math.abs(bp.y - midPt.y) < 32
    );
    if (hitsBadge) return;

    placedBadgePts.push(midPt);

    const badgeIcon = L.divIcon({
      className: 'mapify-basemap-leg-wrap',
      html: `
        <div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">
          <div class="mapify-basemap-leg-pill ${item.pillTone}">
            <span style="display:inline-flex;opacity:0.85;">${item.modeGlyph}</span>
            <span>${esc(item.durationText)}</span>
            <span style="opacity:0.4;">·</span>
            <span>${esc(item.distanceText)}</span>
          </div>
        </div>
      `,
      iconSize: [126, 26],
      iconAnchor: [63, 13]
    });

    const badgeMarker = L.marker(item.midLatLng, { icon: badgeIcon, zIndexOffset: 20 })
      .addTo(mapState.basemapBadgeLayerGroup);
    badgeMarker.bindPopup(item.popupHtml, { className: 'mapify-glass-popup', maxWidth: 270 });
  });
}

/**
 * Initialize Leaflet Instance Once Inside #mapifyCanvas
 */
function ensureLeafletInitialized() {
  const canvasEl = document.getElementById('mapifyCanvas');
  const stageWrap = document.getElementById('mapifyStageWrap');
  if (!canvasEl) return false;

  if (!window.L) {
    canvasEl.innerHTML = `
      <div class="h-full w-full flex flex-col items-center justify-center p-6 text-center text-xs text-white/60 bg-black/40">
        <span class="text-sky-300 mb-2">${ICONS.globe}</span>
        <p>Interactive map tiles are loading — check your connection and refresh if needed.</p>
      </div>
    `;
    return false;
  }

  if (mapState.map) return true;

  const L = window.L;
  const map = L.map(canvasEl, {
    center: [33.95, -117.2],
    zoom: 9,
    zoomControl: false,
    scrollWheelZoom: false,
    attributionControl: true
  });

  L.control.zoom({ position: 'topright' }).addTo(map);

  canvasEl.addEventListener('click', () => map.scrollWheelZoom.enable());
  canvasEl.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());

  mapState.map = map;
  mapState.basemapHaloLayerGroup = L.layerGroup().addTo(map);
  mapState.routeLayerGroup = L.layerGroup().addTo(map);
  mapState.basemapBadgeLayerGroup = L.layerGroup().addTo(map);
  mapState.poiLayerGroup = L.layerGroup().addTo(map);
  mapState.markerLayerGroup = L.layerGroup().addTo(map);
  mapState.tourLayerGroup = L.layerGroup().addTo(map);

  map.on('zoomend', () => {
    if (mapState.theme === 'basemap') {
      renderBasemapLegBadges();
    }
  });

  map.on('moveend', () => {
    if (mapState.theme === 'basemap') {
      renderBasemapLegBadges();
    }
    if (mapState.ignoreNextMoveEnd) {
      mapState.ignoreNextMoveEnd = false;
      return;
    }
    if (mapState.theme === 'dark' && !mapState.poiLoading && !mapState.isTourPlaying) {
      mapState.poiNeedsAreaScan = true;
      renderPoiFilterBar();
    }
  });

  setMapTileTheme(mapState.theme);

  if (typeof ResizeObserver !== 'undefined' && stageWrap && !mapState.resizeObserver) {
    mapState.resizeObserver = new ResizeObserver(() => {
      invalidateMapifySize(false);
    });
    mapState.resizeObserver.observe(stageWrap);
  }

  setTimeout(() => invalidateMapifySize(true), 180);
  setTimeout(() => invalidateMapifySize(true), 750);

  return true;
}

/**
 * Build Static Mapify Card Shell Once (Preserves Map Zoom/Pan Across Re-renders)
 */
function ensureMapifyShell() {
  const bar = document.getElementById('tripTravelSummaryBar');
  if (!bar) return false;
  if (bar.querySelector('#mapifyRoot')) return true;

  bar.className = 'rounded-3xl bg-[#16171d]/75 backdrop-blur-2xl border border-white/15 shadow-2xl shadow-black/45 overflow-hidden transition-all duration-300';

  bar.innerHTML = `
    <div id="mapifyRoot" class="relative">
      <!-- 1. Floating Glass Top Header -->
      <div class="px-4 sm:px-6 py-3.5 bg-white/[0.04] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2.5 min-w-0">
          <div class="inline-flex items-center gap-2">
            <span class="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500/30 to-sky-500/30 border border-white/20 flex items-center justify-center text-sky-200 shadow-md">
              ${ICONS.globe}
            </span>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-sm sm:text-base font-bold tracking-tight text-white">Mapify</h3>
                <span class="relative flex h-2 w-2">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
              </div>
              <p id="mapifySubtitle" class="text-[11px] text-white/55 truncate">Two-way synced route &amp; timeline intelligence</p>
            </div>
          </div>

          <span id="mapifyScopePill" class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/15 border border-sky-400/30 text-sky-200">
            Focused Day
          </span>
        </div>

        <!-- Mapify Interactive Toolbar -->
        <div class="flex flex-wrap items-center gap-1.5">
          <div class="inline-flex items-center p-0.5 rounded-full bg-black/40 border border-white/12">
            <button type="button" data-mapify-theme="dark" title="Dark map with animated nearby restaurants, attractions, restrooms, gas & parking" class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/22 text-white shadow cursor-pointer">Dark</button>
            <button type="button" data-mapify-theme="street" title="Classic street map" class="px-2.5 py-1 rounded-full text-[11px] font-medium text-white/60 hover:text-white cursor-pointer">Street</button>
            <button type="button" data-mapify-theme="basemap" title="Clean pastel topographic basemap with floating route pills" class="px-2.5 py-1 rounded-full text-[11px] font-medium text-white/60 hover:text-white cursor-pointer">Basemap</button>
          </div>

          <button
            id="mapifyTourBtn"
            type="button"
            title="Animate traveler route along the roads"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-orange-500/25 to-sky-500/25 hover:from-orange-500/45 hover:to-sky-500/45 border border-white/20 text-white transition-all cursor-pointer"
          >
            <span class="text-orange-300">${ICONS.route}</span>
            <span id="mapifyTourLabel">Play Tour</span>
          </button>

          <button
            id="mapifyFitBtn"
            type="button"
            title="Center & fit all route pins"
            class="px-2.5 py-1.5 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 border border-white/15 text-white/90 transition-all cursor-pointer"
          >Fit</button>

          <button
            id="mapifyExpandBtn"
            type="button"
            title="Expand or compact map height"
            class="hidden sm:inline-flex px-2.5 py-1.5 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 border border-white/15 text-white/90 transition-all cursor-pointer"
          >Expand</button>

          <button
            id="mapifyCollapseBtn"
            type="button"
            title="Hide or show interactive map"
            class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 border border-white/15 text-white/90 transition-all cursor-pointer"
          >
            <span id="mapifyCollapseLabel">Hide Map</span>
          </button>
        </div>
      </div>

      <!-- 2. Interactive Map Viewport Stage -->
      <div id="mapifyStageWrap" style="height: 360px;" class="relative w-full bg-[#0b0e15] transition-all duration-300">
        <div id="mapifyCanvas" style="width: 100%; height: 100%;" class="z-0"></div>

        <!-- Subtle Top-Left Legend Overlay -->
        <div id="mapifyLegendPill" class="pointer-events-none absolute top-3 left-3 z-[400] hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-full bg-[#12151f]/85 backdrop-blur-xl border border-white/15 text-[10px] font-semibold text-white/80 shadow-lg">
          <span class="inline-flex items-center gap-1.5"><span class="w-3 h-0.5 bg-sky-400 inline-block"></span>Drive</span>
          <span class="inline-flex items-center gap-1.5"><span class="w-3 h-0.5 border-b-2 border-dotted border-emerald-400 inline-block"></span>Walk</span>
          <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>Fixed</span>
        </div>

        <!-- Dark Mode Floating Nearby Places Filter Dock -->
        <div id="mapifyPoiDock" class="hidden absolute bottom-3 left-3 right-3 sm:right-auto z-[410] flex items-center pointer-events-auto"></div>

        <!-- Empty State Overlay -->
        <div id="mapifyEmptyOverlay" class="hidden pointer-events-none absolute inset-0 z-[400] flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs">
          <div class="rounded-2xl bg-[#161923]/90 border border-white/15 px-5 py-4 max-w-sm text-center shadow-2xl">
            <div class="text-xs font-bold uppercase tracking-widest text-sky-300">No Pinned Locations Yet</div>
            <p class="text-xs text-white/70 mt-1 leading-relaxed">Add an address or destination to any stop in your timeline below to plot routes and pins live on Mapify.</p>
          </div>
        </div>
      </div>

      <!-- 3. Bottom 4-Graphic Spatial Command HUD -->
      <div class="p-3.5 sm:p-4 bg-gradient-to-b from-[#131620]/95 to-[#0e1118]/98 border-t border-white/12">
        <div id="mapifyHudGrid" class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3"></div>
      </div>
    </div>
  `;

  bar.querySelectorAll('[data-mapify-theme]').forEach((btn) => {
    btn.addEventListener('click', () => setMapTileTheme(btn.dataset.mapifyTheme));
  });

  document.getElementById('mapifyFitBtn')?.addEventListener('click', () => {
    if (mapState.currentBoundsPoints.length > 0) {
      invalidateMapifySize(false);
      fitMapToBounds(mapState.currentBoundsPoints, true);
      showToast('Centered Mapify on route');
    } else {
      showToast('Add a stop location first to fit route', 'error');
    }
  });

  document.getElementById('mapifyExpandBtn')?.addEventListener('click', () => {
    const wrap = document.getElementById('mapifyStageWrap');
    const btn = document.getElementById('mapifyExpandBtn');
    if (!wrap || !btn) return;
    mapState.isExpandedHeight = !mapState.isExpandedHeight;
    wrap.style.height = mapState.isExpandedHeight ? '520px' : '360px';
    btn.textContent = mapState.isExpandedHeight ? 'Compact' : 'Expand';
    setTimeout(() => invalidateMapifySize(true), 120);
  });

  document.getElementById('mapifyCollapseBtn')?.addEventListener('click', () => {
    const wrap = document.getElementById('mapifyStageWrap');
    const lbl = document.getElementById('mapifyCollapseLabel');
    if (!wrap || !lbl) return;
    mapState.isCollapsed = !mapState.isCollapsed;
    if (mapState.isCollapsed) {
      stopRouteTour();
      wrap.classList.add('hidden');
      lbl.textContent = 'Show Map';
    } else {
      wrap.classList.remove('hidden');
      lbl.textContent = 'Hide Map';
      setTimeout(() => {
        invalidateMapifySize(true);
        if (mapState.theme === 'dark') syncDarkNearbyPois(false);
      }, 120);
    }
    syncThemeChrome();
  });

  document.getElementById('mapifyTourBtn')?.addEventListener('click', () => {
    if (mapState.isTourPlaying) {
      stopRouteTour();
      return;
    }
    startAnimatedRouteTour();
  });

  return true;
}

/**
 * Animated Traveler Beacon Tour Along Chronological Stops (Visits Repeat Stops Twice in Order)
 */
function startAnimatedRouteTour() {
  if (!mapState.map || !window.L) return;
  if (mapState.isCollapsed) {
    document.getElementById('mapifyCollapseBtn')?.click();
  }

  const sequence = mapState.tourSequence || [];
  if (sequence.length < 2) {
    showToast('Need at least 2 pinned stops to play route tour', 'error');
    return;
  }

  stopRouteTour(false);
  mapState.isTourPlaying = true;

  const btn = document.getElementById('mapifyTourBtn');
  const lbl = document.getElementById('mapifyTourLabel');
  if (btn) btn.classList.add('from-emerald-500/80', 'to-sky-500/80', 'border-emerald-300/60');
  if (lbl) lbl.textContent = 'Stop Tour';

  const L = window.L;
  let stepIdx = 0;

  const advanceStop = () => {
    if (!mapState.isTourPlaying) return;
    if (stepIdx >= sequence.length) {
      stopRouteTour();
      fitMapToBounds(mapState.currentBoundsPoints, true);
      showToast('Route tour complete!');
      return;
    }

    const { stop, marker } = sequence[stepIdx];
    const latlng = marker.getLatLng();

    mapState.tourLayerGroup.clearLayers();
    const pulseIcon = L.divIcon({
      className: 'mapify-tour-beacon-wrap',
      html: `<div class="mapify-tour-beacon"></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    L.marker(latlng, { icon: pulseIcon, interactive: false }).addTo(mapState.tourLayerGroup);

    mapState.ignoreNextMoveEnd = true;
    mapState.map.flyTo(latlng, 13, { duration: 0.9 });
    setTimeout(() => {
      if (!mapState.isTourPlaying) return;
      marker.openPopup();
      const popupEl = marker.getPopup()?.getElement();
      if (popupEl) {
        popupEl.querySelectorAll('[data-visit-card-id]').forEach((card) => {
          const isCurrent = card.dataset.visitCardId === stop.event.id;
          card.classList.toggle('ring-2', isCurrent);
          card.classList.toggle('ring-orange-400', isCurrent);
        });
      }
    }, 650);

    stepIdx++;
  };

  advanceStop();
  mapState.tourTimer = setInterval(advanceStop, 2800);
}

/**
 * Render the 4-Graphic Spatial Command HUD Docked at Bottom of Mapify
 */
function renderMapifyBottomHud(tripStats, mapData) {
  const hud = document.getElementById('mapifyHudGrid');
  if (!hud) return;

  const totalDist = tripStats.totalDistanceMiles || 0;
  const totalMins = tripStats.totalTravelMinutes || 0;
  const dayCount = Math.max(1, appStore.state.days?.length || 1);
  const avgDailyMins = Math.round(totalMins / dayCount);

  let driveMiles = 0;
  let walkMiles = 0;
  let legCount = 0;
  (mapData.allLegs || []).forEach((l) => {
    if (Number.isFinite(l.distanceMiles) && l.distanceMiles > 0) {
      legCount++;
      if (l.mode === 'walking') walkMiles += l.distanceMiles;
      else driveMiles += l.distanceMiles;
    }
  });
  const totalSplit = Math.max(0.1, driveMiles + walkMiles);
  const drivePct = Math.round((driveMiles / totalSplit) * 100);
  const walkPct = totalDist > 0 ? Math.max(0, 100 - drivePct) : 0;

  const pctDone = tripStats.totalEvents > 0
    ? Math.round((tripStats.completedCount / tripStats.totalEvents) * 100)
    : 0;
  const remainingStops = Math.max(0, tripStats.totalEvents - tripStats.completedCount);
  const circumference = 87.96;
  const dashOffset = circumference - (pctDone / 100) * circumference;

  const hasWarnings = tripStats.warningCount > 0;

  hud.innerHTML = `
    <!-- Graphic 1: Total Distance & Drive/Walk Split -->
    <div class="group/hud rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-sky-400/35 p-3 transition-all duration-300">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[10px] font-bold uppercase tracking-wider text-sky-300">Total Distance</span>
        <span class="w-6 h-6 rounded-lg bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-300">
          ${ICONS.route}
        </span>
      </div>
      <div class="text-lg sm:text-xl font-bold text-white tracking-tight tabular-nums mt-1">
        ${esc(formatDistance(totalDist))}
      </div>
      <div class="mt-2 space-y-1">
        <div class="h-1.5 w-full rounded-full bg-black/50 overflow-hidden flex">
          <div class="h-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-500" style="width: ${totalDist > 0 ? drivePct : 0}%;"></div>
          <div class="h-full bg-emerald-400 transition-all duration-500" style="width: ${totalDist > 0 ? walkPct : 0}%;"></div>
        </div>
        <div class="flex items-center justify-between text-[10px] text-white/55 tabular-nums">
          <span>${legCount} route leg${legCount === 1 ? '' : 's'}</span>
          <span>${walkMiles > 0 ? `${formatDistance(walkMiles)} walk` : 'All driving'}</span>
        </div>
      </div>
    </div>

    <!-- Graphic 2: Total Transit Time & Daily Cadence -->
    <div class="group/hud rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-orange-400/35 p-3 transition-all duration-300">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[10px] font-bold uppercase tracking-wider text-orange-300">Transit Time</span>
        <span class="w-6 h-6 rounded-lg bg-orange-500/15 border border-orange-400/30 flex items-center justify-center text-orange-300">
          ${ICONS.clock}
        </span>
      </div>
      <div class="flex items-baseline gap-2 mt-1">
        <span class="text-lg sm:text-xl font-bold text-white tracking-tight tabular-nums">${esc(formatDuration(totalMins))}</span>
        ${tripStats.pendingCount > 0 ? `<span class="text-[10px] font-semibold text-sky-300 animate-pulse">syncing…</span>` : ''}
      </div>
      <div class="mt-2 space-y-1">
        <div class="flex items-end gap-1 h-1.5">
          <span class="flex-1 h-full rounded-full bg-orange-400/75"></span>
          <span class="flex-1 h-full rounded-full bg-amber-300/75"></span>
          <span class="flex-1 h-full rounded-full bg-sky-400/75"></span>
          <span class="flex-1 h-full rounded-full bg-white/15"></span>
        </div>
        <div class="flex items-center justify-between text-[10px] text-white/55 tabular-nums">
          <span>Avg ${esc(formatDuration(avgDailyMins))}/day</span>
          <span>${mapData.pinnedCount} pinned</span>
        </div>
      </div>
    </div>

    <!-- Graphic 3: Itinerary Progress Ring -->
    <div class="group/hud rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-emerald-400/35 p-3 flex items-center justify-between gap-2.5 transition-all duration-300">
      <div class="min-w-0">
        <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">Progress</span>
        <div class="text-lg sm:text-xl font-bold text-white tracking-tight tabular-nums mt-1">
          ${tripStats.completedCount}/${tripStats.totalEvents} <span class="text-xs font-medium text-white/60">Done</span>
        </div>
        <div class="text-[10px] text-white/55 mt-1 truncate">
          ${remainingStops === 0 && tripStats.totalEvents > 0 ? 'All stops completed!' : `${remainingStops} stop${remainingStops === 1 ? '' : 's'} remaining`}
        </div>
      </div>

      <div class="relative w-10 h-10 shrink-0">
        <svg class="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="3.2" />
          <circle cx="18" cy="18" r="14" fill="none" stroke="#34d399" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}" class="transition-all duration-500 ease-out" />
        </svg>
        <span class="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white tabular-nums">${pctDone}%</span>
      </div>
    </div>

    <!-- Graphic 4: Schedule Health & Timing Buffers -->
    <div class="group/hud rounded-2xl border p-3 transition-all duration-300 ${
      hasWarnings
        ? 'bg-rose-500/12 border-rose-400/45 warning-pulse'
        : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 hover:border-emerald-400/35'
    }">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[10px] font-bold uppercase tracking-wider ${hasWarnings ? 'text-rose-300' : 'text-emerald-300'}">
          Schedule Health
        </span>
        <span class="w-6 h-6 rounded-lg border flex items-center justify-center ${
          hasWarnings
            ? 'bg-rose-500/20 border-rose-400/40 text-rose-200'
            : 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
        }">
          ${hasWarnings ? ICONS.alert : ICONS.check}
        </span>
      </div>
      <div class="text-base sm:text-lg font-bold tracking-tight mt-1 truncate ${hasWarnings ? 'text-rose-100' : 'text-white'}">
        ${hasWarnings ? `${tripStats.warningCount} Tight Slot${tripStats.warningCount === 1 ? '' : 's'}` : 'On Schedule'}
      </div>
      <div class="mt-2 space-y-1">
        <div class="h-1.5 w-full rounded-full bg-black/50 overflow-hidden">
          <div class="h-full rounded-full transition-all duration-500 ${
            hasWarnings ? 'bg-gradient-to-r from-rose-500 to-amber-400 w-3/4' : 'bg-gradient-to-r from-emerald-400 to-sky-400 w-full'
          }"></div>
        </div>
        <div class="text-[10px] truncate ${hasWarnings ? 'text-rose-200/85' : 'text-white/55'}">
          ${hasWarnings ? 'Use Auto-Fit in day card to space' : 'All buffers & reservations fit'}
        </div>
      </div>
    </div>
  `;
}

/**
 * Build Single-Stop OR Combined Multi-Visit Glass Popup HTML
 */
function buildPinPopupHtml(groupStops, combinedLabel) {
  const first = groupStops[0];
  const primaryLocation = groupStops.find((s) => !s.isInheritedLoc)?.displayLocation || first.displayLocation;
  const anyInherited = groupStops.every((s) => s.isInheritedLoc);
  const mapUrl = getStopMapUrl(primaryLocation);

  // Single visit at this address
  if (groupStops.length === 1) {
    const { event: ev, day, stopIndex, incomingLeg } = first;
    const cat = getCategoryMeta(ev.category);
    const transitLineHtml = incomingLeg && incomingLeg.mode !== 'same' && Number.isFinite(incomingLeg.durationMinutes)
      ? `
        <div class="rounded-xl bg-sky-500/15 border border-sky-400/30 px-2.5 py-1.5 text-[11px] font-semibold text-sky-200 flex items-center justify-between gap-2">
          <span>Arriving Transit:</span>
          <span class="tabular-nums text-white">${esc(formatDistance(incomingLeg.distanceMiles))} · ${esc(formatDuration(incomingLeg.durationMinutes))} ${incomingLeg.mode === 'walking' ? 'walk' : 'drive'}</span>
        </div>
      `
      : '';

    return `
      <div class="space-y-2.5 text-xs text-white min-w-[230px] max-w-[280px]">
        <div class="flex flex-wrap items-center justify-between gap-1.5">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/12 text-sky-200">
            ${esc(day.shortDay)} · Stop ${stopIndex + 1}
          </span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/20 text-orange-200 tabular-nums">
            ${esc(ev.time)}${Number(ev.durationMinutes) > 0 ? ` (${esc(formatDuration(ev.durationMinutes))})` : ''}
          </span>
        </div>

        <div>
          <div class="text-[10px] font-bold uppercase tracking-wider text-white/50">${esc(cat.label)}${ev.isFixed ? ' · Fixed Time' : ''}</div>
          <p class="text-xs sm:text-sm font-semibold text-white leading-snug mt-0.5">${esc(ev.text)}</p>
        </div>

        <div class="text-[11px] text-white/75 flex items-start gap-1.5">
          <span class="text-sky-300 shrink-0 mt-0.5">${ICONS.pin}</span>
          <span class="break-words">${anyInherited ? `<strong class="text-orange-200">From prev day:</strong> ` : ''}${esc(getStopLocationLabel(primaryLocation))}</span>
        </div>

        ${transitLineHtml}

        <div class="pt-1.5 border-t border-white/12 flex items-center gap-2">
          <button
            type="button"
            data-mapify-jump-day="${esc(day.id)}"
            data-mapify-jump-event="${esc(ev.id)}"
            class="flex-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-sky-500 hover:from-orange-400 hover:to-sky-400 text-white text-[11px] font-semibold text-center cursor-pointer transition-all"
          >Jump to Stop</button>
          ${mapUrl ? `
            <a
              href="${esc(mapUrl)}"
              target="_blank"
              rel="noopener noreferrer"
              class="px-2.5 py-1.5 rounded-xl bg-white/12 hover:bg-white/22 border border-white/15 text-white text-[11px] font-semibold text-center"
            >Maps ↗</a>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Multiple visits at the same address (e.g., Stops 2 & 6)
  const visitsHtml = groupStops.map((s) => {
    const { event: ev, day, stopIndex, incomingLeg } = s;
    const cat = getCategoryMeta(ev.category);
    const transitHtml = incomingLeg && incomingLeg.mode !== 'same' && Number.isFinite(incomingLeg.durationMinutes)
      ? `<div class="text-[10px] font-medium text-sky-300/90 tabular-nums">↳ Arriving: ${esc(formatDistance(incomingLeg.distanceMiles))} · ${esc(formatDuration(incomingLeg.durationMinutes))} ${incomingLeg.mode === 'walking' ? 'walk' : 'drive'}</div>`
      : '';

    return `
      <div data-visit-card-id="${esc(ev.id)}" class="rounded-xl bg-white/[0.05] border border-white/10 p-2.5 space-y-1.5 transition-all">
        <div class="flex flex-wrap items-center justify-between gap-1">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-200">
            ${esc(day.shortDay)} · Stop ${stopIndex + 1}
          </span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/20 text-orange-200 tabular-nums">
            ${esc(ev.time)}${Number(ev.durationMinutes) > 0 ? ` (${esc(formatDuration(ev.durationMinutes))})` : ''}
          </span>
        </div>
        <div class="text-[10px] font-bold uppercase tracking-wider text-white/45">
          ${esc(cat.label)}${ev.isFixed ? ' · Fixed Time' : ''}${ev.completed ? ' · Done ✓' : ''}
        </div>
        <p class="text-xs font-semibold text-white leading-snug">${esc(ev.text)}</p>
        ${transitHtml}
        <button
          type="button"
          data-mapify-jump-day="${esc(day.id)}"
          data-mapify-jump-event="${esc(ev.id)}"
          class="w-full mt-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-orange-500/85 to-sky-500/85 hover:from-orange-400 hover:to-sky-400 text-white text-[10px] font-semibold text-center cursor-pointer transition-all"
        >Jump to Stop ${stopIndex + 1}</button>
      </div>
    `;
  }).join('');

  return `
    <div class="space-y-2 text-xs text-white min-w-[245px] max-w-[295px]">
      <div class="flex items-center justify-between gap-2">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/20 border border-orange-400/35 text-orange-200">
          ${groupStops.length} Visits · Stops ${esc(combinedLabel)}
        </span>
        ${mapUrl ? `
          <a
            href="${esc(mapUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            class="px-2 py-0.5 rounded-lg bg-white/12 hover:bg-white/22 border border-white/15 text-white text-[10px] font-semibold shrink-0"
          >Maps ↗</a>
        ` : ''}
      </div>

      <div class="text-[11px] text-white/75 flex items-start gap-1.5">
        <span class="text-sky-300 shrink-0 mt-0.5">${ICONS.pin}</span>
        <span class="break-words">${esc(getStopLocationLabel(primaryLocation))}</span>
      </div>

      <div class="space-y-2 max-h-[225px] overflow-y-auto pr-0.5">
        ${visitsHtml}
      </div>
    </div>
  `;
}

/**
 * Draw Vector Routes, Stops, and Style-Specific Layers (Basemap Halos & Smart Leg Pills)
 */
function drawMapifyVectorLayers(mapData, shouldFitBounds = false) {
  if (!mapState.map || !window.L || mapState.isCollapsed) return;

  const L = window.L;
  const isBasemap = mapState.theme === 'basemap';

  mapState.routeLayerGroup.clearLayers();
  mapState.markerLayerGroup.clearLayers();
  mapState.basemapHaloLayerGroup.clearLayers();
  mapState.basemapBadgeLayerGroup.clearLayers();
  mapState.markersByEventId.clear();
  mapState.tourSequence = [];
  mapState.basemapLegCandidates = [];
  mapState.basemapStopCoords = [];

  const emptyOverlay = document.getElementById('mapifyEmptyOverlay');
  if (!mapData || mapData.stops.length === 0) {
    mapState.currentBoundsPoints = [];
    emptyOverlay?.classList.remove('hidden');
    return;
  }
  emptyOverlay?.classList.add('hidden');

  const allBoundsPoints = [];

  // 1. Draw Real Road & Walking Polylines
  mapData.legs.forEach((leg) => {
    if (!leg.fromCoords || !leg.toCoords) return;

    const palette = DAY_ROUTE_PALETTE[leg.dayIndex % DAY_ROUTE_PALETTE.length];
    const isWalk = leg.mode === 'walking';
    const pathCoords = Array.isArray(leg.geometry) && leg.geometry.length >= 2
      ? leg.geometry
      : [
          [leg.fromCoords.lat, leg.fromCoords.lng],
          [leg.toCoords.lat, leg.toCoords.lng]
        ];

    pathCoords.forEach((pt) => allBoundsPoints.push(pt));

    const strokeColor = isBasemap
      ? (leg.hasWarning
          ? '#e11d48'
          : isWalk
            ? '#059669'
            : appStore.showAllDays
              ? palette.basemapHex
              : '#0284c7')
      : (leg.hasWarning
          ? '#fb7185'
          : isWalk
            ? '#34d399'
            : appStore.showAllDays
              ? palette.hex
              : '#38bdf8');

    // Outer casing/glow
    L.polyline(pathCoords, {
      color: isBasemap ? '#ffffff' : strokeColor,
      weight: isBasemap ? (isWalk ? 6.5 : 7.5) : (isWalk ? 6 : 8),
      opacity: isBasemap ? 0.88 : 0.22,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false
    }).addTo(mapState.routeLayerGroup);

    const coreLine = L.polyline(pathCoords, {
      color: strokeColor,
      weight: isWalk ? 3.5 : 4,
      opacity: isBasemap ? 0.95 : 0.92,
      dashArray: isWalk ? '5, 8' : leg.hasWarning ? '8, 6' : null,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(mapState.routeLayerGroup);

    const legModeText = isWalk ? 'Walk' : 'Drive';
    const legPopupHtml = `
      <div class="space-y-1.5 text-xs text-white min-w-[190px]">
        <div class="text-[10px] font-bold uppercase tracking-wider text-sky-300">
          ${esc(leg.dayShort)} · ${legModeText} Leg
        </div>
        <div class="text-sm font-bold text-white tabular-nums">
          ${esc(formatDistance(leg.distanceMiles))} · ${esc(formatDuration(leg.durationMinutes))}
        </div>
        <div class="text-[11px] text-white/70 leading-snug">
          <div><strong class="text-white/90">From:</strong> ${esc(leg.fromLocation)}</div>
          <div><strong class="text-white/90">To:</strong> ${esc(leg.toLocation)}</div>
        </div>
      </div>
    `;

    coreLine.bindPopup(legPopupHtml, { className: 'mapify-glass-popup', maxWidth: 270 });

    // Store candidate for pixel-spaced Basemap route pill rendering
    if (isBasemap && Number.isFinite(leg.durationMinutes) && leg.distanceMiles > 0.25) {
      const midLatLng = pathCoords[Math.floor(pathCoords.length / 2)];
      if (midLatLng) {
        mapState.basemapLegCandidates.push({
          startLatLng: pathCoords[0],
          endLatLng: pathCoords[pathCoords.length - 1],
          midLatLng,
          pillTone: leg.hasWarning
            ? 'mapify-basemap-leg-pill--warn'
            : isWalk
              ? 'mapify-basemap-leg-pill--walk'
              : '',
          modeGlyph: isWalk ? ICONS.walk : ICONS.drive,
          durationText: formatDuration(leg.durationMinutes),
          distanceText: formatDistance(leg.distanceMiles),
          popupHtml: legPopupHtml
        });
      }
    }
  });

  // 2. Group Co-Located Stops & Draw Unified Numbered Category Pins (e.g. "2 & 6")
  const groupedLocations = groupCoLocatedStops(mapData.stops);
  const markerByStopEventId = new Map();

  groupedLocations.forEach((group) => {
    const { coords, stops: groupStops } = group;
    const primaryStop = groupStops[0];
    const cat = getCategoryMeta(primaryStop.event.category);
    const palette = DAY_ROUTE_PALETTE[primaryStop.dayIndex % DAY_ROUTE_PALETTE.length];
    const [r, g, b] = cat.rgb || [56, 189, 248];
    const pinColor = appStore.showAllDays
      ? (isBasemap ? palette.basemapHex : palette.hex)
      : `rgb(${r}, ${g}, ${b})`;
    const pinLabel = formatGroupPinLabel(groupStops, appStore.showAllDays);
    const anyFixed = groupStops.some((s) => s.event.isFixed);
    const allCompleted = groupStops.every((s) => s.event.completed);

    allBoundsPoints.push([coords.lat, coords.lng]);
    mapState.basemapStopCoords.push(coords);

    // Basemap Style Exclusive: Soft Pastel Destination Glow Halo Behind Each Stop
    if (isBasemap) {
      const haloRgb = appStore.showAllDays ? palette.rgb : `${r}, ${g}, ${b}`;
      const haloIcon = L.divIcon({
        className: 'mapify-basemap-halo-wrap',
        html: `<div class="mapify-basemap-halo" style="--halo-rgb: ${haloRgb};"></div>`,
        iconSize: [58, 58],
        iconAnchor: [29, 29]
      });
      L.marker([coords.lat, coords.lng], {
        icon: haloIcon,
        interactive: false,
        zIndexOffset: -100
      }).addTo(mapState.basemapHaloLayerGroup);
    }

    const pillWidth = Math.max(32, Math.round(pinLabel.length * 7.6 + 18));
    const pinHtml = `
      <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
        <div class="mapify-pin ${isBasemap ? 'is-basemap' : ''} ${allCompleted ? 'is-completed' : ''} ${anyFixed ? 'is-fixed' : ''}" style="--pin-rgb: ${r}, ${g}, ${b}; --pin-accent: ${pinColor};">
          <span class="mapify-pin-num">${esc(pinLabel)}</span>
          ${anyFixed ? `<span class="mapify-pin-badge mapify-pin-badge--lock" title="Fixed Time">🔒</span>` : ''}
          ${allCompleted ? `<span class="mapify-pin-badge mapify-pin-badge--done" title="Completed">✓</span>` : ''}
        </div>
      </div>
    `;

    const icon = L.divIcon({
      className: 'mapify-pin-container',
      html: pinHtml,
      iconSize: [pillWidth, 32],
      iconAnchor: [Math.round(pillWidth / 2), 16],
      popupAnchor: [0, -18]
    });

    const marker = L.marker([coords.lat, coords.lng], { icon, zIndexOffset: 100 }).addTo(mapState.markerLayerGroup);
    const popupHtml = buildPinPopupHtml(groupStops, pinLabel);

    marker.bindPopup(popupHtml, { className: 'mapify-glass-popup', maxWidth: 310 });
    marker.on('popupopen', (e) => {
      const popupEl = e.popup.getElement();
      popupEl?.querySelectorAll('[data-mapify-jump-event]').forEach((jBtn) => {
        jBtn.addEventListener('click', () => {
          mapifyHooks.focusTimelineEvent(jBtn.dataset.mapifyJumpDay, jBtn.dataset.mapifyJumpEvent);
        });
      });
    });

    groupStops.forEach((s) => {
      mapState.markersByEventId.set(s.event.id, marker);
      markerByStopEventId.set(s.event.id, marker);
    });
  });

  // Preserve chronological order for Play Tour (visits repeat locations in exact schedule order)
  mapData.stops.forEach((stop) => {
    const marker = markerByStopEventId.get(stop.event.id);
    if (marker) {
      mapState.tourSequence.push({ stop, marker });
    }
  });

  mapState.currentBoundsPoints = allBoundsPoints;
  mapState.map.invalidateSize({ animate: false });
  if (shouldFitBounds) {
    fitMapToBounds(allBoundsPoints, false);
  }
  if (isBasemap) {
    renderBasemapLegBadges();
  }
}

/**
 * Master Mapify Renderer (Syncs Map Pins, Polylines, Style Layers & Bottom 4-Graphic HUD)
 */
export function renderMapify(tripStats) {
  if (!ensureMapifyShell()) return;

  const state = appStore.state;
  const focusedDay = state.days[appStore.activeCarouselIndex] || state.days[0];
  const scopeDayId = appStore.showAllDays ? null : focusedDay?.id || null;
  const mapData = getTripMapData(state, scopeDayId);

  mapState.lastTripStats = tripStats;
  mapState.lastMapData = mapData;

  renderMapifyBottomHud(tripStats, mapData);

  const scopePill = document.getElementById('mapifyScopePill');
  const subtitleEl = document.getElementById('mapifySubtitle');
  if (scopePill) {
    scopePill.textContent = appStore.showAllDays
      ? `All ${state.days.length} Days`
      : `${focusedDay?.shortDay || 'Day 1'} · ${focusedDay?.shortDate || ''}`;
  }
  if (subtitleEl) {
    subtitleEl.textContent = appStore.showAllDays
      ? `Full trip map · ${mapData.pinnedCount} pinned stop${mapData.pinnedCount === 1 ? '' : 's'}`
      : `${focusedDay?.location || 'Itinerary'} · ${mapData.pinnedCount} pinned stop${mapData.pinnedCount === 1 ? '' : 's'}`;
  }

  if (!ensureLeafletInitialized() || mapState.isCollapsed) return;

  syncThemeChrome();
  drawMapifyVectorLayers(mapData, true);

  if (mapState.theme === 'dark') {
    syncDarkNearbyPois(false);
  } else {
    mapState.poiLayerGroup?.clearLayers();
    renderPoiFilterBar();
  }
}

/**
 * Two-Way Sync: Fly Mapify to a Specific Stop from the Timeline
 */
export function focusEventOnMap(dayId, eventId) {
  const bar = document.getElementById('tripTravelSummaryBar');
  if (bar) {
    bar.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (mapState.isCollapsed) {
    document.getElementById('mapifyCollapseBtn')?.click();
  }

  const marker = mapState.markersByEventId.get(eventId);
  if (marker && mapState.map) {
    const latlng = marker.getLatLng();
    mapState.ignoreNextMoveEnd = true;
    mapState.map.flyTo(latlng, 14, { duration: 1.0 });
    setTimeout(() => {
      marker.openPopup();
      const popupEl = marker.getPopup()?.getElement();
      if (popupEl) {
        popupEl.querySelectorAll('[data-visit-card-id]').forEach((card) => {
          const isTarget = card.dataset.visitCardId === eventId;
          card.classList.toggle('ring-2', isTarget);
          card.classList.toggle('ring-orange-400', isTarget);
        });
      }
    }, 650);
  } else {
    showToast('Add or verify an address on this stop to pin it on Mapify', 'error');
  }
}