/**
 * ============================================================================
 * SPATIAL TRIPOS · SMART TIMELINE, RIPPLE SCHEDULER & LIVE TRAVEL ENGINE (V3)
 * ============================================================================
 * Handles:
 *  1. Structured 15-minute Time Slots, Point-in-Time (0 min) stops & migration
 *  2. Flexible Ripple Auto-Adjustment & Fixed Time / Reservation anchoring
 *  3. Exact Street-Address Geocoding (Nominatim house-number priority + strict
 *     Photon ZIP/city/house validation) & Live Address Autocomplete / Verification
 *  4. Real Walking (OSRM Foot) vs Driving (OSRM Car) routing + per-leg toggle
 *  5. Previous-Day End Location inheritance + accurate Day & Trip Travel totals
 * ============================================================================
 */

export const TIME_SLOT_STEP = 15; // 15-minute increments
export const MIN_SLOT_MINUTES = 0; // 12:00 AM
export const MAX_SLOT_MINUTES = 23 * 60 + 45; // 11:45 PM

export const DURATION_OPTIONS = [
  { value: 0, label: 'None (Point in time)' },
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
 * Built-in Coordinate Dictionary (Only used for bare city/landmark names or last-resort fallback)
 */
const PRESET_COORDINATES = {
  'west covina': { lat: 34.0686, lng: -117.9390 },
  'la puente': { lat: 34.0200, lng: -117.9495 },
  'rancho cucamonga': { lat: 34.1064, lng: -117.5931 },
  'ontario': { lat: 34.0633, lng: -117.6509 },
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
    return { startMinutes: roundNearestSlot(start), durationMinutes: 0 };
  }

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

export function normalizeEventSchedule(ev, fallbackStartMins = 9 * 60) {
  if (!ev || typeof ev !== 'object') return ev;

  const hasValidStart = ev.startMinutes !== null && ev.startMinutes !== undefined && ev.startMinutes !== '' && Number.isFinite(Number(ev.startMinutes));
  const hasValidDur = ev.durationMinutes !== null && ev.durationMinutes !== undefined && ev.durationMinutes !== '' && Number.isFinite(Number(ev.durationMinutes));

  if (!hasValidStart || !hasValidDur) {
    const parsed = parseTimeStringToWindow(ev.time, fallbackStartMins);
    ev.startMinutes = hasValidStart ? clampMinutes(ev.startMinutes) : parsed.startMinutes;
    if (hasValidDur) {
      const numDur = Number(ev.durationMinutes);
      ev.durationMinutes = numDur <= 0 ? 0 : Math.max(15, Math.round(numDur / 15) * 15);
    } else {
      ev.durationMinutes = parsed.durationMinutes;
    }
  } else {
    ev.startMinutes = clampMinutes(ev.startMinutes);
    const numDur = Number(ev.durationMinutes);
    ev.durationMinutes = numDur <= 0 ? 0 : Math.max(15, Math.round(numDur / 15) * 15);
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
  ev.travelMode = ['auto', 'drive', 'walk'].includes(ev.travelMode) ? ev.travelMode : 'auto';
  if (ev.locationCoords && (!Number.isFinite(Number(ev.locationCoords.lat)) || !Number.isFinite(Number(ev.locationCoords.lng)))) {
    ev.locationCoords = null;
  }
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
 * 2. VERIFIED GEOCODING, AUTOCOMPLETE & REAL WALK/DRIVE ROUTING ENGINE (V3)
 * ============================================================================
 */

const STORAGE_GEO_KEY = 'tripos_geo_cache_v3';
const STORAGE_ROUTE_KEY = 'tripos_route_cache_v3';

const geoMemoryCache = new Map();
const routeMemoryCache = new Map();
const failedRouteKeys = new Set();
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
    const entries = Array.from(map.entries()).slice(-240);
    window.localStorage?.setItem(key, JSON.stringify(Object.fromEntries(entries)));
  } catch (err) {
    // Ignore storage quota errors
  }
}

loadCacheFromStorage(STORAGE_GEO_KEY, geoMemoryCache);
loadCacheFromStorage(STORAGE_ROUTE_KEY, routeMemoryCache);

// Remove old mis-pinned v1/v2 caches cleanly
try {
  window.localStorage?.removeItem('tripos_geo_cache_v1');
  window.localStorage?.removeItem('tripos_route_cache_v1');
  window.localStorage?.removeItem('tripos_geo_cache_v2');
  window.localStorage?.removeItem('tripos_route_cache_v2');
} catch (err) {
  // Ignore
}

async function fetchJsonWithTimeout(url, timeoutMs = 5500, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeLocKey(str) {
  return String(str || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function cleanAddressText(raw) {
  return String(raw || '')
    .trim()
    .replace(/\b(St|Ave|Dr|Blvd|Rd|Ln|Ct|Pl|Pkwy|Hwy|Ste|Apt)\.(?=\s|,|$)/gi, '$1')
    .replace(/,\s*,+/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/,\s*(\d{5}(?:-\d{4})?)\b/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLocationText(rawLoc) {
  const trimmed = String(rawLoc || '').trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) return cleanAddressText(trimmed);

  const atMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return `${atMatch[1]},${atMatch[2]}`;
  try {
    const u = new URL(trimmed);
    const q = u.searchParams.get('query') || u.searchParams.get('q');
    if (q) return cleanAddressText(decodeURIComponent(q));
  } catch (err) {
    // Ignore invalid URL
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

function looksLikeStreetAddress(str) {
  return /^\d+\s+\S/.test(String(str || '').trim());
}

function hasCityOrRegion(str) {
  const s = String(str || '').trim();
  if (s.includes(',')) return true;
  if (/\b\d{5}(?:-\d{4})?\b/.test(s)) return true;
  if (/\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/.test(s)) {
    return true;
  }
  return false;
}

function parseExpectedAddressParts(cleaned) {
  const str = String(cleaned || '').trim();
  const houseMatch = str.match(/^(\d+[A-Za-z]?)\s+([^,]+)/);
  const zipMatch = str.match(/\b(\d{5})(?:-\d{4})?\b/);
  const parts = str.split(',').map((p) => p.trim()).filter(Boolean);

  let city = '';
  if (parts.length >= 2) {
    city = parts[1]
      .replace(/\b[A-Z]{2}\b/g, '')
      .replace(/\b\d{5}(?:-\d{4})?\b/g, '')
      .trim()
      .toLowerCase();
  }

  let streetCore = '';
  if (houseMatch) {
    streetCore = houseMatch[2]
      .toLowerCase()
      .replace(/\b(avenue|ave|street|st|drive|dr|boulevard|blvd|road|rd|lane|ln|court|ct|place|pl|parkway|pkwy|way|circle|cir|north|south|east|west|n|s|e|w)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return {
    houseNumber: houseMatch ? houseMatch[1].toLowerCase() : '',
    streetCore,
    city,
    zip: zipMatch ? zipMatch[1] : ''
  };
}

function extractCityFallback(cleanedAddress) {
  const parts = String(cleanedAddress || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const remainder = parts.slice(1).join(', ').trim();
    const cityOnly = parts[1].replace(/\b[A-Z]{2}\b/g, '').replace(/\b\d{5}(?:-\d{4})?\b/g, '').trim();
    return { remainder, cityOnly };
  }
  return { remainder: '', cityOnly: '' };
}

function lookupPresetCoordinates(rawQuery) {
  const q = normalizeLocKey(rawQuery);
  if (!q) return null;
  if (PRESET_COORDINATES[q]) return PRESET_COORDINATES[q];

  let bestKey = '';
  for (const key of Object.keys(PRESET_COORDINATES)) {
    if (q.includes(key) && key.length > bestKey.length) {
      bestKey = key;
    }
  }
  return bestKey ? PRESET_COORDINATES[bestKey] : null;
}

function formatCandidateLabel(c) {
  const line1 = c.name && (!c.houseNumber || !c.street)
    ? c.name
    : [c.houseNumber, c.street].filter(Boolean).join(' ').trim() || c.name || '';
  const stateZip = [c.stateShort || c.state, c.postcode].filter(Boolean).join(' ').trim();
  const segments = [line1, c.city, stateZip].filter(Boolean);
  if (segments.length >= 2) return segments.join(', ');
  return c.displayName || line1 || '';
}

const US_STATE_ABBR = {
  california: 'CA', nevada: 'NV', arizona: 'AZ', utah: 'UT', oregon: 'OR', washington: 'WA',
  texas: 'TX', florida: 'FL', 'new york': 'NY', colorado: 'CO', hawaii: 'HI', illinois: 'IL',
  georgia: 'GA', massachusetts: 'MA', virginia: 'VA', 'north carolina': 'NC', tennessee: 'TN'
};

function toStateShort(stateStr) {
  const s = String(stateStr || '').trim();
  if (s.length === 2) return s.toUpperCase();
  return US_STATE_ABBR[s.toLowerCase()] || s;
}

function parseNominatimCandidate(item) {
  const lat = Number(item?.lat);
  const lng = Number(item?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const addr = item.address || {};
  const city = addr.city || addr.town || addr.village || addr.hamlet || addr.municipality || '';
  const state = addr.state || '';
  const postcode = String(addr.postcode || '').split('-')[0].trim();
  const houseNumber = String(addr.house_number || '').trim();
  const street = addr.road || addr.pedestrian || addr.footway || '';
  const name = item.name || addr.amenity || addr.tourism || addr.hotel || addr.leisure || '';

  const cand = {
    lat,
    lng,
    name,
    houseNumber,
    street,
    city,
    state,
    stateShort: toStateShort(state),
    postcode,
    displayName: item.display_name || '',
    source: 'nominatim'
  };
  cand.formatted = formatCandidateLabel(cand);
  return cand;
}

function parsePhotonCandidate(feature) {
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const p = feature.properties || {};
  const city = p.city || p.town || p.village || p.locality || p.county || '';
  const state = p.state || '';
  const postcode = String(p.postcode || '').split('-')[0].trim();
  const houseNumber = String(p.housenumber || '').trim();
  const street = p.street || '';
  const name = p.name || '';

  const cand = {
    lat,
    lng,
    name,
    houseNumber,
    street,
    city,
    state,
    stateShort: toStateShort(state),
    postcode,
    displayName: [name, [houseNumber, street].filter(Boolean).join(' '), city, state, postcode].filter(Boolean).join(', '),
    source: 'photon'
  };
  cand.formatted = formatCandidateLabel(cand);
  return cand;
}

function scoreCandidate(cand, expected) {
  let score = 0;
  const dispLow = normalizeLocKey(cand.displayName);
  const candStreetLow = normalizeLocKey(cand.street);
  const candCityLow = normalizeLocKey(cand.city);
  const candHouseLow = normalizeLocKey(cand.houseNumber);
  const candZip = String(cand.postcode || '').slice(0, 5);

  if (expected.houseNumber) {
    if (candHouseLow && candHouseLow === expected.houseNumber) {
      score += 65; // Exact house number match!
    } else if (candHouseLow && candHouseLow !== expected.houseNumber) {
      score -= 40; // Wrong house number
    } else {
      score -= 22; // No house number (dropped on street midpoint — causes 2.8 mi bug!)
    }
  }

  if (expected.streetCore) {
    if (candStreetLow.includes(expected.streetCore) || dispLow.includes(expected.streetCore)) {
      score += 25;
    } else {
      score -= 20;
    }
  }

  if (expected.zip) {
    if (candZip && candZip === expected.zip) {
      score += 40;
    } else if (candZip && candZip !== expected.zip) {
      score -= 50;
    }
  }

  if (expected.city) {
    if (candCityLow === expected.city || candCityLow.includes(expected.city) || dispLow.includes(expected.city)) {
      score += 25;
    } else {
      score -= 35;
    }
  }

  return score;
}

// Polite Nominatim queue (respects 1 req/sec policy so we never get 429 blocked)
let nominatimQueue = Promise.resolve();
function queryNominatimCandidates(query, limit = 5) {
  const run = async () => {
    await new Promise((r) => setTimeout(r, 420));
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=${limit}&q=${encodeURIComponent(query)}`;
    const list = await fetchJsonWithTimeout(url, 6000, { headers: { Accept: 'application/json' } });
    if (!Array.isArray(list)) return [];
    return list.map(parseNominatimCandidate).filter(Boolean);
  };
  const next = nominatimQueue.then(run, run);
  nominatimQueue = next.catch(() => []);
  return next;
}

async function queryPhotonCandidates(query, limit = 6) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit}`;
  const data = await fetchJsonWithTimeout(url, 5000);
  const features = data?.features;
  if (!Array.isArray(features)) return [];
  return features.map(parsePhotonCandidate).filter(Boolean);
}

async function queryOpenMeteoCity(cityQuery) {
  if (!cityQuery) return null;
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityQuery)}&count=1&language=en&format=json`;
  const data = await fetchJsonWithTimeout(url, 4500);
  const place = data?.results?.[0];
  if (place && Number.isFinite(Number(place.latitude)) && Number.isFinite(Number(place.longitude))) {
    return {
      lat: Number(place.latitude),
      lng: Number(place.longitude),
      formatted: [place.name, place.admin1].filter(Boolean).join(', '),
      exactHouseMatch: false
    };
  }
  return null;
}

/**
 * Live Address Autocomplete Suggestions for the Add/Edit Stop Modal
 */
export async function searchAddressSuggestions(rawQuery, dayHint = '') {
  const cleaned = cleanAddressText(rawQuery);
  if (cleaned.length < 3) return [];

  const isStreet = looksLikeStreetAddress(cleaned);
  const hasRegion = hasCityOrRegion(cleaned);
  const queryWithHint = (!hasRegion && dayHint && !normalizeLocKey(cleaned).includes(normalizeLocKey(dayHint)))
    ? `${cleaned}, ${dayHint}`
    : cleaned;

  const expected = parseExpectedAddressParts(cleaned);
  let candidates = [];

  if (isStreet) {
    // Street addresses: query Nominatim (exact US house numbers) + Photon in parallel
    const [nomRes, phoRes] = await Promise.all([
      queryNominatimCandidates(queryWithHint, 5),
      queryPhotonCandidates(queryWithHint, 5)
    ]);
    candidates = [...nomRes, ...phoRes];
  } else {
    // Place/Landmark names: Photon is super fast for POIs; add Nominatim if sparse
    candidates = await queryPhotonCandidates(queryWithHint, 6);
    if (candidates.length < 2) {
      const nomRes = await queryNominatimCandidates(queryWithHint, 4);
      candidates = [...candidates, ...nomRes];
    }
  }

  // Score, deduplicate, and return top 5 verified suggestions
  const scored = candidates
    .map((c) => ({
      ...c,
      score: scoreCandidate(c, expected),
      exactHouseMatch: Boolean(expected.houseNumber && normalizeLocKey(c.houseNumber) === expected.houseNumber)
    }))
    .sort((a, b) => b.score - a.score);

  const unique = [];
  const seenLabels = new Set();

  for (const item of scored) {
    const label = item.formatted || item.displayName;
    const key = normalizeLocKey(label);
    if (!label || seenLabels.has(key)) continue;
    seenLabels.add(key);
    unique.push({
      label,
      sublabel: item.name && !normalizeLocKey(label).includes(normalizeLocKey(item.name)) ? item.name : [item.city, item.stateShort, item.postcode].filter(Boolean).join(', '),
      lat: item.lat,
      lng: item.lng,
      exactHouseMatch: item.exactHouseMatch,
      source: item.source
    });
    if (unique.length >= 5) break;
  }

  return unique;
}

/**
 * Detailed Geocoding with Strict Street-Address Verification
 */
async function geocodeLocationDetailed(rawLoc, dayHint = '') {
  const cleaned = extractLocationText(rawLoc);
  if (!cleaned) return null;

  const direct = parseDirectCoords(cleaned);
  if (direct) {
    return { ...direct, formatted: cleaned, exactHouseMatch: true };
  }

  const normKey = normalizeLocKey(cleaned);
  if (geoMemoryCache.has(normKey)) {
    return geoMemoryCache.get(normKey);
  }

  const isStreet = looksLikeStreetAddress(cleaned);

  // Only short single-word/city presets skip network
  if (!isStreet) {
    const exactPreset = PRESET_COORDINATES[normKey];
    if (exactPreset) {
      const res = { ...exactPreset, formatted: cleaned, exactHouseMatch: false };
      geoMemoryCache.set(normKey, res);
      return res;
    }
  }

  if (pendingGeoRequests.has(normKey)) return pendingGeoRequests.get(normKey);

  const promise = (async () => {
    const hasRegion = hasCityOrRegion(cleaned);
    const primaryQuery = (!hasRegion && dayHint && !normKey.includes(normalizeLocKey(dayHint)))
      ? `${cleaned}, ${dayHint}`
      : cleaned;

    const expected = parseExpectedAddressParts(cleaned);

    const saveResult = (res) => {
      geoMemoryCache.set(normKey, res);
      saveCacheToStorage(STORAGE_GEO_KEY, geoMemoryCache);
      return res;
    };

    const pickBest = (list) => {
      if (!list.length) return null;
      const ranked = list
        .map((c) => ({
          ...c,
          score: scoreCandidate(c, expected),
          exactHouseMatch: Boolean(expected.houseNumber && normalizeLocKey(c.houseNumber) === expected.houseNumber)
        }))
        .sort((a, b) => b.score - a.score);
      return ranked[0];
    };

    if (isStreet) {
      // 1. Nominatim FIRST for exact US street house numbers (prevents 2.8 mi street-center error!)
      const nomList = await queryNominatimCandidates(primaryQuery, 5);
      const bestNom = pickBest(nomList);
      if (bestNom && (bestNom.exactHouseMatch || bestNom.score >= 45)) {
        return saveResult({
          lat: bestNom.lat,
          lng: bestNom.lng,
          formatted: bestNom.formatted || cleaned,
          exactHouseMatch: bestNom.exactHouseMatch
        });
      }

      // 2. Photon SECOND with strict scoring
      const phoList = await queryPhotonCandidates(primaryQuery, 6);
      const combinedBest = pickBest([...nomList, ...phoList]);
      if (combinedBest && combinedBest.score >= 15) {
        return saveResult({
          lat: combinedBest.lat,
          lng: combinedBest.lng,
          formatted: combinedBest.formatted || cleaned,
          exactHouseMatch: combinedBest.exactHouseMatch
        });
      }
    } else {
      // Non-street landmark / business / city: Photon first, Nominatim second
      const phoList = await queryPhotonCandidates(primaryQuery, 6);
      const bestPho = pickBest(phoList);
      if (bestPho && bestPho.score >= 0) {
        return saveResult({
          lat: bestPho.lat,
          lng: bestPho.lng,
          formatted: bestPho.formatted || cleaned,
          exactHouseMatch: false
        });
      }

      const nomList = await queryNominatimCandidates(primaryQuery, 5);
      const bestNom = pickBest(nomList);
      if (bestNom && bestNom.score >= -10) {
        return saveResult({
          lat: bestNom.lat,
          lng: bestNom.lng,
          formatted: bestNom.formatted || cleaned,
          exactHouseMatch: false
        });
      }
    }

    // 3. City / ZIP fallback so routing never stays broken
    const { remainder, cityOnly } = extractCityFallback(cleaned);
    if (remainder) {
      const remList = await queryPhotonCandidates(remainder, 3);
      if (remList[0]) {
        return saveResult({
          lat: remList[0].lat,
          lng: remList[0].lng,
          formatted: remList[0].formatted || remainder,
          exactHouseMatch: false,
          cityFallback: true
        });
      }
    }
    if (cityOnly) {
      const om = await queryOpenMeteoCity(cityOnly);
      if (om) return saveResult({ ...om, cityFallback: true });
    } else if (!isStreet) {
      const om = await queryOpenMeteoCity(cleaned.split(',')[0].trim());
      if (om) return saveResult({ ...om, cityFallback: true });
    }

    const preset = lookupPresetCoordinates(cleaned);
    if (preset) {
      return saveResult({ ...preset, formatted: cleaned, exactHouseMatch: false, cityFallback: true });
    }

    return null;
  })();

  pendingGeoRequests.set(normKey, promise);
  try {
    return await promise;
  } finally {
    pendingGeoRequests.delete(normKey);
  }
}

/**
 * Verify a user-entered address before saving (used by Add/Edit Stop modal)
 */
export async function verifyAddress(rawLoc, dayHint = '') {
  const cleaned = extractLocationText(rawLoc);
  if (!cleaned) {
    return { verified: false, message: 'Enter an address or place name to verify.' };
  }

  const result = await geocodeLocationDetailed(cleaned, dayHint);
  if (!result) {
    return {
      verified: false,
      message: 'Address not found — try adding the city, state, or ZIP code.'
    };
  }

  const isStreet = looksLikeStreetAddress(cleaned);
  if (isStreet && result.cityFallback) {
    return {
      verified: false,
      partial: true,
      lat: result.lat,
      lng: result.lng,
      formatted: result.formatted,
      message: `Exact street number not found; pinned near ${result.formatted}. Double-check spelling.`
    };
  }

  return {
    verified: true,
    exactHouseMatch: Boolean(result.exactHouseMatch),
    lat: result.lat,
    lng: result.lng,
    formatted: result.formatted || cleaned,
    message: result.exactHouseMatch
      ? `Verified exact address: ${result.formatted || cleaned}`
      : `Verified location: ${result.formatted || cleaned}`
  };
}

export function haversineMiles(a, b) {
  const R = 3958.7613;
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

function estimateFallbackLeg(coordA, coordB, requestedMode = 'auto') {
  const straight = haversineMiles(coordA, coordB);
  if (straight < 0.06) {
    return { distanceMiles: 0, durationMinutes: 0, mode: 'same', estimated: false };
  }

  const useWalk = requestedMode === 'walk' || (requestedMode === 'auto' && straight <= 0.55);
  if (useWalk) {
    const walkMiles = Number((straight * 1.18).toFixed(1));
    return {
      distanceMiles: walkMiles,
      durationMinutes: Math.max(2, Math.round((walkMiles / 3.0) * 60)),
      mode: 'walking',
      estimated: true
    };
  }

  const roadMiles = Number((straight * 1.24).toFixed(1));
  const avgMph = roadMiles < 3 ? 22 : roadMiles < 12 ? 34 : 54;
  const mins = Math.max(3, Math.round((roadMiles / avgMph) * 60) + 2);
  return {
    distanceMiles: roadMiles,
    durationMinutes: mins,
    mode: 'driving',
    estimated: true
  };
}

function buildRouteCacheKey(fromStr, toStr, requestedMode = 'auto') {
  const a = normalizeLocKey(extractLocationText(fromStr));
  const b = normalizeLocKey(extractLocationText(toStr));
  return `${a}__TO__${b}__M_${requestedMode || 'auto'}`;
}

/**
 * Synchronous lookup for immediate UI rendering
 */
export function getCachedTravelLeg(fromLoc, toLoc, requestedMode = 'auto', fromCoords = null, toCoords = null) {
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
      requestedMode,
      status: 'ready'
    };
  }

  const key = buildRouteCacheKey(fromClean, toClean, requestedMode);
  if (routeMemoryCache.has(key)) {
    return {
      fromLocation: fromClean,
      toLocation: toClean,
      requestedMode,
      ...routeMemoryCache.get(key),
      status: 'ready'
    };
  }

  if (failedRouteKeys.has(key)) {
    return {
      fromLocation: fromClean,
      toLocation: toClean,
      distanceMiles: null,
      durationMinutes: null,
      mode: requestedMode === 'walk' ? 'walking' : 'driving',
      requestedMode,
      status: 'unavailable'
    };
  }

  const cachedA = fromCoords || parseDirectCoords(fromClean) || geoMemoryCache.get(normalizeLocKey(fromClean)) || (!looksLikeStreetAddress(fromClean) ? PRESET_COORDINATES[normalizeLocKey(fromClean)] : null);
  const cachedB = toCoords || parseDirectCoords(toClean) || geoMemoryCache.get(normalizeLocKey(toClean)) || (!looksLikeStreetAddress(toClean) ? PRESET_COORDINATES[normalizeLocKey(toClean)] : null);

  if (cachedA && cachedB) {
    const est = estimateFallbackLeg(cachedA, cachedB, requestedMode);
    return {
      fromLocation: fromClean,
      toLocation: toClean,
      requestedMode,
      ...est,
      status: 'estimated'
    };
  }

  return {
    fromLocation: fromClean,
    toLocation: toClean,
    distanceMiles: null,
    durationMinutes: null,
    mode: requestedMode === 'walk' ? 'walking' : 'driving',
    requestedMode,
    status: 'loading'
  };
}

async function resolveRouteLeg(fromLoc, toLoc, dayHint = '', requestedMode = 'auto', fromCoords = null, toCoords = null) {
  const fromClean = extractLocationText(fromLoc);
  const toClean = extractLocationText(toLoc);
  if (!fromClean || !toClean) return null;

  if (normalizeLocKey(fromClean) === normalizeLocKey(toClean)) {
    return { distanceMiles: 0, durationMinutes: 0, mode: 'same', estimated: false };
  }

  const modePref = ['auto', 'drive', 'walk'].includes(requestedMode) ? requestedMode : 'auto';
  const key = buildRouteCacheKey(fromClean, toClean, modePref);
  if (routeMemoryCache.has(key)) return routeMemoryCache.get(key);
  if (pendingRouteRequests.has(key)) return pendingRouteRequests.get(key);

  const promise = (async () => {
    const coordA = fromCoords || await geocodeLocationDetailed(fromClean, dayHint);
    const coordB = toCoords || await geocodeLocationDetailed(toClean, dayHint);

    if (!coordA || !coordB) {
      failedRouteKeys.add(key);
      return null;
    }

    failedRouteKeys.delete(key);

    const straight = haversineMiles(coordA, coordB);
    if (straight < 0.06) {
      const sameRes = { distanceMiles: 0, durationMinutes: 0, mode: 'same', estimated: false };
      routeMemoryCache.set(key, sameRes);
      saveCacheToStorage(STORAGE_ROUTE_KEY, routeMemoryCache);
      return sameRes;
    }

    // Decide Walking vs Driving (Auto uses Walking when <= 0.55 mi straight-line, e.g., 4050 University Ave -> 3649 Mission Inn Ave!)
    const shouldWalk = modePref === 'walk' || (modePref === 'auto' && straight <= 0.55);

    if (shouldWalk) {
      // 1. Try real OSRM Pedestrian Footpath Router
      const footUrl = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coordA.lng},${coordA.lat};${coordB.lng},${coordB.lat}?overview=false`;
      const footData = await fetchJsonWithTimeout(footUrl, 4500);
      const footRoute = footData?.routes?.[0];
      if (footRoute && Number.isFinite(footRoute.distance)) {
        const miles = Number((footRoute.distance / 1609.344).toFixed(1));
        const mins = Math.max(2, Math.round((miles / 3.0) * 60)); // Google-Maps-aligned 3.0 mph walking speed
        const resolved = { distanceMiles: miles, durationMinutes: mins, mode: 'walking', estimated: false };
        routeMemoryCache.set(key, resolved);
        saveCacheToStorage(STORAGE_ROUTE_KEY, routeMemoryCache);
        return resolved;
      }

      // 2. Fallback walking estimate if foot router is busy
      const walkFallback = estimateFallbackLeg(coordA, coordB, 'walk');
      routeMemoryCache.set(key, walkFallback);
      saveCacheToStorage(STORAGE_ROUTE_KEY, routeMemoryCache);
      return walkFallback;
    }

    // Driving mode: Live OSRM Road Router
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordA.lng},${coordA.lat};${coordB.lng},${coordB.lat}?overview=false`;
    const data = await fetchJsonWithTimeout(osrmUrl, 5500);
    const route = data?.routes?.[0];
    if (route && Number.isFinite(route.distance) && Number.isFinite(route.duration)) {
      const miles = Number((route.distance / 1609.344).toFixed(1));
      const mins = Math.max(1, Math.round(route.duration / 60));
      const resolved = { distanceMiles: miles, durationMinutes: mins, mode: 'driving', estimated: false };
      routeMemoryCache.set(key, resolved);
      saveCacheToStorage(STORAGE_ROUTE_KEY, routeMemoryCache);
      return resolved;
    }

    const fallback = estimateFallbackLeg(coordA, coordB, 'drive');
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
 * Helper: Build the ordered list of effective locations & verified coords for a day,
 * automatically inheriting the previous day's ending location for stop #1 if blank.
 */
function resolveDayLocationChain(day, prevDayEnd = { text: '', coords: null }) {
  const events = Array.isArray(day?.events) ? day.events : [];
  const prevText = String(prevDayEnd?.text || '').trim();
  const prevCoords = prevDayEnd?.coords || null;
  let inheritedStartLocation = '';
  let inheritedEventId = null;

  const effectiveEntries = events.map((ev, idx) => {
    const ownLoc = String(ev?.location || '').trim();
    if (ownLoc) {
      return { text: ownLoc, coords: ev.locationCoords || null };
    }
    if (idx === 0 && prevText) {
      inheritedStartLocation = prevText;
      inheritedEventId = ev.id;
      return { text: prevText, coords: prevCoords };
    }
    return { text: '', coords: null };
  });

  let endEntry = { text: prevText, coords: prevCoords };
  for (let i = effectiveEntries.length - 1; i >= 0; i--) {
    if (effectiveEntries[i].text) {
      endEntry = effectiveEntries[i];
      break;
    }
  }

  return {
    effectiveEntries,
    inheritedStartLocation,
    inheritedEventId,
    endEntry
  };
}

/**
 * Resolve all consecutive destination pairs across a trip in the background.
 */
export async function computeTripTravelLegs(trip, onUpdate = () => {}) {
  if (!trip || !Array.isArray(trip.days)) return;

  const jobs = [];
  const seenKeys = new Set();
  let prevDayEnd = { text: '', coords: null };

  trip.days.forEach((day) => {
    const dayHint = day.location || '';
    const { effectiveEntries, endEntry } = resolveDayLocationChain(day, prevDayEnd);

    let lastEntry = null;
    (day.events || []).forEach((ev, idx) => {
      const entry = effectiveEntries[idx];
      if (entry?.text) {
        if (lastEntry && normalizeLocKey(extractLocationText(lastEntry.text)) !== normalizeLocKey(extractLocationText(entry.text))) {
          const modePref = ev.travelMode || 'auto';
          const k = buildRouteCacheKey(lastEntry.text, entry.text, modePref);
          if (!routeMemoryCache.has(k) && !seenKeys.has(k)) {
            seenKeys.add(k);
            failedRouteKeys.delete(k);
            jobs.push({
              from: lastEntry.text,
              to: entry.text,
              fromCoords: lastEntry.coords,
              toCoords: entry.coords,
              hint: dayHint,
              modePref
            });
          }
        }
        lastEntry = entry;
      }
    });

    prevDayEnd = endEntry;
  });

  if (jobs.length === 0) return;

  for (const job of jobs) {
    await resolveRouteLeg(job.from, job.to, job.hint, job.modePref, job.fromCoords, job.toCoords);
    onUpdate();
  }
}

/**
 * ============================================================================
 * 3. SMART RIPPLE AUTO-ADJUSTMENT & DRAG-AND-DROP SCHEDULER
 * ============================================================================
 */

function getTravelMinutesBetweenEvents(prevEv, nextEv) {
  if (!prevEv?.location || !nextEv?.location) return 0;
  const leg = getCachedTravelLeg(
    prevEv.location,
    nextEv.location,
    nextEv.travelMode || 'auto',
    prevEv.locationCoords || null,
    nextEv.locationCoords || null
  );
  if (!leg || !Number.isFinite(leg.durationMinutes)) return 0;
  return leg.durationMinutes;
}

export function rippleFlexibleActivitiesFrom(day, startIndex = 0) {
  if (!day || !Array.isArray(day.events) || day.events.length === 0) return 0;
  normalizeDaySchedules(day);

  let movedCount = 0;

  for (let i = Math.max(0, startIndex); i < day.events.length - 1; i++) {
    const curr = day.events[i];
    const next = day.events[i + 1];

    if (next.isFixed || next.reservationMinutes !== null) continue;

    const travelMins = getTravelMinutesBetweenEvents(curr, next);
    const earliestNextStart = roundUpToSlot(curr.startMinutes + curr.durationMinutes + travelMins, TIME_SLOT_STEP);

    if (next.startMinutes < earliestNextStart) {
      next.startMinutes = clampMinutes(earliestNextStart);
      next.time = formatTimeWindow(next.startMinutes, next.durationMinutes);
      movedCount++;
    }
  }

  return movedCount;
}

export function reorderEventInDay(day, eventId, targetIndex) {
  if (!day || !Array.isArray(day.events)) return { moved: false, shiftedCount: 0 };
  normalizeDaySchedules(day);

  const fromIndex = day.events.findIndex((e) => e.id === eventId);
  if (fromIndex < 0) return { moved: false, shiftedCount: 0 };

  const clampedTarget = Math.max(0, Math.min(day.events.length - 1, targetIndex));
  if (fromIndex === clampedTarget) return { moved: false, shiftedCount: 0 };

  const targetSlotAnchor = day.events[clampedTarget]?.startMinutes ?? 9 * 60;

  const [movedEv] = day.events.splice(fromIndex, 1);
  day.events.splice(clampedTarget, 0, movedEv);

  if (!movedEv.isFixed && movedEv.reservationMinutes === null) {
    if (clampedTarget === 0) {
      movedEv.startMinutes = clampMinutes(targetSlotAnchor);
    } else {
      const prev = day.events[clampedTarget - 1];
      const travel = getTravelMinutesBetweenEvents(prev, movedEv);
      movedEv.startMinutes = roundUpToSlot(prev.startMinutes + prev.durationMinutes + travel, TIME_SLOT_STEP);
    }
    movedEv.time = formatTimeWindow(movedEv.startMinutes, movedEv.durationMinutes);
  }

  const shiftedCount = rippleFlexibleActivitiesFrom(day, clampedTarget);
  return { moved: true, shiftedCount, event: movedEv };
}

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

  day.events.splice(idx, 1);
  let insertIdx = day.events.findIndex((other) => other.startMinutes >= targetStart);
  if (insertIdx === -1) insertIdx = day.events.length;
  day.events.splice(insertIdx, 0, ev);

  const shiftedCount = rippleFlexibleActivitiesFrom(day, insertIdx);
  return { moved: true, shiftedCount, event: ev };
}

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

  if (!movedEv.isFixed && movedEv.reservationMinutes === null) {
    if (insertIdx > 0) {
      const prev = targetDay.events[insertIdx - 1];
      const travel = getTravelMinutesBetweenEvents(prev, movedEv);
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

export function duplicateEventInDay(day, eventId, newId) {
  if (!day || !Array.isArray(day.events)) return null;
  normalizeDaySchedules(day);

  const idx = day.events.findIndex((e) => e.id === eventId);
  if (idx < 0) return null;

  const orig = day.events[idx];
  const stepOffset = orig.durationMinutes > 0 ? orig.durationMinutes : TIME_SLOT_STEP;
  const nextStart = roundUpToSlot(orig.startMinutes + stepOffset, TIME_SLOT_STEP);

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
    const travel = getTravelMinutesBetweenEvents(last, orig);
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

export function autoFitDaySchedule(day) {
  if (!day || !Array.isArray(day.events) || day.events.length < 2) return 0;
  normalizeDaySchedules(day);

  const fixedEvents = day.events
    .filter((e) => e.isFixed || e.reservationMinutes !== null)
    .sort((a, b) => a.startMinutes - b.startMinutes);
  const flexEvents = day.events.filter((e) => !e.isFixed && e.reservationMinutes === null);

  if (flexEvents.length === 0) return 0;

  let changes = 0;
  const firstStart = Math.min(...day.events.map((e) => e.startMinutes));
  let cursor = firstStart;
  let lastLocated = null;

  const placed = [];
  const fixedQueue = [...fixedEvents];

  for (const flex of flexEvents) {
    const travelFromLast = lastLocated && flex.location
      ? getTravelMinutesBetweenEvents(lastLocated, flex)
      : 0;
    let candidateStart = roundUpToSlot(cursor + travelFromLast, TIME_SLOT_STEP);

    while (fixedQueue.length > 0) {
      const nextFixed = fixedQueue[0];
      const travelToFixed = flex.location && nextFixed.location
        ? getTravelMinutesBetweenEvents(flex, nextFixed)
        : 0;

      if (candidateStart + flex.durationMinutes + travelToFixed <= nextFixed.startMinutes) {
        break;
      }

      placed.push(nextFixed);
      fixedQueue.shift();
      cursor = Math.max(cursor, nextFixed.startMinutes + nextFixed.durationMinutes);
      if (nextFixed.location) lastLocated = nextFixed;

      const newTravel = lastLocated && flex.location
        ? getTravelMinutesBetweenEvents(lastLocated, flex)
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

export function analyzeDayTimeline(day, prevDayEnd = { text: '', coords: null }) {
  const prevObj = typeof prevDayEnd === 'string' ? { text: prevDayEnd, coords: null } : (prevDayEnd || { text: '', coords: null });
  const result = {
    legsByEventId: new Map(),
    warningsByEventId: new Map(),
    totalDistanceMiles: 0,
    totalTravelMinutes: 0,
    warningCount: 0,
    completedCount: 0,
    totalEvents: 0,
    pendingCount: 0,
    inheritedStartLocation: '',
    inheritedEventId: null,
    endEntry: { text: String(prevObj.text || '').trim(), coords: prevObj.coords || null }
  };

  if (!day || !Array.isArray(day.events)) return result;
  normalizeDaySchedules(day);

  const {
    effectiveEntries,
    inheritedStartLocation,
    inheritedEventId,
    endEntry
  } = resolveDayLocationChain(day, prevObj);

  result.inheritedStartLocation = inheritedStartLocation;
  result.inheritedEventId = inheritedEventId;
  result.endEntry = endEntry;
  result.totalEvents = day.events.length;

  let lastLocatedIndex = -1;
  let lastLocatedEntry = null;

  day.events.forEach((ev, idx) => {
    if (ev.completed) result.completedCount++;

    const prevEv = idx > 0 ? day.events[idx - 1] : null;
    const prevEnd = prevEv ? prevEv.startMinutes + prevEv.durationMinutes : null;
    const effEntry = effectiveEntries[idx];

    let travelMinsForDirectCheck = 0;

    if (effEntry?.text) {
      if (lastLocatedEntry?.text) {
        const leg = getCachedTravelLeg(
          lastLocatedEntry.text,
          effEntry.text,
          ev.travelMode || 'auto',
          lastLocatedEntry.coords,
          effEntry.coords
        );
        if (leg) {
          const isDirectPrev = lastLocatedIndex === idx - 1;
          const neededTravel = Number.isFinite(leg.durationMinutes) ? leg.durationMinutes : 0;

          if (leg.status === 'loading') {
            result.pendingCount++;
          }
          if (Number.isFinite(leg.distanceMiles)) {
            result.totalDistanceMiles += leg.distanceMiles;
          }
          if (Number.isFinite(leg.durationMinutes)) {
            result.totalTravelMinutes += leg.durationMinutes;
          }

          let availableMinutes = null;
          let shortageMinutes = 0;
          let hasWarning = false;
          let warningMessage = '';

          if (isDirectPrev && prevEnd !== null) {
            availableMinutes = ev.startMinutes - prevEnd;
            travelMinsForDirectCheck = neededTravel;
            if (neededTravel > 0 && availableMinutes < neededTravel) {
              shortageMinutes = neededTravel - availableMinutes;
              hasWarning = true;
              const arrivalMins = prevEnd + neededTravel;
              warningMessage = `Not enough travel time: short by ${formatDuration(shortageMinutes)} (est. arrival ${formatMinutesTo12h(arrivalMins)} vs. ${formatMinutesTo12h(ev.startMinutes)})`;
            }
          }

          result.legsByEventId.set(ev.id, {
            ...leg,
            eventId: ev.id,
            dayId: day.id,
            skippedUnlocatedStops: !isDirectPrev,
            availableMinutes,
            shortageMinutes,
            hasWarning,
            warningMessage
          });
        }
      }
      lastLocatedIndex = idx;
      lastLocatedEntry = effEntry;
    }

    if (prevEnd !== null) {
      const gap = ev.startMinutes - prevEnd;
      if (gap < 0) {
        const overlapMins = Math.abs(gap) + travelMinsForDirectCheck;
        result.warningsByEventId.set(ev.id, {
          shortageMinutes: overlapMins,
          type: 'overlap',
          message: ev.isFixed
            ? `Schedule conflict with Fixed Time (${formatMinutesTo12h(ev.startMinutes)}): previous stop runs ${formatDuration(Math.abs(gap))} over${travelMinsForDirectCheck > 0 ? ` + ${formatDuration(travelMinsForDirectCheck)} travel` : ''}.`
            : `Overlaps previous activity by ${formatDuration(Math.abs(gap))}${travelMinsForDirectCheck > 0 ? ` (+ ${formatDuration(travelMinsForDirectCheck)} travel)` : ''}.`
        });
        result.warningCount++;
      } else if (travelMinsForDirectCheck > 0 && gap < travelMinsForDirectCheck) {
        const shortBy = travelMinsForDirectCheck - gap;
        result.warningsByEventId.set(ev.id, {
          shortageMinutes: shortBy,
          type: 'travel',
          message: `Tight transit: ${formatDuration(gap)} gap for ${formatDuration(travelMinsForDirectCheck)} travel (short by ${formatDuration(shortBy)}).`
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
    pendingCount: 0,
    perDay: new Map()
  };

  if (!trip || !Array.isArray(trip.days)) return summary;

  let prevDayEnd = { text: '', coords: null };

  trip.days.forEach((day) => {
    const dayStats = analyzeDayTimeline(day, prevDayEnd);
    summary.perDay.set(day.id, dayStats);
    summary.totalDistanceMiles += dayStats.totalDistanceMiles;
    summary.totalTravelMinutes += dayStats.totalTravelMinutes;
    summary.warningCount += dayStats.warningCount;
    summary.completedCount += dayStats.completedCount;
    summary.totalEvents += dayStats.totalEvents;
    summary.pendingCount += dayStats.pendingCount;
    if (dayStats.endEntry?.text) {
      prevDayEnd = dayStats.endEntry;
    }
  });

  summary.totalDistanceMiles = Number(summary.totalDistanceMiles.toFixed(1));
  return summary;
}