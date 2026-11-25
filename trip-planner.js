import {
  normalizeTripSchedules,
  computeTripTravelLegs
} from './trip-timeline-engine.js';

/**
 * ============================================================================
 * SPATIAL TRIPOS · CORE STORE, LIVE WEATHER (DAY/NIGHT) & CAROUSEL ENGINE
 * ============================================================================
 */

export const ICONS = {
  plus: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  newTrip: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"/><path d="M19 16v5M16.5 18.5h5"/></svg>`,
  trips: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z"/><path d="M9 4v13M15 7v13"/></svg>`,
  edit: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  trash: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  check: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  close: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
  chevronLeft: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  chevronRight: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
  chevronDown: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  arrowUp: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`,
  arrowDown: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
  grip: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>`,
  lock: `<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  unlock: `<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
  copy: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  copyToDay: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="14" rx="2"/><path d="M21 8v11a2 2 0 0 1-2 2H8"/><path d="M10 11h4M12 9v4"/></svg>`,
  pin: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  link: `<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  clock: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  calendarClock: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4M8 2v4M3 10h5"/><circle cx="17.5" cy="17.5" r="4.5"/><path d="M17.5 15.5v2l1.5 1"/></svg>`,
  route: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>`,
  drive: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`,
  walk: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="2"/><path d="m10 21 2-6 3 2v4"/><path d="m8 13 3-4 4 2 3-1"/><path d="m7 21 2-5"/></svg>`,
  alert: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  wand: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="m15 4-1 1 5 5 1-1a2.83 2.83 0 1 0-4-4Z"/><path d="m13 6-8.5 8.5a2.12 2.12 0 1 0 3 3L16 9"/><path d="M8 2v2M2 8h2M20 14v2M14 20h2"/></svg>`,
  info: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  globe: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  receipt: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>`,
  save: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  categories: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>`,
  hotel: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/></svg>`,
  food: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
  sparkle: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>`,
  explore: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
  stop: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z"/></svg>`,
  camera: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
  star: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  ticket: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/></svg>`,
  flight: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>`,
  bag: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  coffee: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
  sun: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`,
  moon: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
  cloud: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`,
  partly: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/></svg>`,
  rain: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>`,
  snow: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M8 15h.01"/><path d="M8 19h.01"/><path d="M12 17h.01"/><path d="M12 21h.01"/><path d="M16 15h.01"/><path d="M16 19h.01"/></svg>`,
  storm: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/></svg>`,
  web: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`
};

export const LINK_ICON_META = {
  ticket: { label: 'Tickets & Attractions', icon: 'ticket', style: 'bg-orange-500/20 border-orange-400/35 text-orange-300' },
  hotel: { label: 'Hotel & Stay', icon: 'hotel', style: 'bg-indigo-500/20 border-indigo-400/35 text-indigo-300' },
  food: { label: 'Dining & Reservations', icon: 'food', style: 'bg-amber-500/20 border-amber-400/35 text-amber-300' },
  explore: { label: 'Park & Sightseeing', icon: 'explore', style: 'bg-emerald-500/20 border-emerald-400/35 text-emerald-300' },
  web: { label: 'Official Website', icon: 'web', style: 'bg-sky-500/20 border-sky-400/35 text-sky-300' }
};

export const CATEGORY_META = {
  drive: {
    label: 'Drive / Transit',
    icon: 'drive',
    anim: 'cat-anim-glide',
    color: 'bg-sky-500/20 border-sky-400/35 text-sky-300',
    ambient: 'bg-gradient-to-r from-sky-400/70 to-transparent',
    rgb: [56, 189, 248]
  },
  hotel: {
    label: 'Hotel / Rest',
    icon: 'hotel',
    anim: 'cat-anim-float',
    color: 'bg-indigo-500/20 border-indigo-400/35 text-indigo-300',
    ambient: 'bg-gradient-to-r from-indigo-400/70 to-transparent',
    rgb: [129, 140, 248]
  },
  food: {
    label: 'Dining / Food',
    icon: 'food',
    anim: 'cat-anim-steam',
    color: 'bg-amber-500/20 border-amber-400/35 text-amber-300',
    ambient: 'bg-gradient-to-r from-amber-400/70 to-transparent',
    rgb: [251, 191, 36]
  },
  highlight: {
    label: 'Highlight Event',
    icon: 'sparkle',
    anim: 'cat-anim-sparkle',
    color: 'bg-orange-500/20 border-orange-400/35 text-orange-300',
    ambient: 'bg-gradient-to-r from-orange-400/75 to-transparent',
    rgb: [251, 146, 60]
  },
  explore: {
    label: 'Explore / Sightseeing',
    icon: 'explore',
    anim: 'cat-anim-compass',
    color: 'bg-emerald-500/20 border-emerald-400/35 text-emerald-300',
    ambient: 'bg-gradient-to-r from-emerald-400/70 to-transparent',
    rgb: [52, 211, 153]
  },
  stop: {
    label: 'General Stop',
    icon: 'stop',
    anim: 'cat-anim-radar',
    color: 'bg-slate-500/20 border-slate-400/35 text-slate-300',
    ambient: 'bg-gradient-to-r from-slate-300/60 to-transparent',
    rgb: [148, 163, 184]
  }
};

export const CUSTOM_CATEGORY_THEMES = {
  rose: {
    label: 'Rose Pink',
    color: 'bg-rose-500/20 border-rose-400/40 text-rose-300',
    ambient: 'bg-gradient-to-r from-rose-400/75 to-transparent',
    rgb: [251, 113, 133]
  },
  cyan: {
    label: 'Electric Cyan',
    color: 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300',
    ambient: 'bg-gradient-to-r from-cyan-400/75 to-transparent',
    rgb: [34, 211, 238]
  },
  violet: {
    label: 'Royal Violet',
    color: 'bg-violet-500/20 border-violet-400/40 text-violet-300',
    ambient: 'bg-gradient-to-r from-violet-400/75 to-transparent',
    rgb: [167, 139, 250]
  },
  emerald: {
    label: 'Emerald Mint',
    color: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300',
    ambient: 'bg-gradient-to-r from-emerald-400/75 to-transparent',
    rgb: [52, 211, 153]
  },
  amber: {
    label: 'Golden Amber',
    color: 'bg-amber-500/20 border-amber-400/40 text-amber-300',
    ambient: 'bg-gradient-to-r from-amber-400/75 to-transparent',
    rgb: [251, 191, 36]
  },
  orange: {
    label: 'Sunset Coral',
    color: 'bg-orange-500/20 border-orange-400/40 text-orange-300',
    ambient: 'bg-gradient-to-r from-orange-400/75 to-transparent',
    rgb: [251, 146, 60]
  }
};

export const CUSTOM_CATEGORY_ICON_OPTIONS = [
  { key: 'camera', label: 'Photo Spot' },
  { key: 'coffee', label: 'Coffee & Cafe' },
  { key: 'ticket', label: 'Tickets & Show' },
  { key: 'bag', label: 'Shopping' },
  { key: 'flight', label: 'Flight & Airport' },
  { key: 'star', label: 'Must-Do' },
  { key: 'sparkle', label: 'Magic / VIP' },
  { key: 'sun', label: 'Outdoor / Beach' },
  { key: 'food', label: 'Snack / Treat' },
  { key: 'drive', label: 'Road / Parking' },
  { key: 'hotel', label: 'Lounge / Spa' },
  { key: 'explore', label: 'Trail / Adventure' }
];

export const CUSTOM_CATEGORY_ANIM_OPTIONS = [
  { key: 'cat-anim-sparkle', label: 'Sparkle & Glow' },
  { key: 'cat-anim-bounce', label: 'Gentle Bounce' },
  { key: 'cat-anim-float', label: 'Smooth Float' },
  { key: 'cat-anim-radar', label: 'Radar Pulse' },
  { key: 'cat-anim-compass', label: 'Compass Sway' },
  { key: 'cat-anim-steam', label: 'Warm Shimmer' },
  { key: 'cat-anim-glide', label: 'Motion Glide' },
  { key: 'cat-anim-spin', label: 'Slow Orbit' }
];

export const BUDGET_CATEGORY_META = {
  hotel: {
    label: 'Hotel & Stays',
    defaultName: 'Hotels',
    icon: 'hotel',
    style: 'bg-indigo-500/20 border-indigo-400/35 text-indigo-300',
    placeholder: 'e.g. Riverside Hotel (1 night)'
  },
  food: {
    label: 'Dining & Meals',
    defaultName: 'Dining & Restaurants',
    icon: 'food',
    style: 'bg-amber-500/20 border-amber-400/35 text-amber-300',
    placeholder: "e.g. Sherman's Deli lunch"
  },
  ticket: {
    label: 'Tickets & Attractions',
    defaultName: 'Attractions & Tickets',
    icon: 'ticket',
    style: 'bg-orange-500/20 border-orange-400/35 text-orange-300',
    placeholder: 'e.g. Aerial Tramway passes'
  },
  drive: {
    label: 'Gas, Flights & Transit',
    defaultName: 'Gas & Transit',
    icon: 'drive',
    style: 'bg-sky-500/20 border-sky-400/35 text-sky-300',
    placeholder: 'e.g. Fuel fill-up + valet parking'
  },
  bag: {
    label: 'Shopping & Souvenirs',
    defaultName: 'Shopping & Gifts',
    icon: 'bag',
    style: 'bg-emerald-500/20 border-emerald-400/35 text-emerald-300',
    placeholder: 'e.g. Holiday market gifts'
  },
  custom: {
    label: 'Custom Expense',
    defaultName: '',
    icon: 'star',
    style: 'bg-rose-500/20 border-rose-400/35 text-rose-300',
    placeholder: 'e.g. Receipt or booking item'
  }
};

export const REAL_THEME_BACKDROPS = {
  lights: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1920&q=85',
  xmas_lights: 'https://images.unsplash.com/photo-1543589077-47d81606c1bf?auto=format&fit=crop&w=1920&q=85',
  xmas_village: 'https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=1920&q=85',
  desert: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1920&q=85',
  ps_tramway: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=85',
  tram: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=85',
  farm: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1920&q=85',
  beach: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=85',
  canyon: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1920&q=85',
  city: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1920&q=85',
  lake: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?auto=format&fit=crop&w=1920&q=85',
  meadow: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1920&q=85',
  autumn: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1920&q=85'
};

export const REAL_CARD_BACKDROPS = { ...REAL_THEME_BACKDROPS };

/**
 * ============================================================================
 * GENERAL UTILITIES
 * ============================================================================
 */

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36).slice(-4)}`;
}

export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getAllCategories() {
  const merged = { ...CATEGORY_META };
  const customs = appStore?.state?.customCategories || [];
  customs.forEach((c) => {
    const theme = CUSTOM_CATEGORY_THEMES[c.theme] || CUSTOM_CATEGORY_THEMES.cyan;
    merged[c.id] = {
      label: c.label,
      icon: c.icon || 'star',
      anim: c.anim || 'cat-anim-sparkle',
      color: theme.color,
      ambient: theme.ambient,
      rgb: theme.rgb,
      isCustom: true
    };
  });
  return merged;
}

export function getCategoryMeta(catKey) {
  const all = getAllCategories();
  return all[catKey] || CATEGORY_META.stop;
}

export function getStopMapUrl(location) {
  const loc = String(location || '').trim();
  if (!loc) return '';
  if (/^https?:\/\//i.test(loc)) return loc;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`;
}

export function getStopLocationLabel(location) {
  const loc = String(location || '').trim();
  if (!loc) return '';
  if (/^https?:\/\//i.test(loc)) {
    try {
      const u = new URL(loc);
      const q = u.searchParams.get('query') || u.searchParams.get('q');
      if (q) return decodeURIComponent(q);
    } catch (e) {
      // Fall back to clean hostname
    }
    return 'Open in Google Maps';
  }
  return loc;
}

export function inferBudgetCategory(item) {
  if (item?.category && BUDGET_CATEGORY_META[item.category]) return item.category;
  const lbl = String(item?.label || '').toLowerCase();
  if (/hotel|stay|resort|airbnb|night|lodging/.test(lbl)) return 'hotel';
  if (/food|dining|meal|restaurant|lunch|dinner|breakfast|coffee/.test(lbl)) return 'food';
  if (/ticket|pass|museum|tram|park|admission|tour/.test(lbl)) return 'ticket';
  if (/gas|fuel|flight|car|rental|uber|parking|transit/.test(lbl)) return 'drive';
  if (/shop|gift|souvenir|bag/.test(lbl)) return 'bag';
  return 'custom';
}

export function getItemFinalCost(item) {
  if (!item) return null;
  if (Array.isArray(item.finalEntries) && item.finalEntries.length > 0) {
    return item.finalEntries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }
  if (item.final === null || item.final === undefined || item.final === '') return null;
  const n = Number(item.final);
  return Number.isFinite(n) ? n : null;
}

export function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  const borderTone = type === 'error'
    ? 'border-rose-400/50 bg-rose-950/90 text-rose-100'
    : 'border-white/20 bg-[#161923]/92 text-white';
  el.className = `pointer-events-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border backdrop-blur-2xl shadow-2xl text-xs font-semibold animate-popIn ${borderTone}`;
  el.innerHTML = `<span class="${type === 'error' ? 'text-rose-300' : 'text-emerald-300'}">${type === 'error' ? ICONS.alert : ICONS.check}</span><span>${esc(message)}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    el.style.transition = 'all 220ms ease';
    setTimeout(() => el.remove(), 240);
  }, 2600);
}

export async function copyTextToClipboard(text, successMsg = 'Copied!') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMsg);
  } catch (err) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast(successMsg);
  }
}

/**
 * ============================================================================
 * MODAL ENGINE
 * ============================================================================
 */

export function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.classList.remove('flex');
}

export function openModal({ title, bodyHtml, footerButtons = [] }) {
  const overlay = document.getElementById('modalOverlay');
  const titleEl = document.getElementById('modalTitle');
  const bodyEl = document.getElementById('modalBody');
  const footerEl = document.getElementById('modalFooter');
  if (!overlay || !titleEl || !bodyEl || !footerEl) return;

  titleEl.textContent = title || '';
  bodyEl.innerHTML = bodyHtml || '';
  footerEl.innerHTML = '';

  footerButtons.forEach((btnCfg) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    if (btnCfg.id) btn.id = btnCfg.id;
    btn.textContent = btnCfg.label || 'OK';
    btn.className = btnCfg.variant === 'danger'
      ? 'px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs sm:text-sm font-semibold shadow-lg transition-all cursor-pointer'
      : btnCfg.variant === 'primary'
        ? 'px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-sky-500 hover:from-orange-400 hover:to-sky-400 text-white text-xs sm:text-sm font-semibold shadow-lg transition-all cursor-pointer'
        : 'px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white/90 text-xs sm:text-sm font-medium transition-all cursor-pointer';
    btn.addEventListener('click', () => {
      if (typeof btnCfg.onClick === 'function') btnCfg.onClick();
    });
    footerEl.appendChild(btn);
  });

  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
}

export function openConfirmDeleteModal({ title, itemName, detail, confirmLabel = 'Yes, Delete', onConfirm }) {
  openModal({
    title: title || 'Confirm Delete',
    bodyHtml: `
      <div class="space-y-3">
        <div class="rounded-2xl bg-rose-500/12 border border-rose-400/35 p-3.5">
          <div class="text-xs font-bold text-rose-200">${esc(itemName)}</div>
          <p class="text-xs text-white/75 mt-1 leading-relaxed">${esc(detail || 'This action cannot be undone.')}</p>
        </div>
      </div>
    `,
    footerButtons: [
      { label: 'Cancel', onClick: closeModal },
      {
        label: confirmLabel,
        variant: 'danger',
        onClick: () => {
          closeModal();
          if (typeof onConfirm === 'function') onConfirm();
        }
      }
    ]
  });
}

/**
 * ============================================================================
 * DEFAULT TRIP STATE & MULTI-TRIP STORE
 * ============================================================================
 */

export function createInitialState() {
  const trip = {
    id: 'trip-thanksgiving-default',
    meta: {
      title: 'Welcome to your Thanksgiving Getaway',
      subtitle: 'Four days, three nights, three holiday experiences, and a full Palm Springs family day.',
      tripLength: '4 days / 3 nights',
      firstDeparture: 'Friday · 4:00 PM',
      hotelPlan: '3 nights'
    },
    customCategories: [],
    days: [
      {
        id: 'day_1',
        shortDay: 'FRI',
        shortDate: 'Nov 27',
        temp: '68°F',
        location: 'Riverside, CA',
        landmark: 'The Mission Inn Festival of Lights',
        cardLandmark: 'Mission Inn Riverside holiday lights',
        scene: 'xmas_lights',
        useScenePreset: true,
        title: 'Day 1 · Friday, Nov 27',
        subtitle: 'Riverside Arrival & Festival of Lights',
        tag: 'Hotel: Riverside',
        noteTitle: 'Evening Tip',
        noteBody: 'Arrive downtown before 7:15 PM for easier garage parking near Market St & Mission Inn Ave.',
        events: [
          {
            id: 'ev_1_1',
            time: '4:00 PM',
            startMinutes: 16 * 60,
            durationMinutes: 0,
            reservationMinutes: null,
            isFixed: true,
            completed: false,
            category: 'drive',
            location: 'West Covina, CA',
            text: 'Leave home and head east on I-10 toward Downtown Riverside.'
          },
          {
            id: 'ev_1_2',
            time: '5:00–5:45 PM',
            startMinutes: 17 * 60,
            durationMinutes: 45,
            reservationMinutes: null,
            isFixed: false,
            completed: false,
            category: 'hotel',
            location: '3649 Mission Inn Avenue, Riverside, CA 92501',
            text: 'Check in at Riverside hotel, unpack, and rest before evening festivities.'
          },
          {
            id: 'ev_1_3',
            time: '6:00–7:15 PM',
            startMinutes: 18 * 60,
            durationMinutes: 75,
            reservationMinutes: null,
            isFixed: false,
            completed: false,
            category: 'food',
            location: '3649 Mission Inn Avenue, Riverside, CA 92501',
            text: 'Family dinner near Main Street Pedestrian Mall.'
          },
          {
            id: 'ev_1_4',
            time: '7:30–9:00 PM',
            startMinutes: 19 * 60 + 30,
            durationMinutes: 90,
            reservationMinutes: null,
            isFixed: false,
            completed: false,
            category: 'highlight',
            location: '3649 Mission Inn Avenue, Riverside, CA 92501',
            text: 'Walk through the Mission Inn Festival of Lights & Main St holiday market.'
          }
        ]
      },
      {
        id: 'day_2',
        shortDay: 'SAT',
        shortDate: 'Nov 28',
        temp: '74°F',
        location: 'Palm Desert, CA',
        landmark: 'The Living Desert Zoo and Gardens',
        cardLandmark: 'Palm Desert oasis palm trees',
        scene: 'desert',
        useScenePreset: true,
        title: 'Day 2 · Saturday, Nov 28',
        subtitle: 'Desert Wildlife & WildLights Evening',
        tag: 'Hotel: Palm Desert',
        noteTitle: 'Zoo Tip',
        noteBody: 'Feed the giraffes early in the morning before afternoon crowds arrive.',
        events: [
          {
            id: 'ev_2_1',
            time: '9:00–10:15 AM',
            startMinutes: 9 * 60,
            durationMinutes: 75,
            reservationMinutes: null,
            isFixed: false,
            completed: false,
            category: 'drive',
            location: '47900 Portola Ave, Palm Desert, CA 92260',
            text: 'Scenic drive east into the Coachella Valley toward Palm Desert.'
          },
          {
            id: 'ev_2_2',
            time: '10:30 AM–2:30 PM',
            startMinutes: 10 * 60 + 30,
            durationMinutes: 240,
            reservationMinutes: null,
            isFixed: false,
            completed: false,
            category: 'explore',
            location: '47900 Portola Ave, Palm Desert, CA 92260',
            text: 'Explore The Living Desert Zoo & Gardens — African Safari & desert trails.'
          },
          {
            id: 'ev_2_3',
            time: '6:00–8:30 PM',
            startMinutes: 18 * 60,
            durationMinutes: 150,
            reservationMinutes: 18 * 60,
            isFixed: true,
            completed: false,
            category: 'highlight',
            location: '47900 Portola Ave, Palm Desert, CA 92260',
            text: 'Return for WildLights glowing lantern tunnels & holiday train display.'
          }
        ]
      },
      {
        id: 'day_3',
        shortDay: 'SUN',
        shortDate: 'Nov 29',
        temp: '71°F',
        location: 'Palm Springs, CA',
        landmark: 'Palm Springs Aerial Tramway',
        cardLandmark: 'Palm Springs Aerial Tramway mountains',
        scene: 'ps_tramway',
        useScenePreset: true,
        title: 'Day 3 · Sunday, Nov 29',
        subtitle: 'Palm Springs Museums & Mountain Peaks',
        tag: 'Hotel: Palm Springs',
        noteTitle: 'Weather Note',
        noteBody: 'Mountain Station at 8,516 ft is usually 25–30°F cooler than the desert floor — bring warm jackets.',
        events: [
          {
            id: 'ev_3_1',
            time: '10:00–11:45 AM',
            startMinutes: 10 * 60,
            durationMinutes: 105,
            reservationMinutes: null,
            isFixed: false,
            completed: false,
            category: 'explore',
            location: '745 N Gene Autry Trail, Palm Springs, CA 92262',
            text: 'Visit the Palm Springs Air Museum & walk inside historic aircraft.'
          },
          {
            id: 'ev_3_2',
            time: '12:15–1:30 PM',
            startMinutes: 12 * 60 + 15,
            durationMinutes: 75,
            reservationMinutes: null,
            isFixed: false,
            completed: false,
            category: 'food',
            location: "401 E Tahquitz Canyon Way, Palm Springs, CA 92262",
            text: "Lunch at Sherman's Deli & Bakery in downtown Palm Springs."
          },
          {
            id: 'ev_3_3',
            time: '3:00–6:30 PM',
            startMinutes: 15 * 60,
            durationMinutes: 210,
            reservationMinutes: 15 * 60,
            isFixed: true,
            completed: false,
            category: 'highlight',
            location: '1 Tram Way, Palm Springs, CA 92262',
            text: 'Ride the rotating Palm Springs Aerial Tramway up Chino Canyon for sunset.'
          }
        ]
      },
      {
        id: 'day_4',
        shortDay: 'MON',
        shortDate: 'Nov 30',
        temp: '66°F',
        location: 'Cherry Valley, CA',
        landmark: '123 Farm Lavender & Christmas Nights',
        cardLandmark: 'Cherry Valley Christmas lights farm',
        scene: 'xmas_village',
        useScenePreset: true,
        title: 'Day 4 · Monday, Nov 30',
        subtitle: '123 Farm Christmas Nights & Drive Home',
        tag: 'Return Home',
        noteTitle: 'Return Tip',
        noteBody: 'Grab warm lavender hot cocoa at 123 Farm before heading back on I-10 West.',
        events: [
          {
            id: 'ev_4_1',
            time: '4:30–7:00 PM',
            startMinutes: 16 * 60 + 30,
            durationMinutes: 150,
            reservationMinutes: null,
            isFixed: false,
            completed: false,
            category: 'highlight',
            location: '10600 Highland Springs Ave, Cherry Valley, CA 92223',
            text: 'Stroll 123 Farm Christmas Nights illuminated olive groves & artisan market.'
          },
          {
            id: 'ev_4_2',
            time: '7:15–8:30 PM',
            startMinutes: 19 * 60 + 15,
            durationMinutes: 75,
            reservationMinutes: null,
            isFixed: false,
            completed: false,
            category: 'drive',
            location: 'West Covina, CA',
            text: 'Drive west on I-10 back home.'
          }
        ]
      }
    ],
    checklists: [
      {
        id: 'chk_tickets',
        title: 'Tickets & Reservations',
        items: [
          { id: 'c1', text: 'Palm Springs Aerial Tramway timed tickets', done: false },
          { id: 'c2', text: 'The Living Desert WildLights evening passes', done: false },
          { id: 'c3', text: '123 Farm Christmas Nights admission', done: false },
          { id: 'c4', text: 'Confirm hotel check-in details', done: false }
        ]
      },
      {
        id: 'chk_pack',
        title: 'Packing & Gear',
        items: [
          { id: 'c5', text: 'Warm jackets & layers for 8,516 ft mountain peak', done: false },
          { id: 'c6', text: 'Comfortable walking shoes for lights & zoo', done: false },
          { id: 'c7', text: 'Portable phone charger & camera', done: false },
          { id: 'c8', text: 'Sunglasses & daytime desert sunscreen', done: false }
        ]
      }
    ],
    budget: {
      adults: 2,
      kids: 1,
      infants: 0,
      items: [
        { id: 'b1', category: 'hotel', label: 'Hotels (3 Nights)', estimated: 540, final: null, finalEntries: [], note: 'Riverside + Coachella Valley' },
        { id: 'b2', category: 'ticket', label: 'Attractions & Tramway', estimated: 160, final: null, finalEntries: [], note: 'Zoo, Air Museum, Tram & 123 Farm' },
        { id: 'b3', category: 'food', label: 'Dining & Treats', estimated: 160, final: null, finalEntries: [], note: 'Family meals & holiday snacks' },
        { id: 'b4', category: 'drive', label: 'Gas & Parking', estimated: 60, final: null, finalEntries: [], note: 'Round-trip I-10 fuel & garages' }
      ]
    },
    notes: '',
    links: [
      {
        id: 'l1',
        label: 'Mission Inn Festival of Lights',
        url: 'https://www.missioninn.com/festival-of-lights',
        icon: 'ticket',
        location: '3649 Mission Inn Ave, Riverside, CA',
        hours: 'Nightly · 5:00 PM – 10:00 PM',
        info: 'Free outdoor pedestrian walk; arrive early for Main St parking.'
      },
      {
        id: 'l2',
        label: 'Palm Springs Aerial Tramway',
        url: 'https://pstramway.com',
        icon: 'ticket',
        location: '1 Tram Way, Palm Springs, CA',
        hours: 'Daily · 10:00 AM – 8:00 PM',
        info: 'Cars depart every 30 minutes; dress 25°F warmer for Mountain Station.'
      }
    ]
  };

  normalizeTripSchedules(trip);
  return trip;
}

export function createNewDefaultTrip({
  title = 'New Getaway',
  subtitle = 'Custom itinerary ready for your stops and memories.',
  tripLength = '3 days / 2 nights',
  firstDeparture = 'Friday · 9:00 AM',
  hotelPlan = '2 nights',
  startLocation = 'San Diego, CA'
} = {}) {
  const cleanLoc = String(startLocation || 'San Diego, CA').trim();
  const trip = {
    id: uid('trip'),
    meta: { title, subtitle, tripLength, firstDeparture, hotelPlan },
    customCategories: [],
    days: [
      {
        id: uid('day'),
        shortDay: 'DAY 1',
        shortDate: 'Start',
        temp: '--°F',
        location: cleanLoc,
        landmark: cleanLoc,
        cardLandmark: `${cleanLoc} sightseeing`,
        scene: 'beach',
        useScenePreset: true,
        title: `Day 1 · ${cleanLoc}`,
        subtitle: 'Arrival & First Exploration',
        tag: `Hotel: ${cleanLoc}`,
        noteTitle: 'Travel Tip',
        noteBody: 'Add your exact stop addresses below to plot routes and drive times automatically.',
        events: [
          {
            id: uid('ev'),
            time: '10:00–11:30 AM',
            startMinutes: 10 * 60,
            durationMinutes: 90,
            reservationMinutes: null,
            isFixed: false,
            completed: false,
            category: 'explore',
            location: cleanLoc,
            text: `Arrive in ${cleanLoc} and explore the neighborhood.`
          }
        ]
      }
    ],
    checklists: [
      {
        id: uid('chk'),
        title: 'Essentials',
        items: [
          { id: uid('c'), text: 'Confirm hotel & reservations', done: false },
          { id: uid('c'), text: 'Pack chargers & travel documents', done: false }
        ]
      }
    ],
    budget: {
      adults: 2,
      kids: 0,
      infants: 0,
      items: [
        { id: uid('b'), category: 'hotel', label: 'Hotels', estimated: 350, final: null, finalEntries: [], note: '' },
        { id: uid('b'), category: 'food', label: 'Dining', estimated: 150, final: null, finalEntries: [], note: '' }
      ]
    },
    notes: '',
    links: []
  };
  normalizeTripSchedules(trip);
  return trip;
}

const initialTrip = createInitialState();

export const appStore = {
  trips: [initialTrip],
  activeTripId: initialTrip.id,
  state: initialTrip,
  activeCarouselIndex: 0,
  showAllDays: false,
  weatherPanelExpanded: true,
  expandedBudgetIds: new Set(),
  justShiftedEventIds: new Set(),
  justCompletedEventId: null,
  currentBackdropUrl: REAL_THEME_BACKDROPS.xmas_lights
};

export const plannerHooks = {
  renderAll: () => {},
  renderItinerary: () => {},
  openDayModal: () => {},
  confirmDeleteDay: () => {},
  openEventModal: () => {}
};

export function registerPlannerHooks(overrides = {}) {
  Object.assign(plannerHooks, overrides);
}

export function syncActiveTripRef() {
  const found = appStore.trips.find((t) => t.id === appStore.activeTripId) || appStore.trips[0];
  if (found) {
    appStore.activeTripId = found.id;
    appStore.state = found;
    normalizeTripSchedules(appStore.state);
  }
}

export function switchToTrip(tripId, shouldSave = false) {
  const found = appStore.trips.find((t) => t.id === tripId);
  if (!found) return;
  appStore.activeTripId = found.id;
  appStore.state = found;
  normalizeTripSchedules(appStore.state);
  appStore.activeCarouselIndex = 0;
  appStore.showAllDays = false;

  const track = document.getElementById('carouselTrack');
  if (track) track.dataset.dayIds = '';

  updateBackdropForDay(appStore.state.days[0]);
  plannerHooks.renderAll();
  syncLiveWeatherForActiveDay();
  prefetchAllDaysWeather();
  prefetchAllCardPhotos();
  refreshTripTravelRoutes();
  if (shouldSave) scheduleCloudSave();
}

export function getReadinessStats() {
  const groups = appStore.state?.checklists || [];
  let done = 0;
  let total = 0;
  groups.forEach((g) => {
    (g.items || []).forEach((it) => {
      total++;
      if (it.done) done++;
    });
  });
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, percent };
}

/**
 * ============================================================================
 * BACKDROP & SCENE RESOLVER
 * ============================================================================
 */

export function resolveSceneForDay(day) {
  if (!day) return 'lights';
  if (day.scene && REAL_THEME_BACKDROPS[day.scene]) return day.scene;
  const hay = `${day.location || ''} ${day.title || ''} ${day.subtitle || ''}`.toLowerCase();
  if (/tram|mountain|snow|big bear/.test(hay)) return 'ps_tramway';
  if (/desert|palm|joshua/.test(hay)) return 'desert';
  if (/beach|coast|ocean|san diego|santa monica/.test(hay)) return 'beach';
  if (/christmas|holiday|lights|village/.test(hay)) return 'xmas_lights';
  return 'lights';
}

export function getCardPhotoUrl(day) {
  if (!day) return REAL_CARD_BACKDROPS.desert;
  if (day.scene === 'custom' && day.customCardUrl) return day.customCardUrl;
  if (day.resolvedCardPhoto) return day.resolvedCardPhoto;
  return REAL_CARD_BACKDROPS[resolveSceneForDay(day)] || REAL_CARD_BACKDROPS.desert;
}

let activeBgSlot = 'A';
export function updateBackdropForDay(day) {
  const themeKey = resolveSceneForDay(day);
  const nextUrl = (day?.scene === 'custom' && day?.customBgUrl)
    ? day.customBgUrl
    : (day?.resolvedBgPhoto || REAL_THEME_BACKDROPS[themeKey] || REAL_THEME_BACKDROPS.lights);

  appStore.currentBackdropUrl = nextUrl;

  const imgA = document.getElementById('bgPhotoA');
  const imgB = document.getElementById('bgPhotoB');
  if (!imgA || !imgB) return;

  const incoming = activeBgSlot === 'A' ? imgB : imgA;
  const outgoing = activeBgSlot === 'A' ? imgA : imgB;
  if (outgoing.src === nextUrl) return;

  incoming.src = nextUrl;
  incoming.classList.remove('opacity-0');
  incoming.classList.add('opacity-100');
  outgoing.classList.remove('opacity-100');
  outgoing.classList.add('opacity-0');
  activeBgSlot = activeBgSlot === 'A' ? 'B' : 'A';
}

export async function prefetchCardPhotoForDay(day) {
  return getCardPhotoUrl(day);
}

export async function prefetchAllCardPhotos() {
  return true;
}

/**
 * ============================================================================
 * LIVE CLOCK & EXACT-LOCATION 7-DAY WEATHER ENGINE (WITH DAY & NIGHT SCENES)
 * ============================================================================
 */

export function updateClock() {
  const now = new Date();
  const h24 = now.getHours();
  const h12 = h24 % 12 || 12;
  const mins = String(now.getMinutes()).padStart(2, '0');
  const secs = String(now.getSeconds()).padStart(2, '0');
  const period = h24 >= 12 ? 'PM' : 'AM';

  const hEl = document.getElementById('clockHours');
  const mEl = document.getElementById('clockMinutes');
  const sEl = document.getElementById('clockSeconds');
  const pEl = document.getElementById('clockPeriod');

  if (hEl && hEl.textContent !== String(h12)) hEl.textContent = String(h12);
  if (mEl && mEl.textContent !== mins) mEl.textContent = mins;
  if (sEl) sEl.textContent = secs;
  if (pEl) pEl.textContent = period;
}

export function setWeatherPanelExpanded(expanded) {
  appStore.weatherPanelExpanded = Boolean(expanded);
  const wrap = document.getElementById('sevenDayGridWrap');
  const lbl = document.getElementById('toggleWeatherLabel');
  const chev = document.getElementById('toggleWeatherChevron');
  const btn = document.getElementById('toggleWeatherForecastBtn');
  if (!wrap) return;

  wrap.classList.toggle('hidden', !appStore.weatherPanelExpanded);
  if (lbl) lbl.textContent = appStore.weatherPanelExpanded ? 'Hide' : 'Show';
  if (chev) chev.classList.toggle('rotate-180', appStore.weatherPanelExpanded);
  if (btn) btn.setAttribute('aria-expanded', String(appStore.weatherPanelExpanded));
}

const US_STATES_FULL = {
  al: 'alabama', ak: 'alaska', az: 'arizona', ar: 'arkansas', ca: 'california',
  co: 'colorado', ct: 'connecticut', de: 'delaware', fl: 'florida', ga: 'georgia',
  hi: 'hawaii', id: 'idaho', il: 'illinois', in: 'indiana', ia: 'iowa',
  ks: 'kansas', ky: 'kentucky', la: 'louisiana', me: 'maine', md: 'maryland',
  ma: 'massachusetts', mi: 'michigan', mn: 'minnesota', ms: 'mississippi', mo: 'missouri',
  mt: 'montana', ne: 'nebraska', nv: 'nevada', nh: 'new hampshire', nj: 'new jersey',
  nm: 'new mexico', ny: 'new york', nc: 'north carolina', nd: 'north dakota', oh: 'ohio',
  ok: 'oklahoma', or: 'oregon', pa: 'pennsylvania', ri: 'rhode island', sc: 'south carolina',
  sd: 'south dakota', tn: 'tennessee', tx: 'texas', ut: 'utah', vt: 'vermont',
  va: 'virginia', wa: 'washington', wv: 'west virginia', wi: 'wisconsin', wy: 'wyoming',
  dc: 'district of columbia'
};

const weatherGeoCache = new Map();
const weatherForecastCache = new Map();
let activeWeatherSeq = 0;

async function fetchJsonSafe(url, timeoutMs = 5500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve the EXACT location chosen by the user for a day (handles "City, CA",
 * "City, State", "City, Country", ZIP codes, and street addresses).
 */
async function resolveExactWeatherLocation(rawLocation) {
  const raw = String(rawLocation || '').trim();
  if (!raw) return null;

  const cacheKey = raw.toLowerCase().replace(/\s+/g, ' ');
  if (weatherGeoCache.has(cacheKey)) return weatherGeoCache.get(cacheKey);

  // Direct lat,lng support
  const coordMatch = raw.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (coordMatch) {
    const res = { lat: Number(coordMatch[1]), lng: Number(coordMatch[2]), displayName: raw };
    weatherGeoCache.set(cacheKey, res);
    return res;
  }

  // Parse comma-separated segments (e.g., "Palm Springs, CA" or "3649 Mission Inn Ave, Riverside, CA 92501")
  const segments = raw.split(',').map((s) => s.trim()).filter(Boolean);
  let cityQuery = segments[0] || raw;
  let regionHint = '';
  let zipHint = '';

  const zipMatch = raw.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zipMatch) zipHint = zipMatch[1];

  // If the first segment is a full street address (starts with digits), extract the city from segment 2
  const startsWithStreetNumber = /^\d+\s+\S/.test(cityQuery);
  if (startsWithStreetNumber && segments.length >= 2) {
    cityQuery = segments[1].replace(/\b[A-Z]{2}\b/g, '').replace(/\b\d{5}(?:-\d{4})?\b/g, '').trim();
    if (segments.length >= 3) {
      regionHint = segments[2].replace(/\b\d{5}(?:-\d{4})?\b/g, '').trim();
    } else {
      const stInline = segments[1].match(/\b([A-Za-z]{2})\b/);
      if (stInline) regionHint = stInline[1];
    }
  } else if (segments.length >= 2) {
    regionHint = segments[1].replace(/\b\d{5}(?:-\d{4})?\b/g, '').trim();
  }

  // Also check inline state without comma (e.g. "Riverside CA")
  if (!regionHint) {
    const inlineState = cityQuery.match(/^(.+?)\s+([A-Z]{2})$/);
    if (inlineState && US_STATES_FULL[inlineState[2].toLowerCase()]) {
      cityQuery = inlineState[1].trim();
      regionHint = inlineState[2];
    }
  }

  const normalizedRegion = regionHint.toLowerCase();
  const expandedState = US_STATES_FULL[normalizedRegion] || normalizedRegion;

  // 1. Query Open-Meteo Geocoding with clean city name + match exact state/region
  if (cityQuery && !/^\d+$/.test(cityQuery)) {
    const omUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityQuery)}&count=10&language=en&format=json`;
    const omData = await fetchJsonSafe(omUrl, 5000);
    const list = Array.isArray(omData?.results) ? omData.results : [];

    if (list.length > 0) {
      let best = list[0];
      if (expandedState) {
        const regionMatch = list.find((r) => {
          const admin1 = String(r.admin1 || '').toLowerCase();
          const country = String(r.country || '').toLowerCase();
          const cc = String(r.country_code || '').toLowerCase();
          return admin1 === expandedState || admin1.includes(expandedState) || country === expandedState || cc === normalizedRegion;
        });
        if (regionMatch) best = regionMatch;
      } else {
        // Default preference for US/California when no state specified, unless another country is a stronger population match
        const caMatch = list.find((r) => String(r.admin1 || '').toLowerCase() === 'california');
        if (caMatch) best = caMatch;
      }

      const displayParts = [best.name, best.admin1].filter(Boolean);
      const resolved = {
        lat: Number(best.latitude),
        lng: Number(best.longitude),
        displayName: displayParts.join(', ') || raw
      };
      weatherGeoCache.set(cacheKey, resolved);
      return resolved;
    }
  }

  // 2. Fallback to Nominatim for street addresses, landmarks, or ZIP codes
  const nomQuery = zipHint && !cityQuery ? zipHint : raw;
  const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=3&q=${encodeURIComponent(nomQuery)}`;
  const nomList = await fetchJsonSafe(nomUrl, 5500);
  if (Array.isArray(nomList) && nomList[0]) {
    const hit = nomList[0];
    const addr = hit.address || {};
    const resolvedCity = addr.city || addr.town || addr.village || addr.municipality || cityQuery || raw;
    const resolvedState = addr.state || '';
    const resolved = {
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      displayName: [resolvedCity, resolvedState].filter(Boolean).join(', ')
    };
    weatherGeoCache.set(cacheKey, resolved);
    return resolved;
  }

  return null;
}

function interpretWmoWeather(code, isDay = 1) {
  const c = Number(code);
  const night = Number(isDay) === 0;

  if (c === 0) {
    return {
      label: night ? 'Clear Night' : 'Clear & Sunny',
      scene: 'sunny',
      icon: night ? 'moon' : 'sun'
    };
  }
  if (c === 1 || c === 2) {
    return {
      label: night ? 'Partly Cloudy Night' : 'Partly Cloudy',
      scene: 'partly',
      icon: night ? 'cloud' : 'partly'
    };
  }
  if (c === 3 || c === 45 || c === 48) {
    return {
      label: c >= 45 ? 'Misty / Foggy' : 'Overcast Clouds',
      scene: 'cloudy',
      icon: 'cloud'
    };
  }
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) {
    return {
      label: night ? 'Evening Showers' : 'Rain Showers',
      scene: 'rain',
      icon: 'rain'
    };
  }
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) {
    return {
      label: 'Snowfall',
      scene: 'snow',
      icon: 'snow'
    };
  }
  if (c >= 95) {
    return {
      label: 'Thunderstorms',
      scene: 'storm',
      icon: 'storm'
    };
  }
  return {
    label: night ? 'Clear Night' : 'Fair Sky',
    scene: 'sunny',
    icon: night ? 'moon' : 'sun'
  };
}

function ensureNightSceneElements() {
  const sceneEl = document.getElementById('weatherScene');
  if (!sceneEl) return null;

  if (!sceneEl.querySelector('.weather-scene__moon')) {
    const moon = document.createElement('div');
    moon.className = 'weather-scene__moon';
    sceneEl.insertBefore(moon, sceneEl.firstChild);
  }
  if (!sceneEl.querySelector('.weather-scene__stars')) {
    const stars = document.createElement('div');
    stars.className = 'weather-scene__stars';
    stars.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>';
    sceneEl.insertBefore(stars, sceneEl.firstChild);
  }
  return sceneEl;
}

function applyWeatherSceneTheme(sceneType, isNight) {
  const sceneEl = ensureNightSceneElements();
  const aura1 = document.getElementById('weatherAura');
  const aura2 = document.getElementById('weatherAuraSecondary');

  if (sceneEl) {
    sceneEl.classList.remove(
      'weather-scene--sunny',
      'weather-scene--partly',
      'weather-scene--cloudy',
      'weather-scene--rain',
      'weather-scene--snow',
      'weather-scene--storm',
      'weather-scene--night'
    );
    sceneEl.classList.add(`weather-scene--${sceneType || 'sunny'}`);
    if (isNight) {
      sceneEl.classList.add('weather-scene--night');
    }
  }

  if (aura1 && aura2) {
    if (isNight) {
      aura1.className = 'pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-indigo-400/20 blur-3xl transition-colors duration-700';
      aura2.className = 'pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-sky-500/15 blur-3xl transition-colors duration-700';
    } else if (sceneType === 'rain' || sceneType === 'storm') {
      aura1.className = 'pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-sky-400/20 blur-3xl transition-colors duration-700';
      aura2.className = 'pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-indigo-400/15 blur-3xl transition-colors duration-700';
    } else {
      aura1.className = 'pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-amber-400/18 blur-3xl transition-colors duration-700';
      aura2.className = 'pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-sky-400/15 blur-3xl transition-colors duration-700';
    }
  }
}

function formatForecastDateLabel(isoDateStr, idx) {
  if (idx === 0) return 'Today';
  const parts = String(isoDateStr || '').split('-').map(Number);
  if (parts.length !== 3) return `Day ${idx + 1}`;
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function renderSevenDayForecastData(locationLabel, forecast) {
  const locTag = document.getElementById('weatherLocationTag');
  const tempLarge = document.getElementById('weatherCurrentTempLarge');
  const condEl = document.getElementById('weatherCurrentCondition');
  const pillsEl = document.getElementById('weatherTelemetryPills');
  const gridEl = document.getElementById('sevenDayGrid');

  const isNight = Number(forecast.isDay) === 0;
  const currentMeta = interpretWmoWeather(forecast.currentCode, forecast.isDay);

  if (locTag) locTag.textContent = locationLabel;
  if (tempLarge) tempLarge.textContent = `${Math.round(forecast.currentTemp)}°F`;
  if (condEl) condEl.textContent = currentMeta.label;

  applyWeatherSceneTheme(currentMeta.scene, isNight);

  if (pillsEl) {
    const modeBadge = isNight
      ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/25 border border-indigo-300/35 text-indigo-100 font-semibold">${ICONS.moon}<span>Night</span></span>`
      : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-300/35 text-amber-100 font-semibold">${ICONS.sun}<span>Day</span></span>`;

    pillsEl.innerHTML = `
      ${modeBadge}
      <span class="px-2.5 py-1 rounded-full bg-black/30 border border-white/12 tabular-nums">Wind ${Math.round(forecast.windMph)} mph</span>
      ${Number.isFinite(forecast.humidity) ? `<span class="px-2.5 py-1 rounded-full bg-black/30 border border-white/12 tabular-nums">Humidity ${Math.round(forecast.humidity)}%</span>` : ''}
    `;
  }

  if (gridEl && Array.isArray(forecast.daily)) {
    const allHighs = forecast.daily.map((d) => d.max);
    const allLows = forecast.daily.map((d) => d.min);
    const weekMin = Math.min(...allLows);
    const weekMax = Math.max(...allHighs);
    const span = Math.max(1, weekMax - weekMin);

    gridEl.innerHTML = forecast.daily.map((d, idx) => {
      const meta = interpretWmoWeather(d.code, 1);
      const leftPct = Math.max(0, Math.min(85, Math.round(((d.min - weekMin) / span) * 100)));
      const widthPct = Math.max(15, Math.min(100 - leftPct, Math.round(((d.max - d.min) / span) * 100)));

      return `
        <div class="rounded-2xl bg-black/30 hover:bg-black/45 border ${idx === 0 ? 'border-sky-400/40 bg-white/[0.08]' : 'border-white/10'} p-3 transition-all duration-200 flex flex-col justify-between gap-2">
          <div class="flex items-center justify-between gap-1.5">
            <span class="text-[11px] font-bold ${idx === 0 ? 'text-sky-200' : 'text-white/85'} truncate">${esc(formatForecastDateLabel(d.date, idx))}</span>
            <span class="text-amber-300 shrink-0">${ICONS[meta.icon] || ICONS.sun}</span>
          </div>

          <div class="text-[10px] text-white/60 truncate">${esc(meta.label)}</div>

          <div class="space-y-1 pt-0.5">
            <div class="flex items-center justify-between text-xs font-bold tabular-nums">
              <span class="text-white/55 font-medium">${Math.round(d.min)}°</span>
              <span class="text-white">${Math.round(d.max)}°</span>
            </div>
            <div class="relative h-1.5 w-full rounded-full bg-white/12 overflow-hidden">
              <div class="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-sky-400 to-orange-400 animate-weatherBarGrow origin-left" style="left: ${leftPct}%; width: ${widthPct}%;"></div>
            </div>
            ${d.precipProb > 0 ? `<div class="text-[10px] text-sky-300/90 tabular-nums">Rain ${d.precipProb}%</div>` : `<div class="text-[10px] text-white/35">Dry</div>`}
          </div>
        </div>
      `;
    }).join('');
  }
}

async function fetchForecastForCoordinates(lat, lng) {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = weatherForecastCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < 15 * 60 * 1000) {
    return cached.data;
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=relative_humidity_2m&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=auto&forecast_days=7`;
  const raw = await fetchJsonSafe(url, 6000);
  if (!raw || !raw.current_weather || !raw.daily) return null;

  const currentTime = raw.current_weather.time;
  let humidity = null;
  if (Array.isArray(raw.hourly?.time) && Array.isArray(raw.hourly?.relative_humidity_2m)) {
    const hourPrefix = String(currentTime || '').slice(0, 13);
    const hIdx = raw.hourly.time.findIndex((t) => String(t).startsWith(hourPrefix));
    if (hIdx >= 0) humidity = raw.hourly.relative_humidity_2m[hIdx];
  }

  const daily = (raw.daily.time || []).map((date, idx) => ({
    date,
    code: raw.daily.weathercode?.[idx] ?? 0,
    max: raw.daily.temperature_2m_max?.[idx] ?? 72,
    min: raw.daily.temperature_2m_min?.[idx] ?? 52,
    precipProb: raw.daily.precipitation_probability_max?.[idx] ?? 0
  }));

  const parsed = {
    currentTemp: raw.current_weather.temperature,
    windMph: raw.current_weather.windspeed ?? 0,
    currentCode: raw.current_weather.weathercode ?? 0,
    isDay: raw.current_weather.is_day ?? 1,
    humidity,
    daily
  };

  weatherForecastCache.set(key, { fetchedAt: Date.now(), data: parsed });
  return parsed;
}

export async function syncLiveWeatherForActiveDay() {
  const seq = ++activeWeatherSeq;
  const activeDay = appStore.state.days[appStore.activeCarouselIndex] || appStore.state.days[0];
  const chosenLocation = String(activeDay?.location || 'Riverside, CA').trim();

  const locTag = document.getElementById('weatherLocationTag');
  const condEl = document.getElementById('weatherCurrentCondition');
  if (locTag) locTag.textContent = chosenLocation;
  if (condEl && (!activeDay?.temp || activeDay.temp === '--°F')) {
    condEl.textContent = `Loading forecast for ${chosenLocation}...`;
  }

  const geo = await resolveExactWeatherLocation(chosenLocation);
  if (seq !== activeWeatherSeq) return;

  if (!geo) {
    if (condEl) condEl.textContent = `Weather unavailable for "${chosenLocation}"`;
    return;
  }

  const forecast = await fetchForecastForCoordinates(geo.lat, geo.lng);
  if (seq !== activeWeatherSeq) return;

  if (!forecast) {
    if (condEl) condEl.textContent = 'Live forecast temporarily offline';
    return;
  }

  const roundedTemp = `${Math.round(forecast.currentTemp)}°F`;
  if (activeDay && activeDay.temp !== roundedTemp) {
    activeDay.temp = roundedTemp;
    renderForecastStrip();
    renderCarousel();
  }

  renderSevenDayForecastData(chosenLocation, forecast);
}

export async function prefetchAllDaysWeather() {
  const days = appStore.state?.days || [];
  let changed = false;

  for (const day of days) {
    const loc = String(day?.location || '').trim();
    if (!loc) continue;
    const geo = await resolveExactWeatherLocation(loc);
    if (!geo) continue;
    const forecast = await fetchForecastForCoordinates(geo.lat, geo.lng);
    if (forecast && Number.isFinite(forecast.currentTemp)) {
      const nextTemp = `${Math.round(forecast.currentTemp)}°F`;
      if (day.temp !== nextTemp) {
        day.temp = nextTemp;
        changed = true;
      }
    }
  }

  if (changed) {
    renderForecastStrip();
    renderCarousel();
  }
}

/**
 * ============================================================================
 * BACKGROUND ROUTE & DISTANCE SYNC
 * ============================================================================
 */

export async function refreshTripTravelRoutes() {
  await computeTripTravelLegs(appStore.state, () => {
    plannerHooks.renderItinerary();
  });
  plannerHooks.renderItinerary();
}

/**
 * ============================================================================
 * HERO, FORECAST STRIP & 3D SPOTLIGHT CAROUSEL RENDERERS
 * ============================================================================
 */

export function renderHero() {
  const state = appStore.state;
  const titleEl = document.getElementById('heroTitle');
  const subEl = document.getElementById('heroSubtitle');
  const tripsBadge = document.getElementById('tripsCountBadge');

  if (titleEl) titleEl.textContent = state.meta.title || 'Trip Itinerary';
  if (subEl) subEl.textContent = state.meta.subtitle || '';
  if (tripsBadge) tripsBadge.textContent = String(appStore.trips.length);

  const { percent } = getReadinessStats();
  const ring = document.getElementById('heroProgressRing');
  const pctEl = document.getElementById('heroProgressPct');
  if (ring) {
    const circumference = 100.53;
    ring.style.strokeDashoffset = String(circumference - (percent / 100) * circumference);
  }
  if (pctEl) pctEl.textContent = `${percent}%`;
}

export function renderForecastStrip() {
  const strip = document.getElementById('forecastStrip');
  if (!strip) return;
  const days = appStore.state.days || [];

  strip.innerHTML = days.map((day, idx) => {
    const isActive = idx === appStore.activeCarouselIndex;
    return `
      <button
        type="button"
        data-strip-idx="${idx}"
        class="text-left rounded-2xl p-3 border backdrop-blur-2xl transition-all duration-200 cursor-pointer ${
          isActive
            ? 'bg-white/18 border-sky-400/55 shadow-lg shadow-sky-500/15 scale-[1.02]'
            : 'bg-[#16171d]/65 hover:bg-white/12 border-white/12'
        }"
      >
        <div class="flex items-center justify-between gap-1">
          <span class="text-sm sm:text-base font-bold text-white tabular-nums">${esc(day.temp || '--°F')}</span>
          <span class="w-2 h-2 rounded-full ${isActive ? 'bg-sky-400' : 'bg-orange-400/75'}"></span>
        </div>
        <div class="text-[11px] font-bold text-sky-200 mt-1 truncate">${esc(day.shortDay)} · ${esc(day.shortDate)}</div>
        <div class="text-[11px] text-white/65 truncate mt-0.5">${esc(day.location || '')}</div>
      </button>
    `;
  }).join('');

  strip.querySelectorAll('[data-strip-idx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveCarouselIndex(Number(btn.dataset.stripIdx));
    });
  });
}

export function setActiveCarouselIndex(index) {
  const days = appStore.state.days || [];
  if (days.length === 0) return;
  const wrapped = ((index % days.length) + days.length) % days.length;
  appStore.activeCarouselIndex = wrapped;

  updateBackdropForDay(days[wrapped]);
  renderForecastStrip();
  renderCarousel();
  plannerHooks.renderItinerary();
  syncLiveWeatherForActiveDay();
}

export function renderCarousel() {
  const track = document.getElementById('carouselTrack');
  const dotsEl = document.getElementById('carouselDots');
  const counterEl = document.getElementById('carouselCounter');
  if (!track) return;

  const days = appStore.state.days || [];
  if (days.length === 0) {
    track.innerHTML = `<div class="text-xs text-white/50">No days yet. Click "Add Day" above.</div>`;
    if (counterEl) counterEl.textContent = '0 / 0';
    if (dotsEl) dotsEl.innerHTML = '';
    return;
  }

  const activeIdx = Math.max(0, Math.min(days.length - 1, appStore.activeCarouselIndex));
  appStore.activeCarouselIndex = activeIdx;
  if (counterEl) counterEl.textContent = `${activeIdx + 1} / ${days.length}`;

  const isMobile = window.innerWidth < 640;
  const xSpread = isMobile ? 165 : 275;

  track.innerHTML = days.map((day, idx) => {
    const offset = idx - activeIdx;
    const absOffset = Math.abs(offset);
    const isCenter = offset === 0;
    const tx = offset * xSpread;
    const tz = -absOffset * 130;
    const ry = Math.max(-28, Math.min(28, -offset * 14));
    const scale = isCenter ? 1 : Math.max(0.76, 1 - absOffset * 0.11);
    const opacity = absOffset > 2 ? 0 : isCenter ? 1 : Math.max(0.45, 0.85 - absOffset * 0.2);
    const zIndex = 30 - absOffset;
    const photoUrl = getCardPhotoUrl(day);

    return `
      <div
        data-card-idx="${idx}"
        style="transform: translate3d(${tx}px, 0, ${tz}px) rotateY(${ry}deg) scale(${scale}); opacity: ${opacity}; z-index: ${zIndex};"
        class="group/card absolute w-[275px] sm:w-[370px] h-[270px] sm:h-[315px] rounded-3xl overflow-hidden border ${
          isCenter ? 'border-white/35 shadow-[0_24px_60px_rgba(0,0,0,0.75)]' : 'border-white/15 shadow-2xl cursor-pointer'
        } transition-all duration-500 ease-out select-none bg-[#151821]"
      >
        <img
          src="${esc(photoUrl)}"
          alt="${esc(day.location || day.title)}"
          onerror="this.onerror=null;this.src='https://placehold.co/800x600/151821/94a3b8?text=Destination';"
          class="w-full h-full object-cover object-center transition-transform duration-700 ${isCenter ? 'group-hover/card:scale-105' : ''}"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/20"></div>

        <!-- Top Card Pills -->
        <div class="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-black/50 backdrop-blur-xl border border-white/20 text-white">
            ${esc(day.shortDay)} · ${esc(day.shortDate)}
          </span>
          <div class="flex items-center gap-1.5">
            <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/25 backdrop-blur-xl border border-sky-300/35 text-sky-100 tabular-nums">
              ${esc(day.temp || '--°F')}
            </span>
            ${isCenter ? `
              <button type="button" data-card-edit="${esc(day.id)}" title="Edit Day" class="p-1.5 rounded-full bg-black/50 hover:bg-white/25 backdrop-blur-xl border border-white/20 text-white transition-all cursor-pointer">
                ${ICONS.edit}
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Bottom Destination Details -->
        <div class="absolute bottom-4 left-4 right-4 space-y-1">
          <div class="flex items-center gap-1.5 text-[11px] font-semibold text-orange-300">
            <span>${ICONS.pin}</span>
            <span class="truncate">${esc(day.location || '')}</span>
          </div>
          <h3 class="text-base sm:text-lg font-bold text-white leading-snug line-clamp-1">${esc(day.title)}</h3>
          <p class="text-xs text-white/75 line-clamp-1">${esc(day.subtitle || '')}</p>
          <div class="pt-1 flex items-center justify-between text-[11px] text-white/65">
            <span>${day.events?.length || 0} scheduled stop${(day.events?.length || 0) === 1 ? '' : 's'}</span>
            ${day.tag ? `<span class="px-2 py-0.5 rounded-full bg-white/15 text-white/90 font-medium">${esc(day.tag)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  track.querySelectorAll('[data-card-idx]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-card-edit]')) return;
      const idx = Number(card.dataset.cardIdx);
      if (idx !== appStore.activeCarouselIndex) {
        setActiveCarouselIndex(idx);
      }
    });
  });

  track.querySelectorAll('[data-card-edit]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      plannerHooks.openDayModal(btn.dataset.cardEdit);
    });
  });

  if (dotsEl) {
    dotsEl.innerHTML = days.map((_, idx) => `
      <button
        type="button"
        data-dot-idx="${idx}"
        aria-label="Go to Day ${idx + 1}"
        class="h-2 rounded-full transition-all duration-300 cursor-pointer ${
          idx === activeIdx ? 'w-7 bg-gradient-to-r from-orange-400 to-sky-400' : 'w-2 bg-white/25 hover:bg-white/50'
        }"
      ></button>
    `).join('');

    dotsEl.querySelectorAll('[data-dot-idx]').forEach((dot) => {
      dot.addEventListener('click', () => setActiveCarouselIndex(Number(dot.dataset.dotIdx)));
    });
  }
}

/**
 * ============================================================================
 * STATIC ICON HYDRATION & LOCAL / CLOUD PERSISTENCE
 * ============================================================================
 */

export function renderStaticIcons() {
  const map = {
    editHeroInlineBtn: ICONS.edit,
    addDayIcon: ICONS.plus,
    addNewTripIcon: ICONS.newTrip,
    switchTripsIcon: ICONS.trips,
    savePdfIcon: ICONS.save,
    prevIcon: ICONS.chevronLeft,
    nextIcon: ICONS.chevronRight,
    manageCategoriesIcon: ICONS.categories,
    copyNotesIcon: ICONS.copy,
    modalCloseBtn: ICONS.close,
    toggleWeatherChevron: ICONS.chevronDown
  };
  Object.entries(map).forEach(([id, svg]) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = svg;
  });
}

const LOCAL_TRIPS_STORAGE_KEY = 'spatial_tripos_saved_trips_v1';
let saveDebounceTimer = null;

function setSyncStatus(label, isReady = true) {
  const txt = document.getElementById('syncStatusText');
  const dot = document.getElementById('syncStatusDot');
  if (txt) {
    const span = txt.querySelector('span:last-child');
    if (span) span.textContent = label;
  }
  if (dot) {
    dot.className = isReady
      ? 'w-1.5 h-1.5 rounded-full bg-emerald-400'
      : 'w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse';
  }
}

export function scheduleCloudSave() {
  setSyncStatus('Saving...', false);
  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    try {
      const payload = {
        activeTripId: appStore.activeTripId,
        trips: appStore.trips
      };
      window.localStorage?.setItem(LOCAL_TRIPS_STORAGE_KEY, JSON.stringify(payload));
      setSyncStatus('Saved locally', true);
    } catch (err) {
      setSyncStatus('Local save unavailable', true);
    }
  }, 350);
}

export function initCloudSync() {
  try {
    const raw = window.localStorage?.getItem(LOCAL_TRIPS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.trips) && parsed.trips.length > 0) {
        appStore.trips = parsed.trips;
        appStore.activeTripId = parsed.activeTripId || parsed.trips[0].id;
        syncActiveTripRef();
        updateBackdropForDay(appStore.state.days[0]);
        plannerHooks.renderAll();
      }
    }
    setSyncStatus('Saved locally', true);
  } catch (err) {
    setSyncStatus('Ready', true);
  }

  // Always sync the 7-Day Forecast for the active trip's chosen Day 1 location right after loading
  syncLiveWeatherForActiveDay();
  prefetchAllDaysWeather();
  refreshTripTravelRoutes();
}