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
  getTripMapData
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
 * Map Tile Themes (100% Free, Zero-API-Key Esri Basemaps + Layered Street & City Labels)
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
    attribution: 'Tiles &copy; Esri',
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
  satellite: {
    label: 'Satellite',
    layers: [
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        maxNativeZoom: 18,
        zIndex: 1
      },
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
        maxNativeZoom: 18,
        zIndex: 2
      },
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        maxNativeZoom: 18,
        zIndex: 3
      }
    ],
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19
  }
};

const DAY_ROUTE_PALETTE = [
  { hex: '#fb923c', name: 'Sunset Orange' },
  { hex: '#38bdf8', name: 'Electric Sky' },
  { hex: '#34d399', name: 'Emerald Mint' },
  { hex: '#a78bfa', name: 'Cosmic Violet' },
  { hex: '#f472b6', name: 'Rose Quartz' },
  { hex: '#fbbf24', name: 'Golden Amber' }
];

/**
 * Internal Mapify Controller State
 */
const mapState = {
  map: null,
  tileLayers: [],
  routeLayerGroup: null,
  markerLayerGroup: null,
  tourLayerGroup: null,
  resizeObserver: null,
  theme: 'dark',
  isCollapsed: false,
  isExpandedHeight: false,
  markersByEventId: new Map(),
  currentBoundsPoints: [],
  lastFitSignature: '',
  tourTimer: null,
  isTourPlaying: false
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

function setMapTileTheme(themeKey) {
  if (!MAP_TILE_THEMES[themeKey]) return;
  mapState.theme = themeKey;

  document.querySelectorAll('[data-mapify-theme]').forEach((btn) => {
    const active = btn.dataset.mapifyTheme === themeKey;
    btn.className = active
      ? 'px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/22 text-white shadow cursor-pointer transition-all'
      : 'px-2.5 py-1 rounded-full text-[11px] font-medium text-white/60 hover:text-white cursor-pointer transition-all';
  });

  if (!mapState.map || !window.L) return;

  mapState.tileLayers.forEach((layer) => mapState.map.removeLayer(layer));
  mapState.tileLayers = [];

  const cfg = MAP_TILE_THEMES[themeKey];
  cfg.layers.forEach((layerCfg) => {
    const layer = window.L.tileLayer(layerCfg.url, {
      attribution: cfg.attribution,
      maxNativeZoom: layerCfg.maxNativeZoom || 18,
      maxZoom: cfg.maxZoom || 19,
      zIndex: layerCfg.zIndex || 1
    }).addTo(mapState.map);
    mapState.tileLayers.push(layer);
  });
}

export function invalidateMapifySize(refit = false) {
  if (!mapState.map || mapState.isCollapsed) return;
  mapState.map.invalidateSize({ animate: false });
  if (refit && mapState.currentBoundsPoints.length > 0) {
    fitMapToBounds(mapState.currentBoundsPoints, true);
  }
}

function fitMapToBounds(points, force = false) {
  if (!mapState.map || !window.L || points.length === 0) return;

  const sig = points.map((p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join('|');
  if (!force && sig === mapState.lastFitSignature) return;
  mapState.lastFitSignature = sig;

  if (points.length === 1) {
    mapState.map.setView(points[0], 13, { animate: true });
    return;
  }

  const bounds = window.L.latLngBounds(points);
  if (bounds.isValid()) {
    mapState.map.fitBounds(bounds, {
      paddingTopLeft: [36, 48],
      paddingBottomRight: [36, 48],
      maxZoom: 14,
      animate: true
    });
  }
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
    scrollWheelZoom: false, // Prevents trapping page scrolling on desktop & trackpads
    attributionControl: true
  });

  L.control.zoom({ position: 'topright' }).addTo(map);

  canvasEl.addEventListener('click', () => map.scrollWheelZoom.enable());
  canvasEl.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());

  mapState.map = map;
  mapState.routeLayerGroup = L.layerGroup().addTo(map);
  mapState.markerLayerGroup = L.layerGroup().addTo(map);
  mapState.tourLayerGroup = L.layerGroup().addTo(map);

  setMapTileTheme(mapState.theme);

  // Automatically re-measure container size whenever CSS/layout finishes settling
  if (typeof ResizeObserver !== 'undefined' && stageWrap && !mapState.resizeObserver) {
    mapState.resizeObserver = new ResizeObserver(() => {
      invalidateMapifySize(false);
    });
    mapState.resizeObserver.observe(stageWrap);
  }

  // Post-mount passes ensure full-height tile rendering & bounds fit after initial page animation
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
          <!-- Map Style Switcher -->
          <div class="inline-flex items-center p-0.5 rounded-full bg-black/40 border border-white/12">
            <button type="button" data-mapify-theme="dark" class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/22 text-white shadow cursor-pointer">Dark</button>
            <button type="button" data-mapify-theme="street" class="px-2.5 py-1 rounded-full text-[11px] font-medium text-white/60 hover:text-white cursor-pointer">Street</button>
            <button type="button" data-mapify-theme="satellite" class="px-2.5 py-1 rounded-full text-[11px] font-medium text-white/60 hover:text-white cursor-pointer">Satellite</button>
          </div>

          <!-- Animated Route Tour Playback -->
          <button
            id="mapifyTourBtn"
            type="button"
            title="Animate traveler route along the roads"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-orange-500/25 to-sky-500/25 hover:from-orange-500/45 hover:to-sky-500/45 border border-white/20 text-white transition-all cursor-pointer"
          >
            <span class="text-orange-300">${ICONS.route}</span>
            <span id="mapifyTourLabel">Play Tour</span>
          </button>

          <!-- Fit Route Bounds -->
          <button
            id="mapifyFitBtn"
            type="button"
            title="Center & fit all route pins"
            class="px-2.5 py-1.5 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 border border-white/15 text-white/90 transition-all cursor-pointer"
          >Fit</button>

          <!-- Expand / Compact Map Height -->
          <button
            id="mapifyExpandBtn"
            type="button"
            title="Expand or compact map height"
            class="hidden sm:inline-flex px-2.5 py-1.5 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 border border-white/15 text-white/90 transition-all cursor-pointer"
          >Expand</button>

          <!-- Collapse / Show Map Viewport -->
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

      <!-- 2. Interactive Map Viewport Stage (Explicit height prevents half-black render before Tailwind JIT) -->
      <div id="mapifyStageWrap" style="height: 360px;" class="relative w-full bg-[#0b0e15] transition-all duration-300">
        <div id="mapifyCanvas" style="width: 100%; height: 100%;" class="z-0"></div>

        <!-- Subtle Top-Left Legend Overlay -->
        <div id="mapifyLegendPill" class="pointer-events-none absolute top-3 left-3 z-[400] hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-full bg-[#12151f]/85 backdrop-blur-xl border border-white/15 text-[10px] font-semibold text-white/80 shadow-lg">
          <span class="inline-flex items-center gap-1.5"><span class="w-3 h-0.5 bg-sky-400 inline-block"></span>Drive</span>
          <span class="inline-flex items-center gap-1.5"><span class="w-3 h-0.5 border-b-2 border-dotted border-emerald-400 inline-block"></span>Walk</span>
          <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>Fixed</span>
        </div>

        <!-- Empty State Overlay (Shown when 0 addresses are pinned yet) -->
        <div id="mapifyEmptyOverlay" class="hidden pointer-events-none absolute inset-0 z-[400] flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs">
          <div class="rounded-2xl bg-[#161923]/90 border border-white/15 px-5 py-4 max-w-sm text-center shadow-2xl">
            <div class="text-xs font-bold uppercase tracking-widest text-sky-300">No Pinned Locations Yet</div>
            <p class="text-xs text-white/70 mt-1 leading-relaxed">Add an address or destination to any stop in your timeline below to plot routes and pins live on Mapify.</p>
          </div>
        </div>
      </div>

      <!-- 3. Bottom 4-Graphic Spatial Command HUD (Replaces Plain Travel Badges) -->
      <div class="p-3.5 sm:p-4 bg-gradient-to-b from-[#131620]/95 to-[#0e1118]/98 border-t border-white/12">
        <div id="mapifyHudGrid" class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3"></div>
      </div>
    </div>
  `;

  // Bind Toolbar Listeners Once
  bar.querySelectorAll('[data-mapify-theme]').forEach((btn) => {
    btn.addEventListener('click', () => setMapTileTheme(btn.dataset.mapifyTheme));
  });

  document.getElementById('mapifyFitBtn')?.addEventListener('click', () => {
    const allPoints = Array.from(mapState.markersByEventId.values()).map((m) => [m.getLatLng().lat, m.getLatLng().lng]);
    if (allPoints.length > 0) {
      invalidateMapifySize(false);
      fitMapToBounds(allPoints, true);
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
      setTimeout(() => invalidateMapifySize(true), 120);
    }
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
 * Animated Traveler Beacon Tour Along Real Road Coordinates
 */
function startAnimatedRouteTour() {
  if (!mapState.map || !window.L) return;
  if (mapState.isCollapsed) {
    document.getElementById('mapifyCollapseBtn')?.click();
  }

  const orderedEntries = Array.from(mapState.markersByEventId.entries());
  if (orderedEntries.length < 2) {
    showToast('Need at least 2 pinned locations to play route tour', 'error');
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
    if (stepIdx >= orderedEntries.length) {
      stopRouteTour();
      const pts = orderedEntries.map(([, m]) => [m.getLatLng().lat, m.getLatLng().lng]);
      fitMapToBounds(pts, true);
      showToast('Route tour complete!');
      return;
    }

    const [, marker] = orderedEntries[stepIdx];
    const latlng = marker.getLatLng();

    mapState.tourLayerGroup.clearLayers();
    const pulseIcon = L.divIcon({
      className: 'mapify-tour-beacon-wrap',
      html: `<div class="mapify-tour-beacon"></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    L.marker(latlng, { icon: pulseIcon, interactive: false }).addTo(mapState.tourLayerGroup);

    mapState.map.flyTo(latlng, 13, { duration: 0.9 });
    setTimeout(() => {
      if (mapState.isTourPlaying) marker.openPopup();
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
 * Master Mapify Renderer (Syncs Map Pins, Polylines & Bottom 4-Graphic HUD)
 */
export function renderMapify(tripStats) {
  if (!ensureMapifyShell()) return;

  const state = appStore.state;
  const focusedDay = state.days[appStore.activeCarouselIndex] || state.days[0];
  const scopeDayId = appStore.showAllDays ? null : focusedDay?.id || null;
  const mapData = getTripMapData(state, scopeDayId);

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

  const L = window.L;
  mapState.routeLayerGroup.clearLayers();
  mapState.markerLayerGroup.clearLayers();
  mapState.markersByEventId.clear();

  const emptyOverlay = document.getElementById('mapifyEmptyOverlay');
  if (mapData.stops.length === 0) {
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

    const strokeColor = leg.hasWarning
      ? '#fb7185'
      : isWalk
        ? '#34d399'
        : appStore.showAllDays
          ? palette.hex
          : '#38bdf8';

    L.polyline(pathCoords, {
      color: strokeColor,
      weight: isWalk ? 6 : 8,
      opacity: 0.22,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false
    }).addTo(mapState.routeLayerGroup);

    const coreLine = L.polyline(pathCoords, {
      color: strokeColor,
      weight: isWalk ? 3.5 : 4,
      opacity: 0.92,
      dashArray: isWalk ? '5, 8' : leg.hasWarning ? '8, 6' : null,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(mapState.routeLayerGroup);

    const legModeText = isWalk ? 'Walk' : 'Drive';
    coreLine.bindPopup(
      `
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
      `,
      { className: 'mapify-glass-popup', maxWidth: 270 }
    );
  });

  // 2. Draw Numbered Category Pins with Rich Glassmorphic Popups
  mapData.stops.forEach((stop) => {
    const { event: ev, day, dayIndex, stopIndex, coords, displayLocation, isInheritedLoc, incomingLeg } = stop;
    const cat = getCategoryMeta(ev.category);
    const palette = DAY_ROUTE_PALETTE[dayIndex % DAY_ROUTE_PALETTE.length];
    const [r, g, b] = cat.rgb || [56, 189, 248];
    const pinColor = appStore.showAllDays ? palette.hex : `rgb(${r}, ${g}, ${b})`;
    const pinLabel = appStore.showAllDays ? `D${dayIndex + 1}·${stopIndex + 1}` : `${stopIndex + 1}`;
    const mapUrl = getStopMapUrl(displayLocation);

    allBoundsPoints.push([coords.lat, coords.lng]);

    const pinHtml = `
      <div class="mapify-pin ${ev.completed ? 'is-completed' : ''} ${ev.isFixed ? 'is-fixed' : ''}" style="--pin-rgb: ${r}, ${g}, ${b}; --pin-accent: ${pinColor};">
        <span class="mapify-pin-num">${esc(pinLabel)}</span>
        ${ev.isFixed ? `<span class="mapify-pin-badge mapify-pin-badge--lock" title="Fixed Time">🔒</span>` : ''}
        ${ev.completed ? `<span class="mapify-pin-badge mapify-pin-badge--done" title="Completed">✓</span>` : ''}
      </div>
    `;

    const icon = L.divIcon({
      className: 'mapify-pin-container',
      html: pinHtml,
      iconSize: appStore.showAllDays ? [42, 32] : [32, 32],
      iconAnchor: appStore.showAllDays ? [21, 16] : [16, 16],
      popupAnchor: [0, -18]
    });

    const marker = L.marker([coords.lat, coords.lng], { icon }).addTo(mapState.markerLayerGroup);

    const transitLineHtml = incomingLeg && incomingLeg.mode !== 'same' && Number.isFinite(incomingLeg.durationMinutes)
      ? `
        <div class="rounded-xl bg-sky-500/15 border border-sky-400/30 px-2.5 py-1.5 text-[11px] font-semibold text-sky-200 flex items-center justify-between gap-2">
          <span>Arriving Transit:</span>
          <span class="tabular-nums text-white">${esc(formatDistance(incomingLeg.distanceMiles))} · ${esc(formatDuration(incomingLeg.durationMinutes))} ${incomingLeg.mode === 'walking' ? 'walk' : 'drive'}</span>
        </div>
      `
      : '';

    const popupHtml = `
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
          <span class="break-words">${isInheritedLoc ? `<strong class="text-orange-200">From prev day:</strong> ` : ''}${esc(getStopLocationLabel(displayLocation))}</span>
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

    marker.bindPopup(popupHtml, { className: 'mapify-glass-popup', maxWidth: 300 });
    marker.on('popupopen', (e) => {
      const popupEl = e.popup.getElement();
      popupEl?.querySelector('[data-mapify-jump-event]')?.addEventListener('click', (btnEvt) => {
        const jBtn = btnEvt.currentTarget;
        mapifyHooks.focusTimelineEvent(jBtn.dataset.mapifyJumpDay, jBtn.dataset.mapifyJumpEvent);
      });
    });

    mapState.markersByEventId.set(ev.id, marker);
  });

  mapState.currentBoundsPoints = allBoundsPoints;
  mapState.map.invalidateSize({ animate: false });
  fitMapToBounds(allBoundsPoints, false);
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
    mapState.map.flyTo(latlng, 14, { duration: 1.0 });
    setTimeout(() => {
      marker.openPopup();
    }, 650);
  } else {
    showToast('Add or verify an address on this stop to pin it on Mapify', 'error');
  }
}