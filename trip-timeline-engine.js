/**
 * ============================================================================
 * SPATIAL TRIPOS · SMART TIMELINE, RIPPLE SCHEDULER & LIVE TRAVEL ENGINE
 * ============================================================================
 * Standalone engine (zero circular imports) handling:
 *  1. Structured 15-minute Time Slots & legacy schedule migration
 *  2. Flexible Ripple Auto-Adjustment & Fixed Time / Reservation anchoring
 *  3. Free Live Geocoding + OSRM Road Routing with smart caching & fallback
 *  4. Schedule Shortage / Conflict Warnings & Day / Total Trip Travel Totals
 * ============================================================================
 */

export const TIME_SLOT_STEP = 15; // 15-minute increments
export const MIN_SLOT_MINUTES = 0; // 12:00 AM
export const MAX_SLOT_MINUTES = 23 * 60 + 45; // 11:45 PM

export const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hr' },
  { value: 75, label: '1 hr 15 min' },
  { value: 90, label: '1 hr 30 min' },
  { value: 120, label: '2 hrs' },
  { value: 150, label: '2 hrs 30 min' },
  { value: 180, label: '3 hrs' },
  { value: 240, label: '4 hrs' },
  { value: 300, label: '5 hrs' },
  { value: 360, label: '6 hrs' },
  { value: 480, label: '8 hrs' }
];

export const QUICK_TIME_JUMP_SLOTS = [
  { minutes: 8 * 60, label: '8:00 AM' },
  { minutes: 10 * 60, label: '10:00 AM' },
  { minutes: 12 * 60, label: '12:00 PM' },
  { minutes: 14 * 60, label: '2:00 PM' },
  { minutes: 16 * 60, label: '4:00 PM' },
  { minutes: 18 * 60, label: '6:00 PM' },
  { minutes: 20 * 60, label: '8:00 PM' }
];

/**
 * Built-in Instant Coordinate Dictionary (Zero-latency accuracy for common & default stops)
 */
const PRESET_COORDINATES = {
  'west covina': { lat: 34.0686, lng: -117.9390 },
  'la puente': { lat: 34.0200, lng: -117.9495 },
  'downtown riverside': { lat: 33.9806, lng: -117.3755 },
  'riverside': { lat: 33.9806, lng: -117.3755 },
  'main st pedestrian mall': { lat: 33.9822, lng: -117.3736 },
  'the mission inn': { lat: 33.9834, lng: -117.3725 },
  'mission inn': { lat: 33.9834, lng: -117.3725 },
  'palm desert': { lat: 33.7222, lng: -116.3745 },
  'the living desert': { lat: 33.6991, lng: -116.3722 },
  'living desert zoo': { lat: 33.6991, lng: -116.3722 },
  'palm springs': { lat: 33.8303, lng: -116.5453 },
  'palm springs air museum': { lat: 33.8295, lng: -116.5015 },
  "sherman's deli": { lat: 33.8226, lng: -116.5451 },
  'shermans deli': { lat: 33.8226, lng: -116.5451 },
  'moorten botanical garden': { lat: 33.7995, lng: -116.5460 },
  'palm springs aerial tramway': { lat: 33.8373, lng: -116.6140 },
  'peaks restaurant': { lat: 33.8128, lng: -116.6373 },
  'cherry valley': { lat: 33.9722, lng: -116.9772 },
  '123 farm': { lat: 33.9636, lng: -116.9492 },
  'san diego': { lat: 32.7157, lng: -117.1611 },
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  'big bear': { lat: 34.2439, lng: -116.9114 },
  'santa barbara': { lat: 34.4208, lng: -119.6982 },
  'las vegas': { lat: 36.1699, lng: -115.1398 },
  'irvine': { lat: 33.6846, lng: -117.8265 },
  'anaheim': { lat: 33.8366, lng: -117.9143 },
  'santa monica': { lat: 34.0195, lng: -118.4912 }
};

/**
 * ============================================================================
 * 1. TIME SLOT FORMATTING & PARSING HELPERS
 * ============================================================================
 */

export function clampMinutes(mins) {
  const n = Number(mins);
  if (!Number.isFinite(n)) return 9 * 60;
  return Math.max(MIN_SLOT_MINUTES, Math.min(MAX_SLOT_MINUTES, Math.round(n)));
}

export function roundUpToSlot(mins, step = TIME_SLOT_STEP) {
  const safe = Math.max(MIN_SLOT_MINUTES, Math.ceil(mins / step) * step);
  return Math.min(MAX_SLOT_MINUTES, safe);
}

export function roundNearestSlot(mins, step = TIME_SLOT_STEP) {
  const safe = Math.max(MIN_SLOT_MINUTES, Math.round(mins / step) * step);
  return Math.min(MAX_SLOT_MINUTES, safe);
}

export function formatMinutesTo12h(totalMins) {
  const safe = Math.max(0, Math.round(Number(totalMins) || 0));
  const dayOverflow = safe >= 1440;
  const wrapped = safe % 1440;
  const h24 = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}${dayOverflow ? ' (+1d)' : ''}`;
}

export function formatTimeWindow(startMinutes, durationMinutes = 60) {
  const start = clampMinutes(startMinutes);
  const dur = Math.max(0, Math.round(Number(durationMinutes) || 0));
  if (dur <= 0) return formatMinutesTo12h(start);

  const end = start + dur;
  const startPeriod = Math.floor((start % 1440) / 60) >= 12 ? 'PM' : 'AM';
  const endPeriod = Math.floor((end % 1440) / 60) >= 12 ? 'PM' : 'AM';

  if (end < 1440 && startPeriod === endPeriod) {
    const startCompact = formatMinutesTo12h(start).replace(/ (AM|PM)$/, '');
    return `${startCompact}–${formatMinutesTo12h(end)}`;
  }
  return `${formatMinutesTo12h(start)}–${formatMinutesTo12h(end)}`;
}

export function formatDuration(mins) {
  const m = Math.max(0, Math.round(Number(mins) || 0));
  if (m < 60) return `${m} min`;
  const hrs = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${hrs} hr${hrs > 1 ? 's' : ''}` : `${hrs}h ${rem}m`;
}

export function formatDistance(miles) {
  const n = Number(miles) || 0;
  if (n < 0.1) return '0 mi';
  if (n < 10) return `${n.toFixed(1)} mi`;
  return `${Math.round(n)} mi`;
}

let cachedTimeSlots = null;
export function getTimeSlotOptions() {
  if (cachedTimeSlots) return cachedTimeSlots;
  const slots = [];
  for (let m = MIN_SLOT_MINUTES; m <= MAX_SLOT_MINUTES; m += TIME_SLOT_STEP) {
    slots.push({ value: m, label: formatMinutesTo12h(m) });
  }
  cachedTimeSlots = slots;
  return slots;
}

function to24hMinutes(hour, minute, meridiem) {
  let h = Number(hour) || 0;
  const m = Number(minute) || 0;
  if (meridiem) {
    const mer = meridiem.toUpperCase();
    if (mer === 'AM') {
      if (h === 12) h = 0;
    } else if (mer === 'PM') {
      if (h !== 12) h += 12;
    }
  }
  return h * 60 + m;
}

/**
 * Parse legacy text time strings (e.g. "5:30–6:00 PM", "By 11:00 AM", "4:00 PM")
 * into structured { startMinutes, durationMinutes }
 */
export function parseTimeStringToWindow(timeStr, fallbackStartMins = 9 * 60) {
  const raw = String(timeStr || '').trim();
  if (!raw) {
    return { startMinutes: roundNearestSlot(fallbackStartMins), durationMinutes: 60 };
  }

  const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi;
  const matches = [];
  let match;
  while ((match = timeRegex.exec(raw)) !== null) {
    const hour = Number(match[1]);
    const minute = match[2] ? Number(match[2]) : 0;
    const meridiem = match[3] ? match[3].toUpperCase() : null;
    if (hour >= 0 && hour <= 24 && minute >= 0 && minute < 60) {
      matches.push({ hour, minute, meridiem });
    }
  }

  if (matches.length === 0) {
    return { startMinutes: roundNearestSlot(fallbackStartMins), durationMinutes: 60 };
  }

  if (matches.length === 1) {
    const m1 = matches[0];
    let mer = m1.meridiem;
    if (!mer) {
      mer = m1.hour < 7 ? 'PM' : (fallbackStartMins >= 12 * 60 ? 'PM' : 'AM');
    }
    const start = clampMinutes(to24hMinutes(m1.hour, m1.minute, mer));
    return { startMinutes: roundNearestSlot(start), durationMinutes: 60 };
  }

  // Range: start – end
  const m1 = matches[0];
  const m2 = matches[1];
  const endMer = m2.meridiem || m1.meridiem || (fallbackStartMins >= 12 * 60 ? 'PM' : 'AM');
  const endMins = to24hMinutes(m2.hour, m2.minute, endMer);

  let startMins;
  if (m1.meridiem) {
    startMins = to24hMinutes(m1.hour, m1.minute, m1.meridiem);
  } else {
    startMins = to24hMinutes(m1.hour, m1.minute, endMer);
    if (startMins >= endMins) {
      const altMer = endMer === 'PM' ? 'AM' : 'PM';
      const altStart = to24hMinutes(m1.hour, m1.minute, altMer);
      if (altStart < endMins) startMins = altStart;
    }
  }

  let dur = endMins - startMins;
  if (dur <= 0 || dur > 12 * 60) dur = 60;
  dur = Math.max(15, Math.round(dur / 15) * 15);

  return {
    startMinutes: roundNearestSlot(clampMinutes(startMins)),
    durationMinutes: dur
  };
}

/**
 * Normalize a single itinerary stop so time slots, reservation locks, and completion flags are consistent
 */
export function normalizeEventSchedule(ev, fallbackStartMins = 9 * 60) {
  if (!ev || typeof ev !== 'object') return ev;

  if (!Number.isFinite(Number(ev.startMinutes)) || !Number.isFinite(Number(ev.durationMinutes))) {
    const parsed = parseTimeStringToWindow(ev.time, fallbackStartMins);
    ev.startMinutes = parsed.startMinutes;
    ev.durationMinutes = parsed.durationMinutes;
  } else {
    ev.startMinutes = clampMinutes(ev.startMinutes);
    ev.durationMinutes = Math.max(15, Math.round(Number(ev.durationMinutes) / 15) * 15);
  }

  if (ev.reservationMinutes !== null && ev.reservationMinutes !== undefined && ev.reservationMinutes !== '') {
    ev.reservationMinutes = clampMinutes(ev.reservationMinutes);
    ev.startMinutes = ev.reservationMinutes;
    ev.isFixed = true;
  } else {
    ev.reservationMinutes = null;
    ev.isFixed = Boolean(ev.isFixed);
  }

  ev.completed = Boolean(ev.completed);
  ev.location = typeof ev.location === 'string' ? ev.location : '';
  ev.time = formatTimeWindow(ev.startMinutes, ev.durationMinutes);
  return ev;
}

export function normalizeDaySchedules(day) {
  if (!day || !Array.isArray(day.events)) return;
  let cursor = 9 * 60;
  day.events.forEach((ev) => {
    normalizeEventSchedule(ev, cursor);
    cursor = Math.min(MAX_SLOT_MINUTES, ev.startMinutes + ev.durationMinutes);
  });
}

export function normalizeTripSchedules(trip) {
  if (!trip || !Array.isArray(trip.days)) return;
  trip.days.forEach((day) => normalizeDaySchedules(day));
}

/**
 * ============================================================================
 * 2. LIVE GEOCODING & TRAVEL TIME / DISTANCE ENGINE
 * ============================================================================
 */

const STORAGE_GEO_KEY = 'tripos_geo_cache_v1';
const STORAGE_ROUTE_KEY = 'tripos_route_cache_v1';

const geoMemoryCache = new Map();
const routeMemoryCache = new Map();
const pendingGeoRequests = new Map();
const pendingRouteRequests = new Map();

function loadCacheFromStorage(key, map) {
  try {
    const raw = window.localStorage?.getItem(key);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') {
      Object.entries(obj).forEach(([k, v]) => map.set(k, v));
    }
  } catch (err) {
    // Ignore storage errors in sandboxed embeds
  }
}

function saveCacheToStorage(key, map) {
  try {
    const entries = Array.from(map.entries()).slice(-180);
    window.localStorage?.setItem(key, JSON.stringify(Object.fromEntries(entries)));
  } catch (err) {
    // Ignore storage quota or sandbox errors
  }
}

loadCacheFromStorage(STORAGE_GEO_KEY, geoMemoryCache);
loadCacheFromStorage(STORAGE_ROUTE_KEY, routeMemoryCache);

function normalizeLocKey(str) {
  return String(str || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function extractLocationText(rawLoc) {
  const trimmed = String(rawLoc || '').trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;

  // Try extracting coordinates or query from Google Maps URLs
  const atMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return `${atMatch[1]},${atMatch[2]}`;
  try {
    const u = new URL(trimmed);
    const q = u.searchParams.get('query') || u.searchParams.get('q');
    if (q) return decodeURIComponent(q);
  } catch (err) {
    // Fallback
  }
  return '';
}

function parseDirectCoords(str) {
  const m = String(str || '').trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  return null;
}

function lookupPresetCoordinates(rawQuery) {
  const q = normalizeLocKey(rawQuery);
  if (!q) return null;
  if (PRESET_COORDINATES[q]) return PRESET_COORDINATES[q];

  // Longest matching preset key contained in the location string
  let bestKey = '';
  for (const key of Object.keys(PRESET_COORDINATES)) {
    if (q.includes(key) && key.length > bestKey.length) {
      bestKey = key;
    }
  }
  return bestKey ? PRESET_COORDINATES[bestKey] : null;
}

export function haversineMiles(a, b) {
  const R = 3958.7613; // Earth radius in miles
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function estimateFallbackLeg(coordA, coordB) {
  const straight = haversineMiles(coordA, coordB);
  if (straight < 0.08) {
    return { distanceMiles: 0, durationMinutes: 0, mode: 'same', estimated: false };
  }
  const roadMiles = Number((straight * 1.26).toFixed(1));
  if (roadMiles <= 0.55) {
    return {
      distanceMiles: roadMiles,
      durationMinutes: Math.max(3, Math.round((roadMiles / 3) * 60)),
      mode: 'walking',
      estimated: true
    };
  }
  // Realistic urban vs highway speed curve
  const avgMph = roadMiles < 3 ? 22 : roadMiles < 12 ? 34 : 52;
  const mins = Math.max(4, Math.round((roadMiles / avgMph) * 60) + 3);
  return {
    distanceMiles: roadMiles,
    durationMinutes: mins,
    mode: 'driving',
    estimated: true
  };
}

function buildRouteCacheKey(fromStr, toStr, dayHint = '') {
  const a = normalizeLocKey(extractLocationText(fromStr));
  const b = normalizeLocKey(extractLocationText(toStr));
  const h = normalizeLocKey(dayHint);
  return `${a}__TO__${b}__IN__${h}`;
}

/**
 * Synchronous lookup for immediate UI rendering
 */
export function getCachedTravelLeg(fromLoc, toLoc, dayHint = '') {
  const fromClean = extractLocationText(fromLoc);
  const toClean = extractLocationText(toLoc);
  if (!fromClean || !toClean) return null;

  if (normalizeLocKey(fromClean) === normalizeLocKey(toClean)) {
    return {
      fromLocation: fromClean,
      toLocation: toClean,
      distanceMiles: 0,
      durationMinutes: 0,
      mode: 'same',
      status: 'ready'
    };
  }

  const key = buildRouteCacheKey(fromClean, toClean, dayHint);
  if (routeMemoryCache.has(key)) {
    return {
      fromLocation: fromClean,
      toLocation: toClean,
      ...routeMemoryCache.get(key),
      status: 'ready'
    };
  }

  // Instant preset fallback while live OSRM road route fetches
  const coordA = parseDirectCoords(fromClean) || geoMemoryCache.get(normalizeLocKey(fromClean)) || lookupPresetCoordinates(fromClean);
  const coordB = parseDirectCoords(toClean) || geoMemoryCache.get(normalizeLocKey(toClean)) || lookupPresetCoordinates(toClean);
  if (coordA && coordB) {
    const est = estimateFallbackLeg(coordA, coordB);
    return {
      fromLocation: fromClean,
      toLocation: toClean,
      ...est,
      status: 'estimated'
    };
  }

  return {
    fromLocation: fromClean,
    toLocation: toClean,
    distanceMiles: null,
    durationMinutes: null,
    mode: 'driving',
    status: 'loading'
  };
}

async function geocodeLocation(rawLoc, dayHint = '') {
  const cleaned = extractLocationText(rawLoc);
  if (!cleaned) return null;

  const direct = parseDirectCoords(cleaned);
  if (direct) return direct;

  const normKey = normalizeLocKey(cleaned);
  if (geoMemoryCache.has(normKey)) return geoMemoryCache.get(normKey);

  const preset = lookupPresetCoordinates(cleaned);
  if (preset) {
    geoMemoryCache.set(normKey, preset);
    return preset;
  }

  const fullQuery = dayHint && !normKey.includes(normalizeLocKey(dayHint))
    ? `${cleaned}, ${dayHint}`
    : cleaned;
  const fullKey = normalizeLocKey(fullQuery);

  if (geoMemoryCache.has(fullKey)) return geoMemoryCache.get(fullKey);
  if (pendingGeoRequests.has(fullKey)) return pendingGeoRequests.get(fullKey);

  const promise = (async () => {
    try {
      // 1. Try OpenStreetMap Nominatim (great for specific landmarks, restaurants, hotels)
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(fullQuery)}`;
      const res = await fetch(nomUrl, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list[0]) {
          const coord = { lat: Number(list[0].lat), lng: Number(list[0].lon) };
          if (Number.isFinite(coord.lat) && Number.isFinite(coord.lng)) {
            geoMemoryCache.set(normKey, coord);
            geoMemoryCache.set(fullKey, coord);
            saveCacheToStorage(STORAGE_GEO_KEY, geoMemoryCache);
            return coord;
          }
        }
      }
    } catch (err) {
      // Fall through to Open-Meteo geocoder
    }

    try {
      // 2. Fallback to Open-Meteo Geocoding (fast & reliable for cities/towns)
      const firstSegment = cleaned.split(',')[0].trim();
      const omUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(firstSegment)}&count=1&language=en&format=json`;
      const res2 = await fetch(omUrl);
      if (res2.ok) {
        const data = await res2.json();
        const place = data?.results?.[0];
        if (place) {
          const coord = { lat: Number(place.latitude), lng: Number(place.longitude) };
          geoMemoryCache.set(normKey, coord);
          saveCacheToStorage(STORAGE_GEO_KEY, geoMemoryCache);
          return coord;
        }
      }
    } catch (err) {
      // Silent fallback
    }

    return null;
  })();

  pendingGeoRequests.set(fullKey, promise);
  try {
    return await promise;
  } finally {
    pendingGeoRequests.delete(fullKey);
  }
}

async function resolveRouteLeg(fromLoc, toLoc, dayHint = '') {
  const fromClean = extractLocationText(fromLoc);
  const toClean = extractLocationText(toLoc);
  if (!fromClean || !toClean) return null;

  if (normalizeLocKey(fromClean) === normalizeLocKey(toClean)) {
    return { distanceMiles: 0, durationMinutes: 0, mode: 'same', estimated: false };
  }

  const key = buildRouteCacheKey(fromClean, toClean, dayHint);
  if (routeMemoryCache.has(key)) return routeMemoryCache.get(key);
  if (pendingRouteRequests.has(key)) return pendingRouteRequests.get(key);

  const promise = (async () => {
    const coordA = await geocodeLocation(fromClean, dayHint);
    const coordB = await geocodeLocation(toClean, dayHint);
    if (!coordA || !coordB) return null;

    const straight = haversineMiles(coordA, coordB);
    if (straight < 0.08) {
      const sameRes = { distanceMiles: 0, durationMinutes: 0, mode: 'same', estimated: false };
      routeMemoryCache.set(key, sameRes);
      saveCacheToStorage(STORAGE_ROUTE_KEY, routeMemoryCache);
      return sameRes;
    }

    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordA.lng},${coordA.lat};${coordB.lng},${coordB.lat}?overview=false`;
      const res = await fetch(osrmUrl);
      if (res.ok) {
        const data = await res.json();
        const route = data?.routes?.[0];
        if (route && Number.isFinite(route.distance) && Number.isFinite(route.duration)) {
          const miles = Number((route.distance / 1609.344).toFixed(1));
          let mins = Math.max(1, Math.round(route.duration / 60));
          let mode = 'driving';

          if (miles <= 0.5) {
            mode = 'walking';
            mins = Math.max(3, Math.round((miles / 3) * 60));
          }

          const resolved = { distanceMiles: miles, durationMinutes: mins, mode, estimated: false };
          routeMemoryCache.set(key, resolved);
          saveCacheToStorage(STORAGE_ROUTE_KEY, routeMemoryCache);
          return resolved;
        }
      }
    } catch (err) {
      // Fallback to Haversine road estimate below
    }

    const fallback = estimateFallbackLeg(coordA, coordB);
    routeMemoryCache.set(key, fallback);
    saveCacheToStorage(STORAGE_ROUTE_KEY, routeMemoryCache);
    return fallback;
  })();

  pendingRouteRequests.set(key, promise);
  try {
    return await promise;
  } finally {
    pendingRouteRequests.delete(key);
  }
}

/**
 * Resolve all consecutive destination pairs across a trip in the background
 * Calls onUpdate() whenever new real driving times & distances arrive
 */
export async function computeTripTravelLegs(trip, onUpdate = () => {}) {
  if (!trip || !Array.isArray(trip.days)) return;

  const jobs = [];
  const seenKeys = new Set();

  trip.days.forEach((day) => {
    const dayHint = day.location || '';
    let lastLoc = '';
    (day.events || []).forEach((ev) => {
      const loc = String(ev.location || '').trim();
      if (loc) {
        if (lastLoc && normalizeLocKey(lastLoc) !== normalizeLocKey(loc)) {
          const k = buildRouteCacheKey(lastLoc, loc, dayHint);
          if (!routeMemoryCache.has(k) && !seenKeys.has(k)) {
            seenKeys.add(k);
            jobs.push({ from: lastLoc, to: loc, hint: dayHint });
          }
        }
        lastLoc = loc;
      }
    });
  });

  if (jobs.length === 0) return;

  let anyUpdated = false;
  // Process in small batches to be gentle with free public routing endpoints
  for (let i = 0; i < jobs.length; i += 2) {
    const batch = jobs.slice(i, i + 2);
    const results = await Promise.all(
      batch.map((j) => resolveRouteLeg(j.from, j.to, j.hint))
    );
    if (results.some(Boolean)) {
      anyUpdated = true;
      onUpdate();
    }
  }

  if (anyUpdated) onUpdate();
}

/**
 * ============================================================================
 * 3. SMART RIPPLE AUTO-ADJUSTMENT & DRAG-AND-DROP SCHEDULER
 * ============================================================================
 */

function getTravelMinutesBetweenEvents(prevEv, nextEv, dayHint = '') {
  if (!prevEv?.location || !nextEv?.location) return 0;
  const leg = getCachedTravelLeg(prevEv.location, nextEv.location, dayHint);
  if (!leg || !Number.isFinite(leg.durationMinutes)) return 0;
  return leg.durationMinutes;
}

/**
 * Ripple all following FLEXIBLE activities forward from `startIndex` so none overlap.
 * FIXED activities (or activities with a Reservation/Appointment Time) NEVER move automatically.
 */
export function rippleFlexibleActivitiesFrom(day, startIndex = 0) {
  if (!day || !Array.isArray(day.events) || day.events.length === 0) return 0;
  normalizeDaySchedules(day);

  const dayHint = day.location || '';
  let movedCount = 0;

  for (let i = Math.max(0, startIndex); i < day.events.length - 1; i++) {
    const curr = day.events[i];
    const next = day.events[i + 1];

    // Never auto-move Fixed Time or Reservation stops
    if (next.isFixed || next.reservationMinutes !== null) continue;

    const travelMins = getTravelMinutesBetweenEvents(curr, next, dayHint);
    const earliestNextStart = roundUpToSlot(curr.startMinutes + curr.durationMinutes + travelMins, TIME_SLOT_STEP);

    if (next.startMinutes < earliestNextStart) {
      next.startMinutes = clampMinutes(earliestNextStart);
      next.time = formatTimeWindow(next.startMinutes, next.durationMinutes);
      movedCount++;
    }
  }

  return movedCount;
}

/**
 * Reorder an activity within the same day (via drag-and-drop or up/down arrows)
 * Automatically adjusts the moved activity's time slot and ripples following flexible stops.
 */
export function reorderEventInDay(day, eventId, targetIndex) {
  if (!day || !Array.isArray(day.events)) return { moved: false, shiftedCount: 0 };
  normalizeDaySchedules(day);

  const fromIndex = day.events.findIndex((e) => e.id === eventId);
  if (fromIndex < 0) return { moved: false, shiftedCount: 0 };

  const clampedTarget = Math.max(0, Math.min(day.events.length - 1, targetIndex));
  if (fromIndex === clampedTarget) return { moved: false, shiftedCount: 0 };

  const dayHint = day.location || '';
  const targetSlotAnchor = day.events[clampedTarget]?.startMinutes ?? 9 * 60;

  const [movedEv] = day.events.splice(fromIndex, 1);
  day.events.splice(clampedTarget, 0, movedEv);

  // If the moved item is flexible, adopt the smart time slot for its new position
  if (!movedEv.isFixed && movedEv.reservationMinutes === null) {
    if (clampedTarget === 0) {
      movedEv.startMinutes = clampMinutes(targetSlotAnchor);
    } else {
      const prev = day.events[clampedTarget - 1];
      const travel = getTravelMinutesBetweenEvents(prev, movedEv, dayHint);
      movedEv.startMinutes = roundUpToSlot(prev.startMinutes + prev.durationMinutes + travel, TIME_SLOT_STEP);
    }
    movedEv.time = formatTimeWindow(movedEv.startMinutes, movedEv.durationMinutes);
  }

  const shiftedCount = rippleFlexibleActivitiesFrom(day, clampedTarget);
  return { moved: true, shiftedCount, event: movedEv };
}

/**
 * Drag an activity directly onto a new Start Time Slot (in minutes)
 * Re-orders chronologically around the new slot and ripples all following flexible stops.
 */
export function moveEventToTimeSlot(day, eventId, newStartMinutes) {
  if (!day || !Array.isArray(day.events)) return { moved: false, shiftedCount: 0 };
  normalizeDaySchedules(day);

  const idx = day.events.findIndex((e) => e.id === eventId);
  if (idx < 0) return { moved: false, shiftedCount: 0 };

  const ev = day.events[idx];
  const targetStart = roundNearestSlot(clampMinutes(newStartMinutes), TIME_SLOT_STEP);

  ev.startMinutes = targetStart;
  if (ev.reservationMinutes !== null) {
    ev.reservationMinutes = targetStart;
  }
  ev.time = formatTimeWindow(ev.startMinutes, ev.durationMinutes);

  // Re-place chronologically while preserving relative order for equal start times (placing moved item first at that time so followers ripple)
  day.events.splice(idx, 1);
  let insertIdx = day.events.findIndex((other) => other.startMinutes >= targetStart);
  if (insertIdx === -1) insertIdx = day.events.length;
  day.events.splice(insertIdx, 0, ev);

  const shiftedCount = rippleFlexibleActivitiesFrom(day, insertIdx);
  return { moved: true, shiftedCount, event: ev };
}

/**
 * Drag an activity from one day to another day (at a specific index or end of day)
 */
export function moveEventAcrossDays(sourceDay, targetDay, eventId, targetIndex = null) {
  if (!sourceDay || !targetDay || sourceDay.id === targetDay.id) {
    return { moved: false, shiftedCount: 0 };
  }
  normalizeDaySchedules(sourceDay);
  normalizeDaySchedules(targetDay);

  const fromIdx = sourceDay.events.findIndex((e) => e.id === eventId);
  if (fromIdx < 0) return { moved: false, shiftedCount: 0 };

  const [movedEv] = sourceDay.events.splice(fromIdx, 1);
  const insertIdx = targetIndex === null || targetIndex === undefined
    ? targetDay.events.length
    : Math.max(0, Math.min(targetDay.events.length, targetIndex));

  const targetHint = targetDay.location || '';

  // Adjust time slot automatically for flexible stops arriving in the new day
  if (!movedEv.isFixed && movedEv.reservationMinutes === null) {
    if (insertIdx > 0) {
      const prev = targetDay.events[insertIdx - 1];
      const travel = getTravelMinutesBetweenEvents(prev, movedEv, targetHint);
      movedEv.startMinutes = roundUpToSlot(prev.startMinutes + prev.durationMinutes + travel, TIME_SLOT_STEP);
    } else if (targetDay.events.length > 0) {
      movedEv.startMinutes = clampMinutes(targetDay.events[0].startMinutes);
    } else {
      movedEv.startMinutes = 9 * 60;
    }
    movedEv.time = formatTimeWindow(movedEv.startMinutes, movedEv.durationMinutes);
  }

  targetDay.events.splice(insertIdx, 0, movedEv);
  const shiftedCount = rippleFlexibleActivitiesFrom(targetDay, insertIdx);
  return { moved: true, shiftedCount, event: movedEv };
}

/**
 * Duplicate an activity right below itself with an auto-shifted flexible slot
 */
export function duplicateEventInDay(day, eventId, newId) {
  if (!day || !Array.isArray(day.events)) return null;
  normalizeDaySchedules(day);

  const idx = day.events.findIndex((e) => e.id === eventId);
  if (idx < 0) return null;

  const orig = day.events[idx];
  const nextStart = roundUpToSlot(orig.startMinutes + orig.durationMinutes, TIME_SLOT_STEP);

  const copy = {
    ...orig,
    id: newId,
    startMinutes: nextStart,
    durationMinutes: orig.durationMinutes,
    time: formatTimeWindow(nextStart, orig.durationMinutes),
    isFixed: false,
    reservationMinutes: null,
    completed: false
  };

  day.events.splice(idx + 1, 0, copy);
  const shiftedCount = rippleFlexibleActivitiesFrom(day, idx + 1);
  return { copy, shiftedCount };
}

/**
 * Copy an activity to another day (appends cleanly or fits right after the last stop)
 */
export function copyEventToDay(sourceDay, targetDay, eventId, newId, keepFixedTime = false) {
  if (!sourceDay || !targetDay) return null;
  normalizeDaySchedules(sourceDay);
  normalizeDaySchedules(targetDay);

  const orig = sourceDay.events.find((e) => e.id === eventId);
  if (!orig) return null;

  let startMins = orig.startMinutes;
  let isFixed = keepFixedTime ? Boolean(orig.isFixed) : false;
  let reservationMinutes = keepFixedTime ? orig.reservationMinutes : null;

  if (!isFixed && targetDay.events.length > 0) {
    const last = targetDay.events[targetDay.events.length - 1];
    const travel = getTravelMinutesBetweenEvents(last, orig, targetDay.location || '');
    startMins = roundUpToSlot(last.startMinutes + last.durationMinutes + travel, TIME_SLOT_STEP);
  }

  const clone = {
    ...orig,
    id: newId,
    startMinutes: clampMinutes(startMins),
    durationMinutes: orig.durationMinutes,
    time: formatTimeWindow(startMins, orig.durationMinutes),
    isFixed,
    reservationMinutes,
    completed: false
  };

  targetDay.events.push(clone);
  if (isFixed) {
    targetDay.events.sort((a, b) => a.startMinutes - b.startMinutes);
    rippleFlexibleActivitiesFrom(targetDay, 0);
  }
  return clone;
}

/**
 * One-Click Auto-Fit: Resolves schedule conflicts in a day while keeping all Fixed Time stops locked
 */
export function autoFitDaySchedule(day) {
  if (!day || !Array.isArray(day.events) || day.events.length < 2) return 0;
  normalizeDaySchedules(day);

  const dayHint = day.location || '';
  const fixedEvents = day.events.filter((e) => e.isFixed || e.reservationMinutes !== null)
    .sort((a, b) => a.startMinutes - b.startMinutes);
  const flexEvents = day.events.filter((e) => !e.isFixed && e.reservationMinutes === null);

  if (flexEvents.length === 0) return 0;

  let changes = 0;

  // First try rippling flexible items cleanly in current order
  const firstStart = Math.min(...day.events.map((e) => e.startMinutes));
  let cursor = firstStart;
  let lastLocated = null;

  const placed = [];
  const fixedQueue = [...fixedEvents];

  // Place flexible items around fixed anchors
  for (const flex of flexEvents) {
    const travelFromLast = lastLocated && flex.location
      ? getTravelMinutesBetweenEvents(lastLocated, flex, dayHint)
      : 0;
    let candidateStart = roundUpToSlot(cursor + travelFromLast, TIME_SLOT_STEP);

    // Check if candidate collides with upcoming fixed events
    while (fixedQueue.length > 0) {
      const nextFixed = fixedQueue[0];
      const travelToFixed = flex.location && nextFixed.location
        ? getTravelMinutesBetweenEvents(flex, nextFixed, dayHint)
        : 0;

      if (candidateStart + flex.durationMinutes + travelToFixed <= nextFixed.startMinutes) {
        break; // Fits comfortably before the fixed event!
      }

      // Otherwise place the fixed event first and advance cursor past it
      placed.push(nextFixed);
      fixedQueue.shift();
      cursor = Math.max(cursor, nextFixed.startMinutes + nextFixed.durationMinutes);
      if (nextFixed.location) lastLocated = nextFixed;

      const newTravel = lastLocated && flex.location
        ? getTravelMinutesBetweenEvents(lastLocated, flex, dayHint)
        : 0;
      candidateStart = roundUpToSlot(cursor + newTravel, TIME_SLOT_STEP);
    }

    if (flex.startMinutes !== candidateStart) {
      flex.startMinutes = clampMinutes(candidateStart);
      flex.time = formatTimeWindow(flex.startMinutes, flex.durationMinutes);
      changes++;
    }
    placed.push(flex);
    cursor = flex.startMinutes + flex.durationMinutes;
    if (flex.location) lastLocated = flex;
  }

  // Append any remaining fixed events
  while (fixedQueue.length > 0) {
    placed.push(fixedQueue.shift());
  }

  day.events = placed;
  return changes;
}

/**
 * ============================================================================
 * 4. DAY & TRIP TRAVEL ANALYTICS + CONFLICT WARNING ENGINE
 * ============================================================================
 */

export function analyzeDayTimeline(day) {
  const result = {
    legsByEventId: new Map(),
    warningsByEventId: new Map(),
    totalDistanceMiles: 0,
    totalTravelMinutes: 0,
    warningCount: 0,
    completedCount: 0,
    totalEvents: 0
  };

  if (!day || !Array.isArray(day.events)) return result;
  normalizeDaySchedules(day);

  const dayHint = day.location || '';
  result.totalEvents = day.events.length;

  let lastLocatedEvent = null;

  day.events.forEach((ev, idx) => {
    if (ev.completed) result.completedCount++;

    const prevEv = idx > 0 ? day.events[idx - 1] : null;
    const prevEnd = prevEv ? prevEv.startMinutes + prevEv.durationMinutes : null;

    // 1. Travel leg from last known located stop to current located stop
    let travelMinsForCheck = 0;
    if (ev.location && ev.location.trim()) {
      if (lastLocatedEvent && lastLocatedEvent.location.trim()) {
        const leg = getCachedTravelLeg(lastLocatedEvent.location, ev.location, dayHint);
        if (leg) {
          const availableMinutes = prevEnd !== null ? ev.startMinutes - prevEnd : null;
          const neededTravel = Number.isFinite(leg.durationMinutes) ? leg.durationMinutes : 0;
          travelMinsForCheck = neededTravel;

          if (Number.isFinite(leg.distanceMiles)) {
            result.totalDistanceMiles += leg.distanceMiles;
          }
          if (Number.isFinite(leg.durationMinutes)) {
            result.totalTravelMinutes += leg.durationMinutes;
          }

          let shortageMinutes = 0;
          let hasWarning = false;
          let warningMessage = '';

          if (availableMinutes !== null && neededTravel > 0 && availableMinutes < neededTravel) {
            shortageMinutes = neededTravel - availableMinutes;
            hasWarning = true;
            const arrivalMins = prevEnd + neededTravel;
            warningMessage = `Not enough travel time: short by ${formatDuration(shortageMinutes)} (est. arrival ${formatMinutesTo12h(arrivalMins)} vs. ${formatMinutesTo12h(ev.startMinutes)})`;
          }

          result.legsByEventId.set(ev.id, {
            ...leg,
            availableMinutes,
            shortageMinutes,
            hasWarning,
            warningMessage
          });
        }
      }
      lastLocatedEvent = ev;
    }

    // 2. Schedule overlap / insufficient gap warning
    if (prevEnd !== null) {
      const gap = ev.startMinutes - prevEnd;
      if (gap < 0) {
        const overlapMins = Math.abs(gap) + travelMinsForCheck;
        result.warningsByEventId.set(ev.id, {
          shortageMinutes: overlapMins,
          type: 'overlap',
          message: ev.isFixed
            ? `Schedule conflict with Fixed Time (${formatMinutesTo12h(ev.startMinutes)}): previous stop runs ${formatDuration(Math.abs(gap))} over${travelMinsForCheck > 0 ? ` + ${formatDuration(travelMinsForCheck)} travel` : ''}.`
            : `Overlaps previous activity by ${formatDuration(Math.abs(gap))}${travelMinsForCheck > 0 ? ` (+ ${formatDuration(travelMinsForCheck)} travel)` : ''}.`
        });
        result.warningCount++;
      } else if (travelMinsForCheck > 0 && gap < travelMinsForCheck) {
        const shortBy = travelMinsForCheck - gap;
        result.warningsByEventId.set(ev.id, {
          shortageMinutes: shortBy,
          type: 'travel',
          message: `Tight transit: ${formatDuration(gap)} gap for ${formatDuration(travelMinsForCheck)} travel (short by ${formatDuration(shortBy)}).`
        });
        result.warningCount++;
      }
    }
  });

  result.totalDistanceMiles = Number(result.totalDistanceMiles.toFixed(1));
  return result;
}

export function analyzeTripTimeline(trip) {
  const summary = {
    totalDistanceMiles: 0,
    totalTravelMinutes: 0,
    warningCount: 0,
    completedCount: 0,
    totalEvents: 0,
    perDay: new Map()
  };

  if (!trip || !Array.isArray(trip.days)) return summary;

  trip.days.forEach((day) => {
    const dayStats = analyzeDayTimeline(day);
    summary.perDay.set(day.id, dayStats);
    summary.totalDistanceMiles += dayStats.totalDistanceMiles;
    summary.totalTravelMinutes += dayStats.totalTravelMinutes;
    summary.warningCount += dayStats.warningCount;
    summary.completedCount += dayStats.completedCount;
    summary.totalEvents += dayStats.totalEvents;
  });

  summary.totalDistanceMiles = Number(summary.totalDistanceMiles.toFixed(1));
  return summary;
}