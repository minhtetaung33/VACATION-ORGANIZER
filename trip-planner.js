import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";
import {
  normalizeTripSchedules,
  computeTripTravelLegs
} from './trip-timeline-engine.js';

/**
 * Crisp Inline SVG Icon Library
 */
export const ICONS = {
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  chevronLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><polyline points="15 18 9 12 15 6"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><polyline points="9 18 15 12 9 6"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  arrowUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><polyline points="18 15 12 9 6 15"/></svg>`,
  arrowDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><polyline points="6 9 12 15 18 9"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12"/></svg>`,
  link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  cloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`,
  rain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M8 19v2"/><path d="M12 19v2"/><path d="M16 19v2"/></svg>`,
  drive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>`,
  hotel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/></svg>`,
  food: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
  highlight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
  explore: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
  stop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  ticket: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>`,
  mountain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>`,
  leaf: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
  plane: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  newTrip: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="9.5" y1="13.5" x2="14.5" y2="13.5"/></svg>`,
  trips: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  bag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  wallet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><polyline points="6 9 12 15 18 9"/></svg>`,
  receipt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/></svg>`,

  // Timeline Drag, Lock, Duplicate, Copy-to-Day, Travel, Warnings & Custom Category Icons
  grip: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  unlock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
  copyToDay: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M10 15h5"/><path d="m13 13 2 2-2 2"/></svg>`,
  route: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>`,
  walk: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><circle cx="13" cy="4" r="2"/><path d="m13.5 8.5-2.5 5 3.5 3 1 5.5"/><path d="m11 13.5-3 3-2 4.5"/><path d="m10 9.5 4.5-1 2.5 3"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  calendarClock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><circle cx="16" cy="16" r="6"/><path d="M16 14v2.2l1.6 1"/></svg>`,
  palette: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
  wand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h.01"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
  coffee: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
  music: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  umbrella: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M22 12a10.06 10.06 1 0 0-20 0Z"/><path d="M12 12v8a2 2 0 0 0 4 0"/><path d="M12 2v1"/></svg>`,
  gift: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/></svg>`
};

export const LINK_ICON_META = {
  lights: { label: 'Lights & Festivals', icon: 'highlight', style: 'bg-gradient-to-br from-amber-500/25 to-orange-500/20 border-amber-400/40 text-amber-300 shadow-amber-500/15' },
  ticket: { label: 'Tickets & Passes', icon: 'ticket', style: 'bg-gradient-to-br from-sky-500/25 to-cyan-500/20 border-sky-400/40 text-sky-300 shadow-sky-500/15' },
  tram: { label: 'Mountain & Scenic', icon: 'mountain', style: 'bg-gradient-to-br from-indigo-500/25 to-sky-500/20 border-indigo-400/40 text-indigo-300 shadow-indigo-500/15' },
  dining: { label: 'Dining & Food', icon: 'food', style: 'bg-gradient-to-br from-rose-500/25 to-orange-500/20 border-rose-400/40 text-rose-300 shadow-rose-500/15' },
  museum: { label: 'Museum & Aviation', icon: 'plane', style: 'bg-gradient-to-br from-violet-500/25 to-fuchsia-500/20 border-violet-400/40 text-violet-300 shadow-violet-500/15' },
  garden: { label: 'Zoo & Nature', icon: 'leaf', style: 'bg-gradient-to-br from-emerald-500/25 to-teal-500/20 border-emerald-400/40 text-emerald-300 shadow-emerald-500/15' },
  hotel: { label: 'Hotel & Stays', icon: 'hotel', style: 'bg-gradient-to-br from-blue-500/25 to-indigo-500/20 border-blue-400/40 text-blue-300 shadow-blue-500/15' },
  web: { label: 'General Website', icon: 'globe', style: 'bg-gradient-to-br from-white/15 to-sky-500/15 border-white/25 text-white/90 shadow-black/20' }
};

export const CATEGORY_META = {
  drive: {
    label: 'Drive / Transit',
    icon: 'drive',
    color: 'bg-sky-500/15 border-sky-400/35 text-sky-300',
    ambient: 'bg-gradient-to-r from-sky-400/80 via-cyan-300/60 to-transparent',
    anim: 'cat-anim-glide',
    rgb: [56, 189, 248]
  },
  hotel: {
    label: 'Hotel / Rest',
    icon: 'hotel',
    color: 'bg-indigo-500/15 border-indigo-400/35 text-indigo-300',
    ambient: 'bg-gradient-to-r from-indigo-400/80 via-violet-300/60 to-transparent',
    anim: 'cat-anim-float',
    rgb: [129, 140, 248]
  },
  food: {
    label: 'Dining / Food',
    icon: 'food',
    color: 'bg-amber-500/15 border-amber-400/35 text-amber-300',
    ambient: 'bg-gradient-to-r from-amber-400/85 via-orange-300/60 to-transparent',
    anim: 'cat-anim-steam',
    rgb: [251, 191, 36]
  },
  highlight: {
    label: 'Highlight Event',
    icon: 'highlight',
    color: 'bg-orange-500/15 border-orange-400/35 text-orange-300',
    ambient: 'bg-gradient-to-r from-orange-400/90 via-rose-400/60 to-transparent',
    anim: 'cat-anim-sparkle',
    rgb: [251, 146, 60]
  },
  explore: {
    label: 'Explore / Sightseeing',
    icon: 'explore',
    color: 'bg-emerald-500/15 border-emerald-400/35 text-emerald-300',
    ambient: 'bg-gradient-to-r from-emerald-400/85 via-teal-300/60 to-transparent',
    anim: 'cat-anim-compass',
    rgb: [52, 211, 153]
  },
  stop: {
    label: 'General Stop',
    icon: 'stop',
    color: 'bg-white/10 border-white/25 text-white/85',
    ambient: 'bg-gradient-to-r from-slate-200/70 via-sky-300/50 to-transparent',
    anim: 'cat-anim-radar',
    rgb: [203, 213, 225]
  }
};

export const CUSTOM_CATEGORY_THEMES = {
  rose: {
    label: 'Rose Glow',
    color: 'bg-rose-500/15 border-rose-400/35 text-rose-300',
    ambient: 'bg-gradient-to-r from-rose-400/85 via-pink-300/60 to-transparent',
    rgb: [251, 113, 133]
  },
  violet: {
    label: 'Cosmic Violet',
    color: 'bg-violet-500/15 border-violet-400/35 text-violet-300',
    ambient: 'bg-gradient-to-r from-violet-400/85 via-fuchsia-300/60 to-transparent',
    rgb: [167, 139, 250]
  },
  cyan: {
    label: 'Ocean Cyan',
    color: 'bg-cyan-500/15 border-cyan-400/35 text-cyan-300',
    ambient: 'bg-gradient-to-r from-cyan-400/85 via-sky-300/60 to-transparent',
    rgb: [34, 211, 238]
  },
  emerald: {
    label: 'Forest Mint',
    color: 'bg-emerald-500/15 border-emerald-400/35 text-emerald-300',
    ambient: 'bg-gradient-to-r from-emerald-400/85 via-lime-300/60 to-transparent',
    rgb: [52, 211, 153]
  },
  amber: {
    label: 'Golden Sun',
    color: 'bg-amber-500/15 border-amber-400/35 text-amber-300',
    ambient: 'bg-gradient-to-r from-amber-400/85 via-yellow-300/60 to-transparent',
    rgb: [251, 191, 36]
  },
  fuchsia: {
    label: 'Neon Fuchsia',
    color: 'bg-fuchsia-500/15 border-fuchsia-400/35 text-fuchsia-300',
    ambient: 'bg-gradient-to-r from-fuchsia-400/85 via-purple-300/60 to-transparent',
    rgb: [232, 121, 249]
  }
};

export const CUSTOM_CATEGORY_ICON_OPTIONS = [
  { key: 'camera', label: 'Photo Spot' },
  { key: 'coffee', label: 'Coffee / Cafe' },
  { key: 'bag', label: 'Shopping' },
  { key: 'ticket', label: 'Show / Ticket' },
  { key: 'mountain', label: 'Hike / Nature' },
  { key: 'umbrella', label: 'Beach / Relax' },
  { key: 'music', label: 'Music / Nightlife' },
  { key: 'heart', label: 'Family / Date' },
  { key: 'star', label: 'Must-See' },
  { key: 'gift', label: 'Holiday / Special' },
  { key: 'plane', label: 'Flight / Airport' },
  { key: 'leaf', label: 'Park / Garden' }
];

export const CUSTOM_CATEGORY_ANIM_OPTIONS = [
  { key: 'cat-anim-sparkle', label: 'Starlight Sparkle' },
  { key: 'cat-anim-glide', label: 'Highway Glide' },
  { key: 'cat-anim-steam', label: 'Warm Steam Glow' },
  { key: 'cat-anim-compass', label: 'Compass Sway' },
  { key: 'cat-anim-float', label: 'Gentle Float' },
  { key: 'cat-anim-radar', label: 'Radar Ripple' },
  { key: 'cat-anim-bounce', label: 'Adventure Hop' },
  { key: 'cat-anim-spin', label: 'Cosmic Orbit' }
];

export const BUDGET_CATEGORY_META = {
  hotel: {
    label: 'Hotels & Lodging',
    defaultName: 'Hotels & Lodging',
    placeholder: 'e.g. Riverside Hotel, Palm Desert Resort',
    icon: 'hotel',
    style: 'bg-gradient-to-br from-indigo-500/25 to-blue-500/20 border-indigo-400/40 text-indigo-300 shadow-indigo-500/15'
  },
  food: {
    label: 'Food & Dining',
    defaultName: 'Food & Dining',
    placeholder: "e.g. Peaks Dinner, Sherman's Deli",
    icon: 'food',
    style: 'bg-gradient-to-br from-amber-500/25 to-orange-500/20 border-amber-400/40 text-amber-300 shadow-amber-500/15'
  },
  transport: {
    label: 'Gas / Parking / Transit',
    defaultName: 'Gas / Parking',
    placeholder: 'e.g. Fuel refill, Mission Inn Parking',
    icon: 'drive',
    style: 'bg-gradient-to-br from-sky-500/25 to-cyan-500/20 border-sky-400/40 text-sky-300 shadow-sky-500/15'
  },
  tickets: {
    label: 'Tickets & Activities',
    defaultName: 'Tickets / Activities',
    placeholder: 'e.g. WildLights Bundle, Aerial Tramway',
    icon: 'ticket',
    style: 'bg-gradient-to-br from-orange-500/25 to-rose-500/20 border-orange-400/40 text-orange-300 shadow-orange-500/15'
  },
  flights: {
    label: 'Flights & Airfare',
    defaultName: 'Flights & Airfare',
    placeholder: 'e.g. Round-trip tickets, Checked bags',
    icon: 'plane',
    style: 'bg-gradient-to-br from-violet-500/25 to-fuchsia-500/20 border-violet-400/40 text-violet-300 shadow-violet-500/15'
  },
  shopping: {
    label: 'Shopping & Souvenirs',
    defaultName: 'Shopping & Souvenirs',
    placeholder: 'e.g. Gift shop, Holiday ornaments',
    icon: 'bag',
    style: 'bg-gradient-to-br from-pink-500/25 to-rose-500/20 border-pink-400/40 text-pink-300 shadow-pink-500/15'
  },
  other: {
    label: 'Essentials & Misc',
    defaultName: 'Essentials & Misc',
    placeholder: 'e.g. Snacks, Travel supplies, Tips',
    icon: 'wallet',
    style: 'bg-gradient-to-br from-emerald-500/25 to-teal-500/20 border-emerald-400/40 text-emerald-300 shadow-emerald-500/15'
  },
  custom: {
    label: 'Custom Expense',
    defaultName: '',
    placeholder: 'e.g. Item or vendor description',
    icon: 'highlight',
    style: 'bg-gradient-to-br from-orange-400/25 to-sky-400/25 border-white/30 text-sky-200 shadow-sky-500/15'
  }
};

/**
 * Distinct Real High-Resolution Photography for 3D Parallax Carousel Cards
 * (Guaranteed to be visually different from the main page backdrop photos)
 */
export const REAL_CARD_BACKDROPS = {
  lights: 'https://images.unsplash.com/photo-1543589077-47d81606c1bf?auto=format&fit=crop&w=1200&q=85',
  desert: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=85',
  tram: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=85',
  ps_tramway: 'https://images.unsplash.com/photo-1551524559-8af4e6624178?auto=format&fit=crop&w=1200&q=85',
  xmas_lights: 'https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=1200&q=85',
  xmas_village: 'https://images.unsplash.com/photo-1544273677-c433136021d4?auto=format&fit=crop&w=1200&q=85',
  farm: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1200&q=85',
  beach: 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=1200&q=85',
  canyon: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=85',
  city: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1200&q=85',
  lake: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=85',
  meadow: 'https://images.unsplash.com/photo-1472214103451-9374bd1c7985?auto=format&fit=crop&w=1200&q=85',
  autumn: 'https://images.unsplash.com/photo-1476820865390-c52aeebb9891?auto=format&fit=crop&w=1200&q=85'
};

/**
 * Curated Real High-Resolution Landscape / Forest / Travel Photography for Main Page Backdrop
 */
export const REAL_THEME_BACKDROPS = {
  lights: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1920&q=85',
  desert: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1920&q=85',
  tram: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=85',
  ps_tramway: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=1920&q=85',
  xmas_lights: 'https://images.unsplash.com/photo-1482517967863-00e15c9b44be?auto=format&fit=crop&w=1920&q=85',
  xmas_village: 'https://images.unsplash.com/photo-1513297887119-d46091b24bfa?auto=format&fit=crop&w=1920&q=85',
  farm: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1920&q=85',
  beach: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=85',
  canyon: 'https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?auto=format&fit=crop&w=1920&q=85',
  city: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1920&q=85',
  lake: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?auto=format&fit=crop&w=1920&q=85',
  meadow: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1920&q=85',
  autumn: 'https://images.unsplash.com/photo-1507041957456-9c397ce39c97?auto=format&fit=crop&w=1920&q=85'
};

/**
 * Callback Registry (Connected by main.js to keep module imports one-way)
 */
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

/**
 * Utilities: ID generator, HTML Escaping, Category Resolution, Budget & Maps Helpers
 */
export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
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
  const customs = Array.isArray(appStore.state?.customCategories) ? appStore.state.customCategories : [];
  customs.forEach((cat) => {
    if (!cat?.id) return;
    const theme = CUSTOM_CATEGORY_THEMES[cat.theme] || CUSTOM_CATEGORY_THEMES.cyan;
    merged[cat.id] = {
      id: cat.id,
      label: cat.label || 'Custom',
      icon: ICONS[cat.icon] ? cat.icon : 'star',
      color: theme.color,
      ambient: theme.ambient,
      anim: cat.anim || 'cat-anim-sparkle',
      rgb: theme.rgb,
      isCustom: true
    };
  });
  return merged;
}

export function getCategoryMeta(categoryKey) {
  const all = getAllCategories();
  return all[categoryKey] || CATEGORY_META.stop;
}

export function getStopMapUrl(locationStr) {
  const trimmed = String(locationStr || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}

export function getStopLocationLabel(locationStr) {
  const trimmed = String(locationStr || '').trim();
  if (/^https?:\/\//i.test(trimmed)) return 'Open in Maps';
  return trimmed;
}

export function inferBudgetCategory(item) {
  if (item?.category && BUDGET_CATEGORY_META[item.category]) return item.category;
  const lbl = String(item?.label || '').toLowerCase();
  if (/hotel|stay|resort|lodg|airbnb|motel|room|night/.test(lbl)) return 'hotel';
  if (/food|din|meal|lunch|dinner|breakfast|snack|coffee|restaurant/.test(lbl)) return 'food';
  if (/gas|park|fuel|car|drive|uber|lyft|transit|toll|rental/.test(lbl)) return 'transport';
  if (/ticket|activit|zoo|tram|museum|pass|tour|farm|entry|show/.test(lbl)) return 'tickets';
  if (/flight|air|plane|baggage|airport/.test(lbl)) return 'flights';
  if (/shop|souvenir|gift|merch|clothes/.test(lbl)) return 'shopping';
  if (/misc|other|essential|tip|supply/.test(lbl)) return 'other';
  return 'custom';
}

export function getItemFinalCost(item) {
  if (Array.isArray(item?.finalEntries) && item.finalEntries.length > 0) {
    return item.finalEntries.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  }
  if (item?.final !== null && item?.final !== '' && item?.final !== undefined && !Number.isNaN(Number(item.final))) {
    return Number(item.final);
  }
  return null;
}

/**
 * Toast, Clipboard, Reusable Frosted Glass Modal & Delete Confirmation
 */
export function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  const colors = type === 'error'
    ? 'bg-rose-600/90 border-rose-400/40 text-white'
    : 'bg-[#191b22]/90 border-white/20 text-white';
  toast.className = `pointer-events-auto max-w-full px-4 py-2.5 rounded-2xl border backdrop-blur-xl shadow-2xl text-xs sm:text-sm font-medium animate-popIn ${colors}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 320);
  }, 2600);
}

export function copyTextToClipboard(text, successMsg = 'Copied!') {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast(successMsg);
  } catch (err) {
    showToast('Unable to copy text', 'error');
  }
}

export function openModal({ title, bodyHtml, footerButtons = [] }) {
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  const footer = document.getElementById('modalFooter');
  footer.innerHTML = '';

  footerButtons.forEach((btn) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = btn.label;
    if (btn.id) el.id = btn.id;
    if (btn.variant === 'primary') {
      el.className = 'px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-orange-500 to-sky-500 hover:from-orange-400 hover:to-sky-400 text-white shadow-lg transition-all cursor-pointer';
    } else if (btn.variant === 'danger') {
      el.className = 'px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition-all cursor-pointer';
    } else {
      el.className = 'px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-white/10 hover:bg-white/20 text-white/90 transition-all cursor-pointer';
    }
    el.addEventListener('click', btn.onClick);
    footer.appendChild(el);
  });

  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

export function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.add('hidden');
  overlay.classList.remove('flex');
  document.body.style.overflow = '';
}

export function openConfirmDeleteModal({
  title = 'Confirm Delete',
  itemName = '',
  detail = 'This action cannot be undone.',
  confirmLabel = 'Yes, Delete',
  onConfirm
}) {
  openModal({
    title,
    bodyHtml: `
      <div class="py-3 text-center space-y-4">
        <div class="relative mx-auto w-16 h-16 flex items-center justify-center">
          <span class="absolute inset-0 rounded-full bg-rose-500/25 animate-ping"></span>
          <span class="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/25 to-orange-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300 shadow-lg shadow-rose-950/50 scale-110">
            ${ICONS.trash}
          </span>
        </div>
        <div class="space-y-1.5">
          <h4 class="text-base sm:text-lg font-semibold text-white">Are you sure?</h4>
          ${itemName ? `<div class="inline-block max-w-full px-3 py-1 rounded-xl bg-white/8 border border-white/12 text-xs sm:text-sm font-medium text-orange-200 truncate">"${esc(itemName)}"</div>` : ''}
          <p class="text-xs sm:text-sm text-white/65 leading-relaxed max-w-sm mx-auto">${esc(detail)}</p>
        </div>
      </div>
    `,
    footerButtons: [
      { label: 'No, Keep It', onClick: closeModal },
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
 * Initial Thanksgiving Getaway Planner State (With Time Slots & Reservations Ready)
 */
export function createInitialState() {
  const trip = {
    id: 'trip-thanksgiving-default',
    createdAt: Date.now(),
    customCategories: [],
    meta: {
      title: 'Welcome to your Thanksgiving Getaway',
      subtitle: 'Four days, three nights, three holiday experiences, and a full Palm Springs family day. Keep your schedule, checklist, notes, and estimated costs together.',
      tripLength: '4 days / 3 nights',
      firstDeparture: 'Friday · 4:00 PM',
      hotelPlan: '1 + 2 nights'
    },
    days: [
      {
        id: 'day-1',
        shortDay: 'FRI',
        shortDate: 'Nov 27',
        temp: '68°F',
        location: 'Riverside',
        landmark: 'Mission Inn Hotel Riverside California',
        cardLandmark: 'Mission Inn Festival of Lights Riverside',
        scene: 'lights',
        useScenePreset: true,
        customBgUrl: '',
        customCardUrl: '',
        title: 'Day 1 · Friday, Nov 27',
        subtitle: 'Riverside · Check in first, then Festival of Lights',
        tag: 'Hotel: Riverside',
        noteTitle: 'Parking',
        noteBody: "Mission Inn's visitor information lists public parking options, including advance parking. Reserve parking ahead if possible. Festival hours are 5–11 PM; it is closed Thanksgiving Day and Christmas Day.",
        events: [
          { id: 'e1-1', time: '4:00–5:30 PM', startMinutes: 16 * 60, durationMinutes: 90, isFixed: false, reservationMinutes: null, completed: false, category: 'drive', text: 'Leave home (West Covina / La Puente area). Allow extra time for holiday traffic.', location: 'West Covina, CA' },
          { id: 'e1-2', time: '5:30–6:00 PM', startMinutes: 17 * 60 + 30, durationMinutes: 30, isFixed: false, reservationMinutes: null, completed: false, category: 'hotel', text: 'Arrive at Riverside hotel, check in, unload luggage, and rest.', location: 'Downtown Riverside, CA' },
          { id: 'e1-3', time: '6:15–7:00 PM', startMinutes: 18 * 60 + 15, durationMinutes: 45, isFixed: false, reservationMinutes: null, completed: false, category: 'food', text: 'Dinner near downtown Riverside.', location: 'Main St Pedestrian Mall, Riverside, CA' },
          { id: 'e1-4', time: '7:15–9:15 PM', startMinutes: 19 * 60 + 15, durationMinutes: 120, isFixed: false, reservationMinutes: null, completed: false, category: 'highlight', text: 'Visit Mission Inn Festival of Lights. Enjoy the decorations and downtown atmosphere.', location: 'The Mission Inn Hotel & Spa, Riverside, CA' },
          { id: 'e1-5', time: '9:15–9:45 PM', startMinutes: 21 * 60 + 15, durationMinutes: 30, isFixed: false, reservationMinutes: null, completed: false, category: 'hotel', text: 'Walk or drive back to the hotel and get some rest.', location: 'Downtown Riverside, CA' }
        ]
      },
      {
        id: 'day-2',
        shortDay: 'SAT',
        shortDate: 'Nov 28',
        temp: '74°F',
        location: 'Palm Desert',
        landmark: 'Coachella Valley Palm Desert California',
        cardLandmark: 'The Living Desert Zoo Palm Desert',
        scene: 'desert',
        useScenePreset: false,
        customBgUrl: '',
        customCardUrl: '',
        title: 'Day 2 · Saturday, Nov 28',
        subtitle: 'Palm Desert · The Living Desert by day and night',
        tag: 'Hotel: Palm Desert',
        noteTitle: 'Ticket reminder',
        noteBody: 'The official Day + Night bundle is listed at $64.95 per adult and $49.95 per child ages 3–17. Under age 3 is free. Daytime guests must exit by 5 PM; WildLights entry starts at 6 PM. Check the date-specific ticket page before buying.',
        events: [
          { id: 'e2-1', time: '8:30–9:30 AM', startMinutes: 8 * 60 + 30, durationMinutes: 60, isFixed: false, reservationMinutes: null, completed: false, category: 'food', text: 'Breakfast, pack, and prepare for hotel checkout.', location: 'Downtown Riverside, CA' },
          { id: 'e2-2', time: '10:30 AM–12:00 PM', startMinutes: 10 * 60 + 30, durationMinutes: 90, isFixed: false, reservationMinutes: null, completed: false, category: 'drive', text: 'Check out of Riverside hotel. Drive to Palm Desert.', location: 'Palm Desert, CA' },
          { id: 'e2-3', time: '12:15–12:45 PM', startMinutes: 12 * 60 + 15, durationMinutes: 30, isFixed: false, reservationMinutes: null, completed: false, category: 'hotel', text: 'Arrive at Palm Desert hotel. Ask about early check-in or luggage storage. Keep valuables with you.', location: 'Palm Desert, CA' },
          { id: 'e2-4', time: '12:45–1:30 PM', startMinutes: 12 * 60 + 45, durationMinutes: 45, isFixed: false, reservationMinutes: null, completed: false, category: 'food', text: 'Lunch near the hotel or at the zoo, depending on timing.', location: '' },
          { id: 'e2-5', time: '1:30–4:45 PM', startMinutes: 13 * 60 + 30, durationMinutes: 195, isFixed: false, reservationMinutes: null, completed: false, category: 'explore', text: 'Explore The Living Desert Zoo and Gardens. Prioritize the animals and exhibits your family wants to see.', location: 'The Living Desert Zoo and Gardens, Palm Desert, CA' },
          { id: 'e2-6', time: '5:00–5:15 PM', startMinutes: 17 * 60, durationMinutes: 15, isFixed: true, reservationMinutes: 17 * 60, completed: false, category: 'stop', text: 'Everyone must exit the zoo for the daytime break.', location: 'The Living Desert Zoo and Gardens, Palm Desert, CA' },
          { id: 'e2-7', time: '5:15–5:45 PM', startMinutes: 17 * 60 + 15, durationMinutes: 30, isFixed: false, reservationMinutes: null, completed: false, category: 'hotel', text: 'Hotel check-in / rest / change clothes. Choose a hotel close to the zoo.', location: 'Palm Desert, CA' },
          { id: 'e2-8', time: '6:00–8:15 PM', startMinutes: 18 * 60, durationMinutes: 135, isFixed: true, reservationMinutes: 18 * 60, completed: false, category: 'highlight', text: 'Return for WildLights. Last admission is 8:30 PM; event ends at 9:00 PM.', location: 'The Living Desert Zoo and Gardens, Palm Desert, CA' },
          { id: 'e2-9', time: '8:30–9:00 PM', startMinutes: 20 * 60 + 30, durationMinutes: 30, isFixed: false, reservationMinutes: null, completed: false, category: 'hotel', text: 'Return to hotel. Stay in the same Palm Desert hotel Saturday and Sunday nights.', location: 'Palm Desert, CA' }
        ]
      },
      {
        id: 'day-3',
        shortDay: 'SUN',
        shortDate: 'Nov 29',
        temp: '71°F',
        location: 'Palm Springs',
        landmark: 'Palm Springs Aerial Tramway Mount San Jacinto',
        cardLandmark: 'Palm Springs California mountains',
        scene: 'tram',
        useScenePreset: false,
        customBgUrl: '',
        customCardUrl: '',
        title: 'Day 3 · Sunday, Nov 29',
        subtitle: 'Palm Springs · Museum, lunch, garden, tram, and dinner',
        tag: 'Hotel: Palm Desert',
        noteTitle: 'Mountain reminder',
        noteBody: 'The Mountain Station is 8,516 ft high and can be 30–40°F colder than the desert floor. Snow is possible in November, but it is not guaranteed. Bring warm layers for everyone, especially the baby. Check the Tram Cam and forecast a day or two before.',
        events: [
          { id: 'e3-1', time: '9:00–9:45 AM', startMinutes: 9 * 60, durationMinutes: 45, isFixed: false, reservationMinutes: null, completed: false, category: 'drive', text: 'Breakfast and drive to Palm Springs.', location: 'Palm Desert, CA' },
          { id: 'e3-2', time: '10:00 AM–12:00 PM', startMinutes: 10 * 60, durationMinutes: 120, isFixed: false, reservationMinutes: null, completed: false, category: 'explore', text: 'Visit Palm Springs Air Museum (open daily 10 AM–5 PM; admission applies).', location: 'Palm Springs Air Museum, Palm Springs, CA' },
          { id: 'e3-3', time: '12:15–1:15 PM', startMinutes: 12 * 60 + 15, durationMinutes: 60, isFixed: false, reservationMinutes: null, completed: false, category: 'food', text: "Lunch in Palm Springs. A downtown family-friendly option is Sherman's Deli & Bakery; another is Elmer's Restaurant.", location: "Sherman's Deli & Bakery, Palm Springs, CA" },
          { id: 'e3-4', time: '1:30–2:45 PM', startMinutes: 13 * 60 + 30, durationMinutes: 75, isFixed: false, reservationMinutes: null, completed: false, category: 'explore', text: 'Visit Moorten Botanical Garden (season hours 10 AM–4 PM, closed Wednesday).', location: 'Moorten Botanical Garden, Palm Springs, CA' },
          { id: 'e3-5', time: '3:00–3:45 PM', startMinutes: 15 * 60, durationMinutes: 45, isFixed: false, reservationMinutes: null, completed: false, category: 'drive', text: 'Drive to the Tramway Valley Station, park, use restrooms, and get warm layers ready.', location: 'Palm Springs Aerial Tramway, Palm Springs, CA' },
          { id: 'e3-6', time: '3:45–4:30 PM', startMinutes: 15 * 60 + 45, durationMinutes: 45, isFixed: false, reservationMinutes: null, completed: false, category: 'highlight', text: 'Ride the Palm Springs Aerial Tramway up. Aim for daylight views and sunset from the Mountain Station.', location: 'Palm Springs Aerial Tramway, Palm Springs, CA' },
          { id: 'e3-7', time: '5:15–6:45 PM', startMinutes: 17 * 60 + 15, durationMinutes: 90, isFixed: true, reservationMinutes: 17 * 60 + 15, completed: false, category: 'food', text: 'Dinner at Peaks Restaurant at the top. Reserve a table in advance; dinner seating is listed from 5 PM to 7:45 PM.', location: 'Peaks Restaurant, Palm Springs, CA' },
          { id: 'e3-8', time: '6:45–8:15 PM', startMinutes: 18 * 60 + 45, durationMinutes: 90, isFixed: false, reservationMinutes: null, completed: false, category: 'explore', text: 'Enjoy the night views, observation decks, and indoor areas. Take the tram down with plenty of time before the 9:30 PM last car.', location: '' },
          { id: 'e3-9', time: '8:30–9:15 PM', startMinutes: 20 * 60 + 30, durationMinutes: 45, isFixed: false, reservationMinutes: null, completed: false, category: 'hotel', text: 'Return to Palm Desert hotel.', location: 'Palm Desert, CA' }
        ]
      },
      {
        id: 'day-4',
        shortDay: 'MON',
        shortDate: 'Nov 30',
        temp: '69°F',
        location: 'Cherry Valley',
        landmark: 'San Bernardino National Forest California',
        cardLandmark: 'Pine Forest Christmas Lights Cherry Valley',
        scene: 'farm',
        useScenePreset: true,
        customBgUrl: '',
        customCardUrl: '',
        title: 'Day 4 · Monday, Nov 30',
        subtitle: 'Cherry Valley · 123 Farm Christmas Nights · Home',
        tag: 'Check out',
        noteTitle: 'Monday detail',
        noteBody: "Santa's Workshop is not listed for Nov 30. Weekday Christmas Nights admission is listed from 5–10 PM. Buy date-specific tickets ahead; gate tickets may not be available.",
        events: [
          { id: 'e4-1', time: '8:30–9:30 AM', startMinutes: 8 * 60 + 30, durationMinutes: 60, isFixed: false, reservationMinutes: null, completed: false, category: 'food', text: 'Breakfast and pack.', location: 'Palm Desert, CA' },
          { id: 'e4-2', time: '10:30–11:00 AM', startMinutes: 10 * 60 + 30, durationMinutes: 30, isFixed: true, reservationMinutes: 10 * 60 + 30, completed: false, category: 'hotel', text: 'Check out of Palm Desert hotel.', location: 'Palm Desert, CA' },
          { id: 'e4-3', time: '11:30 AM–2:30 PM', startMinutes: 11 * 60 + 30, durationMinutes: 180, isFixed: false, reservationMinutes: null, completed: false, category: 'explore', text: 'Relaxed lunch, shopping, or a short family stop. Keep this part flexible.', location: '' },
          { id: 'e4-4', time: '2:45–4:15 PM', startMinutes: 14 * 60 + 45, durationMinutes: 90, isFixed: false, reservationMinutes: null, completed: false, category: 'drive', text: 'Drive toward Cherry Valley. Allow extra time for traffic and a baby break.', location: 'Cherry Valley, CA' },
          { id: 'e4-5', time: '5:00–7:30 PM', startMinutes: 17 * 60, durationMinutes: 150, isFixed: true, reservationMinutes: 17 * 60, completed: false, category: 'highlight', text: 'Visit 123 Farm Christmas Nights. Monday weekday hours are 5–10 PM. Wander through the Christmas village and lights.', location: '123 Farm, Cherry Valley, CA' },
          { id: 'e4-6', time: '7:30–8:00 PM', startMinutes: 19 * 60 + 30, durationMinutes: 30, isFixed: false, reservationMinutes: null, completed: false, category: 'food', text: 'Snack or early dinner at the farm, then start driving home.', location: '123 Farm, Cherry Valley, CA' },
          { id: 'e4-7', time: '8:15–9:45 PM', startMinutes: 20 * 60 + 15, durationMinutes: 90, isFixed: false, reservationMinutes: null, completed: false, category: 'drive', text: 'Estimated arrival home, depending on traffic and stops.', location: 'West Covina, CA' }
        ]
      }
    ],
    checklists: [
      {
        id: 'bookings',
        title: 'Bookings & reservations',
        items: [
          { id: 'b1', text: 'Riverside hotel · Nov 27', done: false },
          { id: 'b2', text: 'Palm Desert hotel · Nov 28–30 (2 nights)', done: false },
          { id: 'b3', text: 'WildLights Day + Night bundle · Nov 28', done: false },
          { id: 'b4', text: '123 Farm tickets · Nov 30', done: false },
          { id: 'b5', text: 'Peaks Restaurant dinner reservation · Nov 29', done: false },
          { id: 'b6', text: 'Tramway tickets · Nov 29', done: false },
          { id: 'b7', text: 'Mission Inn parking plan / reservation', done: false }
        ]
      },
      {
        id: 'prep',
        title: 'Before leaving',
        items: [
          { id: 'p1', text: 'Confirm hotel check-in and late checkout times', done: false },
          { id: 'p2', text: 'Download tickets and save confirmation emails', done: false },
          { id: 'p3', text: 'Check mountain forecast and Tram Cam', done: false },
          { id: 'p4', text: 'Check traffic and event updates', done: false },
          { id: 'p5', text: 'Pack warm jackets, hats, and blankets', done: false },
          { id: 'p6', text: 'Pack stroller and baby carrier', done: false },
          { id: 'p7', text: 'Pack diapers, wipes, bottles/feeding supplies, and extra clothes', done: false },
          { id: 'p8', text: 'Bring phone chargers / power bank', done: false },
          { id: 'p9', text: 'Bring car seat and check installation', done: false },
          { id: 'p10', text: 'Bring snacks, water, and basic medicine', done: false },
          { id: 'p11', text: 'Keep valuables out of the car during hotel luggage drop', done: false },
          { id: 'p12', text: 'Check baby-friendly breaks into drive times', done: false },
          { id: 'p13', text: 'Check all event dates and entry times one day before', done: false }
        ]
      }
    ],
    budget: {
      adults: 2,
      kids: 0,
      infants: 1,
      items: [
        { id: 'cost-1', category: 'hotel', label: 'Hotels (3 nights total)', estimated: 450, final: null, finalEntries: [], note: 'Riverside (1 night) + Palm Desert (2 nights)' },
        { id: 'cost-2', category: 'food', label: 'Food estimate', estimated: 250, final: null, finalEntries: [], note: 'Dinners, lunches, and snacks' },
        { id: 'cost-3', category: 'transport', label: 'Gas / parking', estimated: 120, final: null, finalEntries: [], note: 'Fuel and Mission Inn advance parking' },
        { id: 'cost-4', category: 'tickets', label: 'Tickets / activities', estimated: 100, final: null, finalEntries: [], note: 'Zoo, Tramway, Air Museum, 123 Farm' }
      ]
    },
    notes: '',
    links: [
      { id: 'l1', label: 'Mission Inn info', url: 'https://www.missioninn.com/festival-of-lights/plan-your-visit/', icon: 'lights', location: 'Downtown Riverside, CA', hours: '5:00 PM – 11:00 PM', info: 'Reserve advance parking if possible; closed Thanksgiving & Christmas Day.' },
      { id: 'l2', label: 'WildLights tickets', url: 'https://www.livingdesert.org/events/wildlights-2026/2026-11-28/', icon: 'garden', location: 'Palm Desert, CA', hours: 'Zoo until 5 PM · WildLights 6–9 PM', info: 'Last entry 8:30 PM. Check date-specific Day + Night tickets.' },
      { id: 'l3', label: 'Tram tickets', url: 'https://pstramway.com/tickets/', icon: 'tram', location: 'Palm Springs, CA (8,516 ft)', hours: 'Last tram down at 9:30 PM', info: 'Mountain Station is 30–40°F colder; pack warm layers.' },
      { id: 'l4', label: 'Peaks dining', url: 'https://pstramway.com/dining/', icon: 'dining', location: 'Mountain Station, Palm Springs', hours: 'Dinner 5:00 PM – 7:45 PM', info: 'Advance table reservations strongly recommended for sunset.' },
      { id: 'l5', label: 'Air Museum', url: 'https://palmspringsairmuseum.org/visit/', icon: 'museum', location: 'Palm Springs, CA', hours: 'Daily 10:00 AM – 5:00 PM', info: 'Admission applies; great morning family stop.' },
      { id: 'l6', label: 'Moorten Garden', url: 'https://www.moortenbotanicalgarden.com/', icon: 'garden', location: 'Palm Springs, CA', hours: '10:00 AM – 4:00 PM (Closed Wed)', info: 'Historic desert botanical garden & Cactarium.' },
      { id: 'l7', label: '123 Farm tickets', url: 'https://ticket.123farm.com/xmas', icon: 'ticket', location: 'Cherry Valley, CA', hours: 'Mon Weekday 5:00 PM – 10:00 PM', info: 'Buy date-specific tickets online; gate tickets may not be available.' }
    ]
  };
  normalizeTripSchedules(trip);
  return trip;
}

/**
 * Create a Fresh Default Trip Template when User Starts a New Trip
 */
export function createNewDefaultTrip({
  title = 'My New Getaway',
  subtitle = 'A fresh travel itinerary ready for new destinations, stops, and memories.',
  tripLength = '3 days / 2 nights',
  firstDeparture = 'Friday · 9:00 AM',
  hotelPlan = '2 nights',
  startLocation = 'San Diego'
} = {}) {
  const loc = startLocation.trim() || 'California';
  const trip = {
    id: uid('trip'),
    createdAt: Date.now(),
    customCategories: [],
    meta: {
      title,
      subtitle,
      tripLength,
      firstDeparture,
      hotelPlan
    },
    days: [
      {
        id: uid('day'),
        shortDay: 'DAY 1',
        shortDate: 'Arrival',
        temp: '72°F',
        location: loc,
        landmark: loc,
        cardLandmark: `${loc} sightseeing`,
        scene: 'beach',
        useScenePreset: false,
        customBgUrl: '',
        customCardUrl: '',
        title: `Day 1 · Arrive in ${loc}`,
        subtitle: `${loc} · Check in, explore & kick off the trip`,
        tag: `Hotel: ${loc}`,
        noteTitle: 'Arrival tip',
        noteBody: 'Confirm your hotel check-in window, parking options, and dinner reservations ahead of time.',
        events: [
          { id: uid('ev'), time: firstDeparture || '9:00 AM', startMinutes: 9 * 60, durationMinutes: 120, isFixed: false, reservationMinutes: null, completed: false, category: 'drive', text: `Depart for ${loc}. Allow buffer time for traffic and scenic stops.`, location: loc },
          { id: uid('ev'), time: '3:00–4:00 PM', startMinutes: 15 * 60, durationMinutes: 60, isFixed: false, reservationMinutes: null, completed: false, category: 'hotel', text: `Check in to your ${loc} hotel, drop off luggage, and freshen up.`, location: loc },
          { id: uid('ev'), time: '6:00–7:30 PM', startMinutes: 18 * 60, durationMinutes: 90, isFixed: false, reservationMinutes: null, completed: false, category: 'food', text: `Welcome dinner and evening stroll around ${loc}.`, location: loc }
        ]
      }
    ],
    checklists: [
      {
        id: 'bookings',
        title: 'Bookings & reservations',
        items: [
          { id: uid('c'), text: `Book hotel / stay in ${loc}`, done: false },
          { id: uid('c'), text: 'Reserve main activities & tickets', done: false },
          { id: uid('c'), text: 'Book dinner reservations', done: false }
        ]
      },
      {
        id: 'prep',
        title: 'Before leaving',
        items: [
          { id: uid('c'), text: 'Check weather forecast & pack layers', done: false },
          { id: uid('c'), text: 'Download tickets & hotel confirmations', done: false },
          { id: uid('c'), text: 'Pack phone chargers, power bank & essentials', done: false }
        ]
      }
    ],
    budget: {
      adults: 2,
      kids: 0,
      infants: 0,
      items: [
        { id: uid('cost'), category: 'hotel', label: 'Hotels / Stays', estimated: 350, final: null, finalEntries: [], note: hotelPlan },
        { id: uid('cost'), category: 'food', label: 'Food & Dining', estimated: 180, final: null, finalEntries: [], note: 'Meals, coffee, and snacks' },
        { id: uid('cost'), category: 'transport', label: 'Gas / Transit / Parking', estimated: 80, final: null, finalEntries: [], note: 'Fuel and local parking' },
        { id: uid('cost'), category: 'tickets', label: 'Activities & Tickets', estimated: 100, final: null, finalEntries: [], note: 'Attractions and tours' }
      ]
    },
    notes: '',
    links: []
  };
  normalizeTripSchedules(trip);
  return trip;
}

/**
 * Shared Application State Store
 */
const initialTrip = createInitialState();

export const appStore = {
  trips: [initialTrip],
  activeTripId: initialTrip.id,
  state: initialTrip,
  activeCarouselIndex: 0,
  showAllDays: false,
  weatherPanelExpanded: true,
  expandedBudgetIds: new Set(),
  currentBackdropUrl: '',
  justShiftedEventIds: new Set(),
  justCompletedEventId: null
};

export function syncActiveTripRef() {
  const found = appStore.trips.find((t) => t.id === appStore.activeTripId);
  if (found) {
    appStore.state = found;
  } else {
    if (appStore.trips.length === 0) appStore.trips = [createInitialState()];
    appStore.activeTripId = appStore.trips[0].id;
    appStore.state = appStore.trips[0];
  }
}

export function normalizeTripObject(rawTrip, fallbackIdx = 0) {
  const base = fallbackIdx === 0 && rawTrip?.id === 'trip-thanksgiving-default'
    ? createInitialState()
    : createNewDefaultTrip();
  const merged = {
    ...base,
    ...rawTrip,
    id: rawTrip?.id || uid('trip'),
    createdAt: rawTrip?.createdAt || Date.now(),
    customCategories: Array.isArray(rawTrip?.customCategories) ? rawTrip.customCategories : [],
    meta: { ...base.meta, ...(rawTrip?.meta || {}) },
    days: Array.isArray(rawTrip?.days) ? rawTrip.days : base.days,
    checklists: Array.isArray(rawTrip?.checklists) ? rawTrip.checklists : base.checklists,
    budget: rawTrip?.budget ? { ...base.budget, ...rawTrip.budget } : base.budget,
    notes: typeof rawTrip?.notes === 'string' ? rawTrip.notes : '',
    links: Array.isArray(rawTrip?.links) ? rawTrip.links : []
  };
  normalizeTripSchedules(merged);
  return merged;
}

export function applyParsedPayload(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  if (Array.isArray(parsed.trips) && parsed.trips.length > 0) {
    appStore.trips = parsed.trips.map((t, idx) => normalizeTripObject(t, idx));
    appStore.activeTripId = appStore.trips.some((t) => t.id === parsed.activeTripId)
      ? parsed.activeTripId
      : appStore.trips[0].id;
    syncActiveTripRef();
    if (appStore.activeCarouselIndex >= appStore.state.days.length) {
      appStore.activeCarouselIndex = Math.max(0, appStore.state.days.length - 1);
    }
    return true;
  }
  // Legacy v1 single-trip payload migration
  if (parsed.meta && Array.isArray(parsed.days)) {
    const migrated = normalizeTripObject({ ...parsed, id: 'trip-thanksgiving-default' }, 0);
    appStore.trips = [migrated];
    appStore.activeTripId = migrated.id;
    syncActiveTripRef();
    if (appStore.activeCarouselIndex >= appStore.state.days.length) {
      appStore.activeCarouselIndex = Math.max(0, appStore.state.days.length - 1);
    }
    return true;
  }
  return false;
}

export function refreshTripTravelRoutes() {
  computeTripTravelLegs(appStore.state, () => {
    plannerHooks.renderItinerary();
  });
}

export function switchToTrip(tripId, silent = false) {
  const target = appStore.trips.find((t) => t.id === tripId);
  if (!target) return;
  appStore.activeTripId = target.id;
  syncActiveTripRef();
  appStore.activeCarouselIndex = 0;
  appStore.showAllDays = false;

  const track = document.getElementById('carouselTrack');
  if (track) track.dataset.dayIds = '';

  updateBackdropForDay(appStore.state.days[0]);
  plannerHooks.renderAll();
  prefetchAllDaysWeather();
  prefetchAllCardPhotos();
  refreshTripTravelRoutes();
  scheduleCloudSave();
  if (!silent) showToast(`Switched to "${appStore.state.meta.title}"`);
}

/**
 * Location-Aware Destination Photo & Backdrop Engine
 */
const cardPhotoCache = new Map();
const locationPhotoCache = new Map();
const weatherCache = new Map();
let backdropRequestId = 0;
let activeBgSlot = 'A';

export function resolveSceneForDay(day) {
  if (!day) return 'desert';
  const validScenes = [
    'lights', 'desert', 'tram', 'ps_tramway', 'xmas_lights', 'xmas_village',
    'farm', 'beach', 'canyon', 'city', 'lake', 'meadow', 'autumn', 'custom'
  ];
  if (day.scene && validScenes.includes(day.scene)) {
    return day.scene;
  }
  const loc = (day.location || '').toLowerCase();
  if (/beach|ocean|coast|malibu|santa monica|san diego|laguna|hawaii|maui/.test(loc)) return 'beach';
  if (/lake|tahoe|mirror|pond|river/.test(loc)) return 'lake';
  if (/canyon|sedona|utah|zion|grand|mesa/.test(loc)) return 'canyon';
  if (/autumn|fall|vermont|foliage/.test(loc)) return 'autumn';
  if (/forest|woods|valley|pine|big bear|yosemite|sequoia|cherry/.test(loc)) return 'farm';
  if (/palm springs|tramway|san jacinto/.test(loc)) return 'ps_tramway';
  if (/mountain|alpine|springs|tram|peak|snow|aspen|mammoth/.test(loc)) return 'tram';
  if (/desert|oasis|joshua|phoenix|vegas/.test(loc)) return 'desert';
  if (/city|downtown|tokyo|new york|york|angeles|francisco/.test(loc)) return 'city';
  return 'lights';
}

export function applyBackdropPhoto(url) {
  if (!url || url === appStore.currentBackdropUrl) return;
  const imgA = document.getElementById('bgPhotoA');
  const imgB = document.getElementById('bgPhotoB');
  if (!imgA || !imgB) return;

  const nextSlot = activeBgSlot === 'A' ? 'B' : 'A';
  const incoming = nextSlot === 'A' ? imgA : imgB;
  const outgoing = nextSlot === 'A' ? imgB : imgA;

  const preloader = new Image();
  preloader.onload = () => {
    incoming.src = url;
    incoming.classList.remove('opacity-0');
    incoming.classList.add('opacity-100');
    outgoing.classList.remove('opacity-100');
    outgoing.classList.add('opacity-0');
    activeBgSlot = nextSlot;
    appStore.currentBackdropUrl = url;
  };
  preloader.onerror = () => {
    // Keep current backdrop if remote URL fails
  };
  preloader.src = url;
}

export async function fetchRealDestinationPhoto(query, excludeUrl = '') {
  if (!query) return null;
  const cacheKey = `${query.toLowerCase()}|${excludeUrl}`;
  if (locationPhotoCache.has(cacheKey)) return locationPhotoCache.get(cacheKey);
  try {
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=4&prop=pageimages&pithumbsize=1600&format=json&origin=*`;
    const res = await fetch(apiUrl);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
    for (const p of pages) {
      const src = p?.thumbnail?.source;
      const w = p?.thumbnail?.width || 0;
      const h = p?.thumbnail?.height || 0;
      if (src && src !== excludeUrl && w >= 600 && w >= h) {
        locationPhotoCache.set(cacheKey, src);
        return src;
      }
    }
  } catch (err) {
    // Fallback to curated real photography silently
  }
  return null;
}

export function getCardPhotoUrl(day) {
  if (day?.scene === 'custom' && (day?.customCardUrl || day?.customBgUrl)) {
    return day.customCardUrl || day.customBgUrl;
  }
  if (day?.resolvedCardPhoto) return day.resolvedCardPhoto;
  const themeKey = resolveSceneForDay(day);
  return REAL_CARD_BACKDROPS[themeKey] || REAL_CARD_BACKDROPS.desert;
}

export async function prefetchCardPhotoForDay(day) {
  if (!day) return;
  const themeKey = resolveSceneForDay(day);

  if (themeKey === 'custom') {
    day.resolvedCardPhoto = day.customCardUrl || day.customBgUrl || REAL_CARD_BACKDROPS.desert;
    return;
  }

  if (themeKey === 'ps_tramway') {
    const bgExclude = day.resolvedBgPhoto || appStore.currentBackdropUrl || '';
    const fetched = await fetchRealDestinationPhoto('Palm Springs Aerial Tramway gondola', bgExclude);
    day.resolvedCardPhoto = (fetched && fetched !== bgExclude) ? fetched : REAL_CARD_BACKDROPS.ps_tramway;
    return;
  }

  if (day.useScenePreset) {
    day.resolvedCardPhoto = REAL_CARD_BACKDROPS[themeKey] || REAL_CARD_BACKDROPS.desert;
    return;
  }

  const query = (day.cardLandmark || `${day.location || ''} attractions`).trim();
  const cacheKey = query.toLowerCase();
  const fallback = REAL_CARD_BACKDROPS[themeKey] || REAL_CARD_BACKDROPS.desert;
  const bgExclude = day.resolvedBgPhoto || appStore.currentBackdropUrl || REAL_THEME_BACKDROPS[themeKey] || '';

  if (cardPhotoCache.has(cacheKey)) {
    const cached = cardPhotoCache.get(cacheKey);
    day.resolvedCardPhoto = (cached && cached !== bgExclude) ? cached : fallback;
    return;
  }

  const fetched = await fetchRealDestinationPhoto(query, bgExclude);
  const finalUrl = (fetched && fetched !== bgExclude && fetched !== REAL_THEME_BACKDROPS[themeKey]) ? fetched : fallback;
  cardPhotoCache.set(cacheKey, finalUrl);
  day.resolvedCardPhoto = finalUrl;
}

export async function prefetchAllCardPhotos() {
  await Promise.all(appStore.state.days.map((d) => prefetchCardPhotoForDay(d)));
  renderCarousel();
}

export async function updateBackdropForDay(day) {
  const reqId = ++backdropRequestId;
  const themeKey = resolveSceneForDay(day);

  if (themeKey === 'custom' && (day?.customBgUrl || day?.customCardUrl)) {
    const customUrl = day.customBgUrl || day.customCardUrl;
    day.resolvedBgPhoto = customUrl;
    applyBackdropPhoto(customUrl);
    return;
  }

  const fallbackPhoto = REAL_THEME_BACKDROPS[themeKey] || REAL_THEME_BACKDROPS.farm;

  if (themeKey === 'ps_tramway') {
    if (!appStore.currentBackdropUrl) applyBackdropPhoto(fallbackPhoto);
    const realTramPhoto = await fetchRealDestinationPhoto('Palm Springs Aerial Tramway');
    if (reqId !== backdropRequestId) return;
    const chosenBg = realTramPhoto || fallbackPhoto;
    if (day) {
      day.resolvedBgPhoto = chosenBg;
      if (day.resolvedCardPhoto === chosenBg) {
        day.resolvedCardPhoto = REAL_CARD_BACKDROPS.ps_tramway;
        renderCarousel();
      }
    }
    applyBackdropPhoto(chosenBg);
    return;
  }

  if (day?.useScenePreset && REAL_THEME_BACKDROPS[themeKey]) {
    day.resolvedBgPhoto = fallbackPhoto;
    applyBackdropPhoto(fallbackPhoto);
    return;
  }

  if (!appStore.currentBackdropUrl) {
    applyBackdropPhoto(fallbackPhoto);
  }

  const searchTerm = (day?.landmark || day?.location || '').trim();
  if (!searchTerm) {
    if (day) day.resolvedBgPhoto = fallbackPhoto;
    applyBackdropPhoto(fallbackPhoto);
    return;
  }

  const realLocationPhoto = await fetchRealDestinationPhoto(searchTerm);
  if (reqId !== backdropRequestId) return;
  const chosenBg = realLocationPhoto || fallbackPhoto;
  if (day) {
    day.resolvedBgPhoto = chosenBg;
    if (day.resolvedCardPhoto === chosenBg) {
      day.resolvedCardPhoto = REAL_CARD_BACKDROPS[themeKey] || REAL_CARD_BACKDROPS.desert;
      renderCarousel();
    }
  }
  applyBackdropPhoto(chosenBg);
}

/**
 * Firebase Cloud Persistence (Real-Time Sync Across Google Sites & All Devices)
 */
const MY_FIREBASE_CONFIG = {
  apiKey: "AIzaSyD64AftmnfEjMWT2DgnzXGHZub_LIndU5I",
  authDomain: "trip-planner-c0b1f.firebaseapp.com",
  projectId: "trip-planner-c0b1f",
  storageBucket: "trip-planner-c0b1f.firebasestorage.app",
  messagingSenderId: "216295891879",
  appId: "1:216295891879:web:8e4adce086412ced22cc82",
  measurementId: "G-HC5QPCQB63"
};
const MY_TRIP_SYNC_ID = "my-trip-planner";

let db = null;
let cloudDocRef = null;
let saveDebounceTimer = null;
let isApplyingRemote = false;

export function updateSyncStatus(text, tone = 'info') {
  const wrap = document.getElementById('syncStatusText');
  if (!wrap) return;
  const dotColor = tone === 'saved'
    ? 'bg-emerald-400'
    : tone === 'saving'
      ? 'bg-amber-300 animate-pulse'
      : tone === 'error'
        ? 'bg-rose-400'
        : 'bg-sky-400 animate-pulse';
  const textColor = tone === 'saved'
    ? 'text-emerald-300/90'
    : tone === 'saving'
      ? 'text-amber-200/90'
      : tone === 'error'
        ? 'text-rose-300/90'
        : 'text-sky-300/80';
  wrap.className = `inline-flex items-center gap-1.5 ${textColor}`;
  wrap.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span><span>${esc(text)}</span>`;
}

export function serializeStateForCloud() {
  const cleanTrips = appStore.trips.map((trip) => ({
    id: trip.id,
    createdAt: trip.createdAt || Date.now(),
    customCategories: Array.isArray(trip.customCategories) ? trip.customCategories : [],
    meta: trip.meta,
    days: (trip.days || []).map((d) => {
      const copy = { ...d };
      delete copy.resolvedCardPhoto;
      delete copy.resolvedBgPhoto;
      return copy;
    }),
    checklists: trip.checklists,
    budget: trip.budget,
    notes: trip.notes,
    links: trip.links
  }));
  return JSON.stringify({
    version: 3,
    activeTripId: appStore.activeTripId,
    trips: cleanTrips
  });
}

export async function persistStateNow() {
  if (!db || !cloudDocRef || isApplyingRemote) return;
  try {
    updateSyncStatus('Syncing cloud...', 'saving');
    await setDoc(cloudDocRef, {
      payload: serializeStateForCloud(),
      updatedAt: Date.now()
    });
    updateSyncStatus('Cloud synced', 'saved');
  } catch (err) {
    updateSyncStatus('Sync failed · Check Firestore', 'error');
  }
}

export function scheduleCloudSave() {
  if (isApplyingRemote || !db || !cloudDocRef) return;
  updateSyncStatus('Saving...', 'saving');
  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    persistStateNow();
  }, 350);
}

export async function initCloudSync() {
  try {
    updateSyncStatus('Connecting cloud...', 'info');
    const app = initializeApp(MY_FIREBASE_CONFIG);
    db = getFirestore(app);
    cloudDocRef = doc(db, 'tripPlanner', MY_TRIP_SYNC_ID);

    onSnapshot(
      cloudDocRef,
      (snap) => {
        if (snap.exists() && snap.data()?.payload) {
          const incomingPayload = snap.data().payload;
          if (incomingPayload !== serializeStateForCloud()) {
            try {
              const parsed = JSON.parse(incomingPayload);
              isApplyingRemote = true;
              if (applyParsedPayload(parsed)) {
                const track = document.getElementById('carouselTrack');
                if (track) track.dataset.dayIds = '';
                plannerHooks.renderAll();
                if (appStore.state.days[appStore.activeCarouselIndex]) {
                  updateBackdropForDay(appStore.state.days[appStore.activeCarouselIndex]);
                }
                prefetchAllDaysWeather();
                prefetchAllCardPhotos();
                refreshTripTravelRoutes();
              }
              isApplyingRemote = false;
            } catch (parseErr) {
              isApplyingRemote = false;
            }
          }
          updateSyncStatus('Cloud synced', 'saved');
        } else {
          persistStateNow();
        }
      },
      () => {
        updateSyncStatus('Check Firestore rules', 'error');
      }
    );
  } catch (err) {
    updateSyncStatus('Firebase unavailable', 'error');
  }
}

/**
 * Render Static UI Icons & Live Animated Clock
 */
export function renderStaticIcons() {
  document.getElementById('editHeroInlineBtn').innerHTML = ICONS.edit;
  document.getElementById('addDayIcon').innerHTML = ICONS.plus;
  document.getElementById('addNewTripIcon').innerHTML = ICONS.newTrip;
  document.getElementById('switchTripsIcon').innerHTML = ICONS.trips;
  document.getElementById('savePdfIcon').innerHTML = ICONS.download;
  document.getElementById('prevIcon').innerHTML = ICONS.chevronLeft;
  document.getElementById('nextIcon').innerHTML = ICONS.chevronRight;
  document.getElementById('copyNotesIcon').innerHTML = ICONS.copy;
  document.getElementById('modalCloseBtn').innerHTML = ICONS.close;
  document.getElementById('toggleWeatherChevron').innerHTML = ICONS.chevronDown;
  const catIconEl = document.getElementById('manageCategoriesIcon');
  if (catIconEl) catIconEl.innerHTML = ICONS.palette;
}

export function updateClock() {
  const now = new Date();
  let h = now.getHours();
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');

  const secEl = document.getElementById('clockSeconds');
  document.getElementById('clockHours').textContent = String(h);
  document.getElementById('clockMinutes').textContent = m;
  document.getElementById('clockPeriod').textContent = period;

  if (secEl && secEl.textContent !== s) {
    secEl.textContent = s;
    secEl.classList.remove('animate-tickPop');
    void secEl.offsetWidth;
    secEl.classList.add('animate-tickPop');
  }
}

/**
 * Live Animated Weather Icons & 7-Day Forecast Telemetry via Open-Meteo
 */
export function getAnimatedWeatherSvg(code, sizeClass = 'w-8 h-8') {
  if (code === 0) {
    return `
      <svg viewBox="0 0 36 36" fill="none" class="${sizeClass} overflow-visible drop-shadow-[0_0_10px_rgba(251,191,36,0.55)]">
        <circle cx="18" cy="18" r="11" fill="rgba(251,191,36,0.2)" class="origin-center animate-sunPulse" />
        <g stroke="#fcd34d" stroke-width="2.1" stroke-linecap="round" class="origin-center animate-sunSpin">
          <line x1="18" y1="3.5" x2="18" y2="6.8" />
          <line x1="18" y1="29.2" x2="18" y2="32.5" />
          <line x1="3.5" y1="18" x2="6.8" y2="18" />
          <line x1="29.2" y1="18" x2="32.5" y2="18" />
          <line x1="7.7" y1="7.7" x2="10.1" y2="10.1" />
          <line x1="25.9" y1="25.9" x2="28.3" y2="28.3" />
          <line x1="28.3" y1="7.7" x2="25.9" y2="10.1" />
          <line x1="10.1" y1="25.9" x2="7.7" y2="28.3" />
        </g>
        <circle cx="18" cy="18" r="6.6" fill="url(#sunCoreGrad)" class="origin-center animate-sunPulse" />
        <defs>
          <radialGradient id="sunCoreGrad" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stop-color="#fef08a" />
            <stop offset="65%" stop-color="#fbbf24" />
            <stop offset="100%" stop-color="#f97316" />
          </radialGradient>
        </defs>
      </svg>
    `;
  }

  if (code === 1 || code === 2) {
    return `
      <svg viewBox="0 0 36 36" fill="none" class="${sizeClass} overflow-visible drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]">
        <g class="origin-[13px_13px] animate-sunSpin" stroke="#fcd34d" stroke-width="1.7" stroke-linecap="round">
          <line x1="13" y1="3.5" x2="13" y2="6" />
          <line x1="3.5" y1="13" x2="6" y2="13" />
          <line x1="6.3" y1="6.3" x2="8.1" y2="8.1" />
          <line x1="19.7" y1="6.3" x2="17.9" y2="8.1" />
        </g>
        <circle cx="13" cy="13" r="5" fill="#fbbf24" class="origin-[13px_13px] animate-sunPulse" />
        <path d="M12.5 27.5h13.5a5.5 5.5 0 0 0 .8-10.94A7.5 7.5 0 0 0 12.4 14.8a5 5 0 0 0 .1 12.7Z" fill="rgba(241,245,249,0.92)" stroke="rgba(255,255,255,0.65)" stroke-width="1.2" class="animate-cloudDrift" />
      </svg>
    `;
  }

  if (code >= 95) {
    return `
      <svg viewBox="0 0 36 36" fill="none" class="${sizeClass} overflow-visible drop-shadow-[0_0_10px_rgba(250,204,21,0.45)]">
        <path d="M10 22h16a5 5 0 0 0 .6-9.96A7 7 0 0 0 13 10.6a4.8 4.8 0 0 0-3 11.4Z" fill="rgba(148,163,184,0.9)" stroke="rgba(226,232,240,0.6)" stroke-width="1.2" class="animate-cloudDrift" />
        <polygon points="18.5,20 14,27 17.8,27 16,33.5 23,24.8 19,24.8" fill="#fde047" class="animate-stormFlash" />
        <line x1="11.5" y1="24" x2="10.2" y2="28" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" class="animate-rainFall" />
        <line x1="24.5" y1="24" x2="23.2" y2="28" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" style="animation-delay:0.45s" class="animate-rainFall" />
      </svg>
    `;
  }

  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return `
      <svg viewBox="0 0 36 36" fill="none" class="${sizeClass} overflow-visible drop-shadow-[0_0_8px_rgba(186,230,253,0.5)]">
        <path d="M10 22h16a5 5 0 0 0 .6-9.96A7 7 0 0 0 13 10.6a4.8 4.8 0 0 0-3 11.4Z" fill="rgba(224,242,254,0.92)" stroke="rgba(186,230,253,0.75)" stroke-width="1.2" class="animate-cloudDrift" />
        <circle cx="12.5" cy="25.5" r="1.6" fill="#e0f2fe" class="animate-rainFall" />
        <circle cx="18.5" cy="26.5" r="1.8" fill="#bae6fd" style="animation-delay:0.35s" class="animate-rainFall" />
        <circle cx="24" cy="25.5" r="1.5" fill="#e0f2fe" style="animation-delay:0.7s" class="animate-rainFall" />
      </svg>
    `;
  }

  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return `
      <svg viewBox="0 0 36 36" fill="none" class="${sizeClass} overflow-visible drop-shadow-[0_0_8px_rgba(56,189,248,0.45)]">
        <path d="M10 21.5h16a5 5 0 0 0 .6-9.96A7 7 0 0 0 13 10.1a4.8 4.8 0 0 0-3 11.4Z" fill="rgba(203,213,225,0.9)" stroke="rgba(186,230,253,0.65)" stroke-width="1.2" class="animate-cloudDrift" />
        <line x1="12.5" y1="23.5" x2="11" y2="28" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" class="animate-rainFall" />
        <line x1="18.5" y1="23.5" x2="17" y2="28" stroke="#7dd3fc" stroke-width="2" stroke-linecap="round" style="animation-delay:0.35s" class="animate-rainFall" />
        <line x1="24.5" y1="23.5" x2="23" y2="28" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" style="animation-delay:0.7s" class="animate-rainFall" />
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 36 36" fill="none" class="${sizeClass} overflow-visible drop-shadow-[0_0_8px_rgba(148,163,184,0.35)]">
      <path d="M14 21h12.5a4.2 4.2 0 0 0 .5-8.35A5.8 5.8 0 0 0 15.8 11.5a4 4 0 0 0-1.8 9.5Z" fill="rgba(148,163,184,0.55)" />
      <path d="M9.5 26h15.5a5 5 0 0 0 .6-9.96A7 7 0 0 0 12.2 14.6a4.8 4.8 0 0 0-2.7 11.4Z" fill="rgba(226,232,240,0.92)" stroke="rgba(255,255,255,0.6)" stroke-width="1.2" class="animate-cloudDrift" />
    </svg>
  `;
}

export function weatherCodeToMeta(code) {
  if (code === 0) return { desc: 'Clear Sky', tone: 'sunny', icon: getAnimatedWeatherSvg(code, 'w-5 h-5') };
  if (code === 1 || code === 2) return { desc: 'Partly Cloudy', tone: 'partly', icon: getAnimatedWeatherSvg(code, 'w-5 h-5') };
  if (code === 3 || (code >= 45 && code <= 48)) return { desc: 'Cloudy', tone: 'cloudy', icon: getAnimatedWeatherSvg(code, 'w-5 h-5') };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { desc: 'Rain Showers', tone: 'rain', icon: getAnimatedWeatherSvg(code, 'w-5 h-5') };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { desc: 'Snow Flurries', tone: 'snow', icon: getAnimatedWeatherSvg(code, 'w-5 h-5') };
  if (code >= 95) return { desc: 'Thunderstorm', tone: 'storm', icon: getAnimatedWeatherSvg(code, 'w-5 h-5') };
  return { desc: 'Mild & Clear', tone: 'sunny', icon: getAnimatedWeatherSvg(0, 'w-5 h-5') };
}

export function buildFallback7DayForecast(baseTempStr = '72°F') {
  const baseNum = parseInt(String(baseTempStr), 10) || 72;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sampleCodes = [0, 1, 0, 2, 0, 1, 0];
  const offsets = [0, 2, -1, -3, 1, 3, 0];
  const now = new Date();
  return sampleCodes.map((code, idx) => {
    const d = new Date(now);
    d.setDate(now.getDate() + idx);
    const max = baseNum + offsets[idx];
    const min = max - 16;
    return {
      dayLabel: idx === 0 ? 'Today' : dayNames[d.getDay()],
      dateLabel: `${monthNames[d.getMonth()]} ${d.getDate()}`,
      code,
      max,
      min,
      precip: code >= 2 ? 15 : 0,
      desc: weatherCodeToMeta(code).desc
    };
  });
}

export async function fetchLiveWeatherForLocation(locationName) {
  if (!locationName) return null;
  const key = locationName.trim().toLowerCase();
  if (weatherCache.has(key)) return weatherCache.get(key);
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&language=en&format=json`);
    if (!geoRes.ok) return null;
    const geo = await geoRes.json();
    const place = geo?.results?.[0];
    if (!place) return null;

    const wRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=7&timezone=auto`
    );
    if (!wRes.ok) return null;
    const wData = await wRes.json();
    const tempVal = Math.round(wData?.current?.temperature_2m);
    const code = wData?.current?.weather_code ?? 0;
    if (!Number.isFinite(tempVal)) return null;

    const humidity = Math.round(wData?.current?.relative_humidity_2m ?? 0);
    const wind = Math.round(wData?.current?.wind_speed_10m ?? 0);

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dailyTimes = wData?.daily?.time || [];
    const daily = dailyTimes.slice(0, 7).map((isoDate, idx) => {
      const [yr, mo, da] = String(isoDate).split('-').map(Number);
      const dt = new Date(yr, (mo || 1) - 1, da || 1);
      const dCode = wData?.daily?.weather_code?.[idx] ?? code;
      const max = Math.round(wData?.daily?.temperature_2m_max?.[idx] ?? tempVal);
      const min = Math.round(wData?.daily?.temperature_2m_min?.[idx] ?? (tempVal - 14));
      const precip = Math.round(wData?.daily?.precipitation_probability_max?.[idx] ?? 0);
      return {
        dayLabel: idx === 0 ? 'Today' : dayNames[dt.getDay()],
        dateLabel: `${monthNames[dt.getMonth()]} ${dt.getDate()}`,
        code: dCode,
        max,
        min,
        precip,
        desc: weatherCodeToMeta(dCode).desc
      };
    });

    const meta = weatherCodeToMeta(code);
    const result = {
      temp: `${tempVal}°F`,
      code,
      desc: meta.desc,
      tone: meta.tone,
      icon: meta.icon,
      humidity,
      wind,
      daily: daily.length === 7 ? daily : buildFallback7DayForecast(`${tempVal}°F`)
    };
    weatherCache.set(key, result);
    return result;
  } catch (err) {
    return null;
  }
}

export function renderSevenDayWeather(day, weatherData) {
  const locName = day?.location || 'California';
  const activeCode = weatherData?.code ?? 0;
  const meta = weatherCodeToMeta(activeCode);
  const daily = weatherData?.daily?.length ? weatherData.daily : buildFallback7DayForecast(day?.temp || '72°F');

  const locTag = document.getElementById('weatherLocationTag');
  const tempLarge = document.getElementById('weatherCurrentTempLarge');
  const condEl = document.getElementById('weatherCurrentCondition');
  const telemetryEl = document.getElementById('weatherTelemetryPills');
  const gridEl = document.getElementById('sevenDayGrid');
  const aura1 = document.getElementById('weatherAura');
  const aura2 = document.getElementById('weatherAuraSecondary');

  if (!gridEl) return;

  locTag.textContent = locName;
  tempLarge.textContent = weatherData?.temp || day?.temp || '72°F';
  condEl.textContent = weatherData ? meta.desc : '7-Day Outlook';
  const weatherScene = document.getElementById('weatherScene');
  if (weatherScene) weatherScene.className = `weather-scene weather-scene--${meta.tone} absolute inset-0 pointer-events-none`;

  const auraColors = {
    sunny: ['bg-amber-400/20', 'bg-orange-400/15'],
    partly: ['bg-amber-300/18', 'bg-sky-400/18'],
    cloudy: ['bg-slate-300/15', 'bg-sky-400/15'],
    rain: ['bg-sky-400/22', 'bg-indigo-500/20'],
    snow: ['bg-cyan-200/20', 'bg-sky-300/20'],
    storm: ['bg-violet-500/22', 'bg-amber-400/18']
  }[meta.tone] || ['bg-amber-400/15', 'bg-sky-400/15'];

  if (aura1) aura1.className = `pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full ${auraColors[0]} blur-3xl transition-colors duration-700`;
  if (aura2) aura2.className = `pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full ${auraColors[1]} blur-3xl transition-colors duration-700`;

  const today = daily[0];
  const pills = [];
  if (today) pills.push(`H: ${today.max}° · L: ${today.min}°`);
  if (weatherData?.humidity) pills.push(`Humidity ${weatherData.humidity}%`);
  if (weatherData?.wind) pills.push(`Wind ${weatherData.wind} mph`);
  telemetryEl.innerHTML = pills.map((p) => `
    <span class="px-2.5 py-1 rounded-full bg-black/30 border border-white/10 font-medium tabular-nums">${esc(p)}</span>
  `).join('');

  const weekMin = Math.min(...daily.map((d) => d.min));
  const weekMax = Math.max(...daily.map((d) => d.max));
  const span = Math.max(1, weekMax - weekMin);

  gridEl.innerHTML = daily.map((d, idx) => {
    const isToday = idx === 0;
    const leftPct = Math.round(((d.min - weekMin) / span) * 100);
    const widthPct = Math.max(18, Math.round(((d.max - d.min) / span) * 100));
    const clampedWidth = Math.min(100 - leftPct, widthPct);

    return `
      <div
        class="group/wday relative rounded-2xl p-3 sm:p-3.5 border backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 animate-fadeUp ${
          isToday
            ? 'bg-gradient-to-b from-white/18 to-sky-500/12 border-sky-300/40 shadow-lg shadow-sky-950/40'
            : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/12 hover:border-white/25'
        }"
        style="animation-delay: ${idx * 45}ms;"
      >
        <div class="flex items-center justify-between gap-1">
          <div>
            <div class="text-xs font-bold tracking-wide ${isToday ? 'text-sky-200' : 'text-white'}">${esc(d.dayLabel)}</div>
            <div class="text-[10px] text-white/50">${esc(d.dateLabel)}</div>
          </div>
          ${d.precip > 0 ? `
            <span class="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-sky-500/20 border border-sky-400/30 text-sky-200 tabular-nums">${d.precip}%</span>
          ` : ''}
        </div>

        <div class="my-2.5 flex items-center justify-center transition-transform duration-300 group-hover/wday:scale-110">
          ${getAnimatedWeatherSvg(d.code, 'w-10 h-10')}
        </div>

        <div class="text-[10px] text-center text-white/65 truncate mb-2">${esc(d.desc)}</div>

        <div class="space-y-1">
          <div class="relative h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
            <div
              class="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-sky-400 via-amber-300 to-orange-400 origin-left animate-weatherBarGrow"
              style="left: ${leftPct}%; width: ${clampedWidth}%; animation-delay: ${120 + idx * 45}ms;"
            ></div>
          </div>
          <div class="flex items-center justify-between text-xs tabular-nums">
            <span class="text-white/55 font-medium">${d.min}°</span>
            <span class="text-white font-bold">${d.max}°</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

export function setWeatherPanelExpanded(expanded) {
  appStore.weatherPanelExpanded = expanded;
  const wrap = document.getElementById('sevenDayGridWrap');
  const label = document.getElementById('toggleWeatherLabel');
  const chev = document.getElementById('toggleWeatherChevron');
  const btn = document.getElementById('toggleWeatherForecastBtn');
  if (!wrap) return;
  wrap.classList.toggle('hidden', !expanded);
  if (label) label.textContent = expanded ? 'Hide' : 'Show 7-Day';
  if (chev) chev.classList.toggle('rotate-180', expanded);
  if (btn) btn.setAttribute('aria-expanded', String(expanded));
}

export async function syncLiveWeatherForActiveDay() {
  const day = appStore.state.days[appStore.activeCarouselIndex];
  if (!day) return;

  renderSevenDayWeather(day, null);
  const live = await fetchLiveWeatherForLocation(day.location);
  if (live) {
    day.temp = live.temp;
    if (appStore.state.days[appStore.activeCarouselIndex]?.id === day.id) {
      renderSevenDayWeather(day, live);
    }
    renderForecastStrip();
    renderCarousel();
  }
}

export async function prefetchAllDaysWeather() {
  await Promise.all(
    appStore.state.days.map(async (d) => {
      const live = await fetchLiveWeatherForLocation(d.location);
      if (live) d.temp = live.temp;
    })
  );
  syncLiveWeatherForActiveDay();
}

/**
 * Core Dashboard Renderers: Readiness Stats, Hero, Forecast Strip, 3D Carousel
 */
export function getReadinessStats() {
  let total = 0;
  let done = 0;
  appStore.state.checklists.forEach((g) => {
    total += g.items.length;
    done += g.items.filter((i) => i.done).length;
  });
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, percent };
}

export function renderHero() {
  document.getElementById('heroTitle').textContent = appStore.state.meta.title;
  document.getElementById('heroSubtitle').textContent = appStore.state.meta.subtitle;

  const countBadge = document.getElementById('tripsCountBadge');
  if (countBadge) countBadge.textContent = String(appStore.trips.length);

  const { percent } = getReadinessStats();
  document.getElementById('heroProgressPct').textContent = `${percent}%`;
  const ring = document.getElementById('heroProgressRing');
  const circumference = 100.53;
  ring.style.strokeDashoffset = String(circumference - (percent / 100) * circumference);
}

export function renderForecastStrip() {
  const strip = document.getElementById('forecastStrip');
  const dayCards = appStore.state.days.map((day, idx) => {
    const isActive = idx === appStore.activeCarouselIndex;
    return `
      <button
        type="button"
        data-strip-idx="${idx}"
        class="group relative rounded-2xl p-3.5 text-left transition-all duration-300 backdrop-blur-2xl border cursor-pointer ${
          isActive
            ? 'bg-white/20 border-white/40 shadow-[0_12px_36px_rgba(0,0,0,0.35)] scale-[1.02]'
            : 'bg-white/10 hover:bg-white/16 border-white/15 hover:border-white/30'
        }"
      >
        <div class="flex items-center justify-between gap-1">
          <span class="text-lg sm:text-xl font-semibold text-white tabular-nums">${esc(day.temp || '72°F')}</span>
          <span class="w-2 h-2 rounded-full ${isActive ? 'bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.9)]' : 'bg-white/25'}"></span>
        </div>
        <div class="mt-2.5">
          <div class="text-xs font-bold tracking-wider uppercase text-white/95">${esc(day.shortDay || `DAY ${idx + 1}`)}</div>
          <div class="text-[11px] text-white/65 truncate">${esc(day.location || day.shortDate || '')}</div>
        </div>
      </button>
    `;
  }).join('');

  const metaCards = [
    { label: 'TRIP LENGTH', value: appStore.state.meta.tripLength, sub: 'California' },
    { label: 'DEPARTURE', value: appStore.state.meta.firstDeparture, sub: 'First Leg' },
    { label: 'HOTEL PLAN', value: appStore.state.meta.hotelPlan, sub: '2 Stays' }
  ].map((m) => `
    <div class="rounded-2xl p-3.5 bg-black/25 backdrop-blur-2xl border border-white/10 flex flex-col justify-between">
      <div class="text-[10px] font-bold uppercase tracking-wider text-white/50">${esc(m.label)}</div>
      <div class="mt-2">
        <div class="text-xs sm:text-sm font-semibold text-white truncate">${esc(m.value)}</div>
        <div class="text-[11px] text-white/55 truncate">${esc(m.sub)}</div>
      </div>
    </div>
  `).join('');

  strip.innerHTML = dayCards + metaCards;
  strip.querySelectorAll('[data-strip-idx]').forEach((btn) => {
    btn.addEventListener('click', () => setActiveCarouselIndex(Number(btn.dataset.stripIdx)));
  });
}

export function setActiveCarouselIndex(nextIdx) {
  if (appStore.state.days.length === 0) return;
  appStore.activeCarouselIndex = (nextIdx + appStore.state.days.length) % appStore.state.days.length;
  updateBackdropForDay(appStore.state.days[appStore.activeCarouselIndex]);
  renderHero();
  renderForecastStrip();
  renderCarousel();
  plannerHooks.renderItinerary();
  syncLiveWeatherForActiveDay();
}

export function renderCarousel() {
  const track = document.getElementById('carouselTrack');
  const dots = document.getElementById('carouselDots');
  const counter = document.getElementById('carouselCounter');

  if (appStore.state.days.length === 0) {
    track.dataset.dayIds = '';
    track.innerHTML = `<div class="rounded-3xl bg-white/10 backdrop-blur-2xl border border-white/15 px-8 py-12 text-sm text-white/75">No days yet. Click "Add Day" above.</div>`;
    dots.innerHTML = '';
    counter.textContent = '0 / 0';
    return;
  }

  if (appStore.activeCarouselIndex >= appStore.state.days.length) appStore.activeCarouselIndex = 0;
  counter.textContent = `${appStore.activeCarouselIndex + 1} / ${appStore.state.days.length}`;

  const total = appStore.state.days.length;
  const vw = window.innerWidth;
  const isMobile = vw < 640;
  const canHoverTilt = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const nextDayIds = appStore.state.days.map((d) => d.id).join('|');
  const needsRebuild = track.dataset.dayIds !== nextDayIds;

  if (needsRebuild) {
    track.dataset.dayIds = nextDayIds;
    track.innerHTML = appStore.state.days.map((day, idx) => `
      <div
        data-carousel-card="${idx}"
        data-day-id="${esc(day.id)}"
        data-is-center="0"
        class="group absolute w-[min(84vw,300px)] sm:w-[440px] h-[285px] sm:h-[330px] rounded-[28px] overflow-hidden border border-white/25 bg-[#12141c] shadow-[0_25px_70px_rgba(0,0,0,0.65)] transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d] will-change-transform"
      >
        <div data-parallax-bg class="absolute -inset-4 transition-transform duration-300 ease-out pointer-events-none">
          <img
            data-card-photo
            src="${esc(getCardPhotoUrl(day))}"
            alt="${esc(day.location || day.title)}"
            onerror="this.onerror=null;this.src='https://placehold.co/900x600/181920/ffffff?text=${encodeURIComponent(day.location || 'Destination')}';"
            class="w-full h-full object-cover object-center"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/20"></div>
        </div>

        <div data-glare class="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-300" style="background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.28), transparent 60%);"></div>

        <div data-parallax-fg class="relative z-10 h-full p-5 sm:p-7 flex flex-col justify-between transition-transform duration-300 ease-out">
          <div class="flex items-start justify-between gap-2">
            <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span data-card-badge class="px-2.5 sm:px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-black/45 border border-white/20 backdrop-blur-xl text-white">
                ${esc(day.shortDay || `Day ${idx + 1}`)} · ${esc(day.shortDate || '')}
              </span>
              <span data-card-temp class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/15 border border-white/20 backdrop-blur-xl text-orange-100">
                ${esc(day.temp || '72°F')}
              </span>
            </div>

            <div class="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 shrink-0">
              <button type="button" data-card-edit="${esc(day.id)}" title="Edit Day" class="w-8 h-8 rounded-full bg-black/50 hover:bg-white/25 border border-white/20 backdrop-blur-xl flex items-center justify-center text-white transition-colors cursor-pointer">
                ${ICONS.edit}
              </button>
              <button type="button" data-card-delete="${esc(day.id)}" title="Delete Day" class="w-8 h-8 rounded-full bg-rose-600/80 hover:bg-rose-500 border border-white/20 flex items-center justify-center text-white transition-colors cursor-pointer">
                ${ICONS.trash}
              </button>
            </div>
          </div>

          <div class="space-y-2.5">
            <div>
              <div data-card-location class="text-[11px] font-semibold uppercase tracking-widest text-sky-300">${esc(day.location || 'California')}</div>
              <h3 data-card-title class="text-lg sm:text-2xl font-bold text-white tracking-tight leading-snug drop-shadow">${esc(day.title)}</h3>
              <p data-card-subtitle class="text-xs sm:text-sm text-white/80 line-clamp-2 mt-0.5">${esc(day.subtitle)}</p>
            </div>

            <div class="pt-2.5 border-t border-white/15 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 text-xs text-white/85 min-w-0">
                <span data-card-tag class="px-2.5 py-0.5 rounded-full bg-white/15 border border-white/15 text-[11px] font-medium truncate">${esc(day.tag || 'Itinerary')}</span>
                <span data-card-stops class="text-white/60 shrink-0">${day.events.length} stops</span>
              </div>
              <button type="button" data-card-add-stop="${esc(day.id)}" class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/15 hover:bg-sky-500/35 border border-white/25 text-xs font-semibold text-white transition-all duration-200 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer shrink-0">
                ${ICONS.plus}
                <span>Stop</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    track.querySelectorAll('[data-carousel-card]').forEach((card) => {
      const bg = card.querySelector('[data-parallax-bg]');
      const fg = card.querySelector('[data-parallax-fg]');
      const glare = card.querySelector('[data-glare]');

      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        if (card.dataset.isCenter !== '1') {
          setActiveCarouselIndex(Number(card.dataset.carouselCard));
        }
      });

      card.addEventListener('mousemove', (e) => {
        if (!canHoverTilt || card.dataset.isCenter !== '1') return;
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        const tiltX = (0.5 - py) * 14;
        const tiltY = (px - 0.5) * 16;

        card.style.transition = 'transform 0.08s ease-out';
        card.style.transform = `translate3d(0px, 0, 46px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.02)`;
        if (bg) bg.style.transform = `translate3d(${(px - 0.5) * -18}px, ${(py - 0.5) * -14}px, 0) scale(1.06)`;
        if (fg) fg.style.transform = `translate3d(${(px - 0.5) * 10}px, ${(py - 0.5) * 8}px, 28px)`;
        if (glare) {
          glare.style.opacity = '1';
          glare.style.background = `radial-gradient(circle at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.28), transparent 58%)`;
        }
      });

      card.addEventListener('mouseleave', () => {
        if (!canHoverTilt || card.dataset.isCenter !== '1') return;
        card.style.transition = 'transform 0.45s cubic-bezier(0.22,1,0.36,1)';
        card.style.transform = `translate3d(0px, 0, 40px) rotateX(0deg) rotateY(0deg) scale(1)`;
        if (bg) bg.style.transform = `translate3d(0,0,0) scale(1)`;
        if (fg) fg.style.transform = `translate3d(0,0,0)`;
        if (glare) glare.style.opacity = '0';
      });
    });

    track.querySelectorAll('[data-card-edit]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        plannerHooks.openDayModal(btn.dataset.cardEdit);
      });
    });
    track.querySelectorAll('[data-card-delete]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        plannerHooks.confirmDeleteDay(btn.dataset.cardDelete);
      });
    });
    track.querySelectorAll('[data-card-add-stop]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        plannerHooks.openEventModal(btn.dataset.cardAddStop, null);
      });
    });
  }

  const mobileStepX = Math.round(Math.min(220, Math.max(150, vw * 0.56)));

  track.querySelectorAll('[data-carousel-card]').forEach((card, idx) => {
    const day = appStore.state.days[idx];
    if (!day) return;

    let offset = idx - appStore.activeCarouselIndex;
    if (offset > total / 2) offset -= total;
    if (offset < -total / 2) offset += total;

    const absOff = Math.abs(offset);
    const isCenter = offset === 0;
    const isHidden = absOff > 1;
    const xShift = offset * (isMobile ? mobileStepX : 340);
    const zShift = isCenter ? (isMobile ? 20 : 40) : (isMobile ? -120 * absOff : -150 * absOff);
    const rotY = offset * (isMobile ? -14 : -26);
    const scale = isCenter ? 1 : Math.max(0.76, 1 - absOff * 0.14);
    const opacity = isHidden ? 0 : (isCenter ? 1 : 0.62);
    const zIndex = 30 - absOff * 10;

    card.dataset.carouselCard = String(idx);
    card.dataset.isCenter = isCenter ? '1' : '0';

    card.style.transition = '';
    card.style.transform = `translate3d(${xShift}px, 0, ${zShift}px) rotateY(${rotY}deg) scale(${scale})`;
    card.style.opacity = String(opacity);
    card.style.visibility = isHidden ? 'hidden' : 'visible';
    card.style.zIndex = String(zIndex);
    card.style.pointerEvents = isHidden ? 'none' : 'auto';

    card.classList.toggle('ring-1', isCenter);
    card.classList.toggle('ring-white/30', isCenter);
    card.classList.toggle('cursor-pointer', !isCenter);
    card.classList.toggle('hover:opacity-90', !isCenter);

    if (!isCenter) {
      const bg = card.querySelector('[data-parallax-bg]');
      const fg = card.querySelector('[data-parallax-fg]');
      const glare = card.querySelector('[data-glare]');
      if (bg) bg.style.transform = `translate3d(0,0,0) scale(1)`;
      if (fg) fg.style.transform = `translate3d(0,0,0)`;
      if (glare) glare.style.opacity = '0';
    }

    const photoEl = card.querySelector('[data-card-photo]');
    const nextPhoto = getCardPhotoUrl(day);
    if (photoEl && photoEl.getAttribute('src') !== nextPhoto) {
      photoEl.setAttribute('src', nextPhoto);
    }
    const badgeEl = card.querySelector('[data-card-badge]');
    if (badgeEl) badgeEl.textContent = `${day.shortDay || `Day ${idx + 1}`} · ${day.shortDate || ''}`;
    const tempEl = card.querySelector('[data-card-temp]');
    if (tempEl) tempEl.textContent = day.temp || '72°F';
    const locEl = card.querySelector('[data-card-location]');
    if (locEl) locEl.textContent = day.location || 'California';
    const titleEl = card.querySelector('[data-card-title]');
    if (titleEl) titleEl.textContent = day.title;
    const subEl = card.querySelector('[data-card-subtitle]');
    if (subEl) subEl.textContent = day.subtitle;
    const tagEl = card.querySelector('[data-card-tag]');
    if (tagEl) tagEl.textContent = day.tag || 'Itinerary';
    const stopsEl = card.querySelector('[data-card-stops]');
    if (stopsEl) stopsEl.textContent = `${day.events.length} stops`;
  });

  dots.innerHTML = appStore.state.days.map((d, idx) => `
    <button type="button" data-dot-idx="${idx}" aria-label="Go to Day ${idx + 1}" class="h-2 rounded-full transition-all duration-300 cursor-pointer ${
      idx === appStore.activeCarouselIndex ? 'w-8 bg-gradient-to-r from-orange-400 to-sky-400' : 'w-2 bg-white/25 hover:bg-white/50'
    }"></button>
  `).join('');

  dots.querySelectorAll('[data-dot-idx]').forEach((dot) => {
    dot.addEventListener('click', () => setActiveCarouselIndex(Number(dot.dataset.dotIdx)));
  });
}