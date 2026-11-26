import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";
import {
  normalizeTripSchedules,
  computeTripTravelLegs
} from './trip-timeline-engine.js';

/**
 * Crisp Inline SVG Icon Library (Including Cute Booki Mascot, Visibility & Rich-Text Icons)
 */
export const ICONS = {
  booki: `<svg viewBox="0 0 32 32" fill="none" class="w-6 h-6">
    <defs>
      <linearGradient id="bookiBodyGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#fb923c" />
        <stop offset="52%" stop-color="#f472b6" />
        <stop offset="100%" stop-color="#38bdf8" />
      </linearGradient>
    </defs>
    <!-- Cute Bookmark Ribbon -->
    <path d="M19.5 3.5h5v6.5l-2.5-1.8-2.5 1.8V3.5Z" fill="#fde047" stroke="#fef08a" stroke-width="0.8" stroke-linejoin="round"/>
    <!-- Rounded Notebook / Pass Body -->
    <rect x="5" y="6" width="22" height="22" rx="6.5" fill="url(#bookiBodyGrad)" stroke="rgba(255,255,255,0.55)" stroke-width="1.2"/>
    <!-- Soft Glass Shine -->
    <path d="M9.5 8.5h7" stroke="rgba(255,255,255,0.55)" stroke-width="1.4" stroke-linecap="round"/>
    <!-- Cute Smiling Face -->
    <circle cx="12.2" cy="16.4" r="1.45" fill="#0f172a"/>
    <circle cx="19.8" cy="16.4" r="1.45" fill="#0f172a"/>
    <circle cx="12.7" cy="15.9" r="0.45" fill="#ffffff"/>
    <circle cx="20.3" cy="15.9" r="0.45" fill="#ffffff"/>
    <!-- Rosy Cheeks -->
    <ellipse cx="9.8" cy="18.6" rx="1.5" ry="0.9" fill="rgba(255,228,230,0.65)"/>
    <ellipse cx="22.2" cy="18.6" rx="1.5" ry="0.9" fill="rgba(255,228,230,0.65)"/>
    <!-- Happy Smile -->
    <path d="M13.6 19.6c1.2 1.5 3.6 1.5 4.8 0" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round"/>
    <!-- Little Sparkle -->
    <path d="M26.5 22.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4Z" fill="#fef08a"/>
  </svg>`,
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`,
  highlighter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>`,
  listBullet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor"/></svg>`,
  listNumber: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>`,
  checklist: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><rect x="3" y="5" width="6" height="6" rx="1.2"/><path d="m4.5 8 1.2 1.2 2-2.2"/><line x1="12" y1="8" x2="21" y2="8"/><rect x="3" y="14" width="6" height="6" rx="1.2"/><line x1="12" y1="17" x2="21" y2="17"/></svg>`,
  clearFormat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M4 7V4h16v3"/><path d="M5 20h6"/><path d="M13 4 8 20"/><path d="m15 15 5 5"/><path d="m20 15-5 5"/></svg>`,
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
  hash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`,
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

/**
 * Booki Categories (Dynamic Labels, Placeholders & Color Themes)
 */
export const RESERVATION_TYPE_META = {
  hotel: {
    label: 'Hotel / Airbnb',
    shortLabel: 'Hotels',
    icon: 'hotel',
    style: 'bg-gradient-to-br from-indigo-500/25 to-blue-500/20 border-indigo-400/40 text-indigo-300 shadow-indigo-500/15',
    accent: 'bg-gradient-to-r from-indigo-400 via-sky-400 to-transparent',
    rgb: [129, 140, 248],
    titlePlaceholder: 'e.g. The Mission Inn Hotel & Spa · Palm Desert Airbnb',
    providerPlaceholder: 'e.g. Booking.com · Marriott · Airbnb Host',
    locationPlaceholder: 'e.g. 3649 Mission Inn Ave, Riverside, CA',
    startLabel: 'Check-In',
    endLabel: 'Check-Out',
    linkLabelPlaceholder: 'e.g. Marriott, Airbnb',
    codePlaceholder: 'e.g. HTL-849201',
    notePlaceholder: 'e.g. Early check-in requested, door code #4821, parking pass...'
  },
  flight: {
    label: 'Flight',
    shortLabel: 'Flights',
    icon: 'plane',
    style: 'bg-gradient-to-br from-sky-500/25 to-cyan-500/20 border-sky-400/40 text-sky-300 shadow-sky-500/15',
    accent: 'bg-gradient-to-r from-sky-400 via-cyan-300 to-transparent',
    rgb: [56, 189, 248],
    titlePlaceholder: 'e.g. LAX → PSP · Delta DL 1422',
    providerPlaceholder: 'e.g. Delta Air Lines · Terminal 3 · Seats 12A/12B',
    locationPlaceholder: 'e.g. Los Angeles (LAX) → Palm Springs (PSP)',
    startLabel: 'Departure',
    endLabel: 'Arrival',
    linkLabelPlaceholder: 'e.g. Delta Check-In',
    codePlaceholder: 'e.g. PNR-X7K9M2',
    notePlaceholder: 'e.g. Boarding Group 2, 1 carry-on + stroller gate check...'
  },
  car: {
    label: 'Rental Car',
    shortLabel: 'Rental Car',
    icon: 'drive',
    style: 'bg-gradient-to-br from-emerald-500/25 to-teal-500/20 border-emerald-400/40 text-emerald-300 shadow-emerald-500/15',
    accent: 'bg-gradient-to-r from-emerald-400 via-teal-300 to-transparent',
    rgb: [52, 211, 153],
    titlePlaceholder: 'e.g. Midsize SUV · Enterprise',
    providerPlaceholder: 'e.g. Enterprise · Hertz · Turo',
    locationPlaceholder: 'e.g. PSP Airport Rental Center',
    startLabel: 'Pick-Up',
    endLabel: 'Drop-Off',
    linkLabelPlaceholder: 'e.g. Enterprise, Turo',
    codePlaceholder: 'e.g. CAR-559012',
    notePlaceholder: 'e.g. Full-to-full fuel policy, car seat requested, Skip the Counter...'
  },
  restaurant: {
    label: 'Restaurant',
    shortLabel: 'Dining',
    icon: 'food',
    style: 'bg-gradient-to-br from-amber-500/25 to-orange-500/20 border-amber-400/40 text-amber-300 shadow-amber-500/15',
    accent: 'bg-gradient-to-r from-amber-400 via-orange-400 to-transparent',
    rgb: [251, 191, 36],
    titlePlaceholder: 'e.g. Peaks Restaurant · Sunset Dinner',
    providerPlaceholder: 'e.g. OpenTable · Party of 3 (2 Adults, 1 Infant)',
    locationPlaceholder: 'e.g. Mountain Station, Palm Springs, CA',
    startLabel: 'Reservation',
    endLabel: 'End Time',
    linkLabelPlaceholder: 'e.g. Peaks Dining, Menu',
    codePlaceholder: 'e.g. OT-39284',
    notePlaceholder: 'e.g. Window table requested, high chair needed, 15-min grace period...'
  },
  ticket: {
    label: 'Attraction & Tickets',
    shortLabel: 'Tickets',
    icon: 'ticket',
    style: 'bg-gradient-to-br from-rose-500/25 to-fuchsia-500/20 border-rose-400/40 text-rose-300 shadow-rose-500/15',
    accent: 'bg-gradient-to-r from-rose-400 via-fuchsia-400 to-transparent',
    rgb: [251, 113, 133],
    titlePlaceholder: 'e.g. WildLights Day + Night Bundle · Tramway',
    providerPlaceholder: 'e.g. Official Site · 2 Adults, 1 Infant (Free)',
    locationPlaceholder: 'e.g. The Living Desert Zoo, Palm Desert, CA',
    startLabel: 'Start / Entry',
    endLabel: 'End / Exit',
    linkLabelPlaceholder: 'e.g. Tram, 123 Farm',
    codePlaceholder: 'e.g. TKT-904821',
    notePlaceholder: 'e.g. Mobile QR code saved in Apple Wallet, arrive 15 mins early...'
  }
};

/**
 * Reservation Status Themes & One-Click Cycle Map
 */
export const RESERVATION_STATUS_META = {
  confirmed: {
    label: 'Confirmed',
    next: 'pending',
    cardClass: 'reservation-card--confirmed',
    badgeClass: 'bg-emerald-500/18 border-emerald-400/45 text-emerald-200',
    dotClass: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]',
    rgb: [52, 211, 153]
  },
  pending: {
    label: 'Pending',
    next: 'cancelled',
    cardClass: 'reservation-card--pending',
    badgeClass: 'bg-amber-500/18 border-amber-400/45 text-amber-200',
    dotClass: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.85)]',
    rgb: [251, 191, 36]
  },
  cancelled: {
    label: 'Cancelled',
    next: 'confirmed',
    cardClass: 'reservation-card--cancelled',
    badgeClass: 'bg-rose-500/18 border-rose-400/45 text-rose-200',
    dotClass: 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.85)]',
    rgb: [251, 113, 133]
  }
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
 * Utilities: ID generator, HTML Escaping, Coordinate Normalization, Booki Date/Time & Rich Notes Helpers
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

export function normalizeLocationCoords(coords) {
  if (!coords || typeof coords !== 'object') return null;
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/**
 * Booki Date & Time Formatting / Legacy Parsing Helpers
 */
const BOOKI_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BOOKI_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BOOKI_MONTH_MAP = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
};

export function formatBookingTime12h(timeStr) {
  const m = String(timeStr || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  let h = Number(m[1]);
  const mins = m[2];
  if (h < 0 || h > 23) return '';
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mins} ${period}`;
}

export function formatBookingDate(dateStr) {
  const m = String(dateStr || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const yr = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  const dt = new Date(yr, mo - 1, da);
  if (Number.isNaN(dt.getTime())) return '';
  return `${BOOKI_DAY_NAMES[dt.getDay()]}, ${BOOKI_MONTH_NAMES[dt.getMonth()]} ${dt.getDate()}`;
}

export function formatBookingDateTime(dateStr, timeStr, fallbackText = '') {
  const dPart = formatBookingDate(dateStr);
  const tPart = formatBookingTime12h(timeStr);
  if (dPart && tPart) return `${dPart} · ${tPart}`;
  if (dPart) return dPart;
  if (tPart) return tPart;
  return String(fallbackText || '').trim();
}

export function parseLegacyBookingDateTime(rawText, defaultYear = new Date().getFullYear()) {
  const text = String(rawText || '').trim();
  if (!text) return { date: '', time: '' };

  let date = '';
  let time = '';

  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    date = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  } else {
    const monMatch = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,?\s*(\d{4}))?/i);
    if (monMatch) {
      const mo = BOOKI_MONTH_MAP[monMatch[1].toLowerCase()];
      const da = Number(monMatch[2]);
      const yr = monMatch[3] ? Number(monMatch[3]) : defaultYear;
      if (mo && da >= 1 && da <= 31) {
        date = `${yr}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
      }
    }
  }

  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (timeMatch) {
    let h = Number(timeMatch[1]);
    const mins = timeMatch[2] ? Number(timeMatch[2]) : 0;
    const mer = timeMatch[3].toUpperCase();
    if (mer === 'AM') {
      if (h === 12) h = 0;
    } else if (mer === 'PM') {
      if (h !== 12) h += 12;
    }
    if (h >= 0 && h <= 23 && mins >= 0 && mins <= 59) {
      time = `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
  }

  return { date, time };
}

/**
 * Custom Link Label Helper (Displays "Tram", "123 Farm", etc. Instead of Generic "Open")
 */
export function getBookingLinkLabel(res) {
  const custom = String(res?.bookingLinkLabel || '').trim();
  if (custom) return custom;

  const title = String(res?.title || '').trim();
  if (title) {
    const cleaned = title
      .split(/[·–—|(]/)[0]
      .replace(/\b(tickets?|info|reservation|booking|bundle|day\s*\+\s*night|christmas\s*nights|festival\s*of\s*lights|sunset\s*dinner)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const chosen = cleaned || title;
    return chosen.length > 22 ? `${chosen.slice(0, 20).trim()}…` : chosen;
  }

  const url = String(res?.bookingUrl || '').trim();
  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./i, '').split('.')[0];
      if (host) return host.charAt(0).toUpperCase() + host.slice(1);
    } catch (err) {
      // Fallback below
    }
  }
  return 'Website';
}

export function normalizeReservationItem(raw) {
  const type = RESERVATION_TYPE_META[raw?.type] ? raw.type : 'hotel';
  const status = RESERVATION_STATUS_META[raw?.status] ? raw.status : 'pending';

  let startDate = String(raw?.startDate || '').trim();
  let startTime = String(raw?.startTime || '').trim();
  let endDate = String(raw?.endDate || '').trim();
  let endTime = String(raw?.endTime || '').trim();

  const rawCheckIn = String(raw?.checkIn || '').trim();
  const rawCheckOut = String(raw?.checkOut || '').trim();

  if (!startDate && !startTime && rawCheckIn) {
    const parsedIn = parseLegacyBookingDateTime(rawCheckIn, 2026);
    startDate = parsedIn.date;
    startTime = parsedIn.time;
  }
  if (!endDate && !endTime && rawCheckOut) {
    const parsedOut = parseLegacyBookingDateTime(rawCheckOut, 2026);
    endDate = parsedOut.date;
    endTime = parsedOut.time;
  }

  const checkIn = formatBookingDateTime(startDate, startTime, rawCheckIn);
  const checkOut = formatBookingDateTime(endDate, endTime, rawCheckOut);

  return {
    id: raw?.id || uid('res'),
    type,
    status,
    title: String(raw?.title || '').trim(),
    provider: String(raw?.provider || '').trim(),
    location: String(raw?.location || '').trim(),
    startDate,
    startTime,
    endDate,
    endTime,
    checkIn,
    checkOut,
    confirmationNumber: String(raw?.confirmationNumber || '').trim(),
    bookingUrl: String(raw?.bookingUrl || '').trim(),
    bookingLinkLabel: String(raw?.bookingLinkLabel || '').trim(),
    notes: String(raw?.notes || '').trim()
  };
}

/**
 * Rich-Text Notes Sanitization & Plain-Text Conversion Helpers
 */
export function plainTextToRichHtml(plainText) {
  const text = String(plainText || '');
  if (!text.trim()) return '';
  return text
    .split(/\r?\n/)
    .map((line) => (line ? `<div>${esc(line)}</div>` : '<div><br></div>'))
    .join('');
}

export function sanitizeRichNotesHtml(rawHtml) {
  const html = String(rawHtml || '').trim();
  if (!html) return '';

  const template = document.createElement('template');
  template.innerHTML = html;

  const allowedTags = new Set([
    'DIV', 'P', 'BR', 'SPAN', 'FONT', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL',
    'UL', 'OL', 'LI', 'INPUT', 'LABEL', 'A', 'H1', 'H2', 'H3', 'BLOCKQUOTE'
  ]);
  const allowedStyleProps = new Set([
    'font-family', 'font-size', 'color', 'background-color', 'font-weight',
    'font-style', 'text-decoration', 'text-decoration-line'
  ]);

  const cleanNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.remove();
      return;
    }

    const tag = node.tagName.toUpperCase();
    if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'FORM'].includes(tag)) {
      node.remove();
      return;
    }

    if (!allowedTags.has(tag)) {
      const parent = node.parentNode;
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      node.remove();
      return;
    }

    // Strip dangerous attributes & event handlers
    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        node.removeAttribute(attr.name);
        return;
      }

      if (name === 'style') {
        const safeRules = [];
        attr.value.split(';').forEach((rule) => {
          const idx = rule.indexOf(':');
          if (idx <= 0) return;
          const prop = rule.slice(0, idx).trim().toLowerCase();
          const val = rule.slice(idx + 1).trim();
          if (allowedStyleProps.has(prop) && val && !/expression|url\s*\(|javascript:/i.test(val)) {
            safeRules.push(`${prop}: ${val}`);
          }
        });
        if (safeRules.length) node.setAttribute('style', safeRules.join('; '));
        else node.removeAttribute('style');
        return;
      }

      if (tag === 'INPUT') {
        if (!['type', 'checked', 'class', 'aria-label'].includes(name)) {
          node.removeAttribute(attr.name);
        }
        return;
      }

      if (tag === 'A') {
        if (name === 'href') {
          if (!/^https?:\/\//i.test(attr.value.trim())) node.removeAttribute('href');
          else {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer');
          }
        } else if (!['target', 'rel', 'class', 'style'].includes(name)) {
          node.removeAttribute(attr.name);
        }
        return;
      }

      if (tag === 'FONT') {
        if (!['face', 'size', 'color', 'style'].includes(name)) node.removeAttribute(attr.name);
        return;
      }

      if (name === 'class') {
        const safeClasses = attr.value
          .split(/\s+/)
          .filter((c) => ['rte-checklist', 'rte-check-item', 'is-checked', 'rte-checkbox', 'rte-check-text'].includes(c));
        if (safeClasses.length) node.setAttribute('class', safeClasses.join(' '));
        else node.removeAttribute('class');
        return;
      }

      if (name === 'contenteditable') {
        if (attr.value !== 'false') node.removeAttribute('contenteditable');
        return;
      }

      node.removeAttribute(attr.name);
    });

    if (tag === 'INPUT') {
      node.setAttribute('type', 'checkbox');
      node.classList.add('rte-checkbox');
    }

    Array.from(node.childNodes).forEach(cleanNode);
  };

  Array.from(template.content.childNodes).forEach(cleanNode);
  return template.innerHTML;
}

export function extractPlainTextFromRichHtml(rawHtml) {
  const html = String(rawHtml || '').trim();
  if (!html) return '';
  const container = document.createElement('div');
  container.innerHTML = html;

  const lines = [];
  const walk = (node, listContext = null) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toUpperCase();

    if (tag === 'BR') return '\n';

    if (tag === 'UL' && node.classList.contains('rte-checklist')) {
      Array.from(node.children).forEach((li) => {
        const chk = li.querySelector('input[type="checkbox"]');
        const txtEl = li.querySelector('.rte-check-text') || li;
        const txt = (txtEl.textContent || '').replace(/\u200B/g, '').trim();
        if (txt) lines.push(`${chk?.checked ? '[x]' : '[ ]'} ${txt}`);
      });
      return '';
    }

    if (tag === 'UL') {
      Array.from(node.children).forEach((li) => {
        const txt = (li.textContent || '').replace(/\u200B/g, '').trim();
        if (txt) lines.push(`• ${txt}`);
      });
      return '';
    }

    if (tag === 'OL') {
      let num = 1;
      Array.from(node.children).forEach((li) => {
        const txt = (li.textContent || '').replace(/\u200B/g, '').trim();
        if (txt) lines.push(`${num++}. ${txt}`);
      });
      return '';
    }

    if (['DIV', 'P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'LI'].includes(tag)) {
      const hasNestedBlocks = Array.from(node.children).some((ch) =>
        ['DIV', 'P', 'UL', 'OL', 'H1', 'H2', 'H3'].includes(ch.tagName.toUpperCase())
      );
      if (hasNestedBlocks) {
        Array.from(node.childNodes).forEach((ch) => {
          const piece = walk(ch, listContext);
          if (piece && piece.trim()) lines.push(piece.trim());
        });
        return '';
      }
      const txt = (node.textContent || '').replace(/\u200B/g, '').trim();
      lines.push(txt);
      return '';
    }

    let acc = '';
    Array.from(node.childNodes).forEach((ch) => {
      acc += walk(ch, listContext);
    });
    return acc;
  };

  Array.from(container.childNodes).forEach((ch) => {
    const out = walk(ch);
    if (out && out.trim()) lines.push(out.trim());
  });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function convertLegacyLinkToReservation(lk) {
  if (!lk || !String(lk.label || '').trim()) return null;
  const icon = String(lk.icon || '').toLowerCase();
  const type = icon === 'hotel'
    ? 'hotel'
    : icon === 'dining'
      ? 'restaurant'
      : 'ticket';

  return normalizeReservationItem({
    id: lk.id ? `res-mig-${lk.id}` : uid('res'),
    type,
    status: 'pending',
    title: lk.label,
    provider: 'Official Booking / Info',
    location: lk.location || '',
    checkIn: lk.hours || '',
    checkOut: '',
    confirmationNumber: '',
    bookingUrl: lk.url || '',
    bookingLinkLabel: lk.label,
    notes: lk.info || ''
  });
}

function normalizeUrlForCompare(url) {
  return String(url || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
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
 * Initial Thanksgiving Getaway Planner State (Booki Bookings with Structured Calendar Dates & Link Titles)
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
        location: 'Riverside, CA',
        locationFullName: 'Riverside, California, United States',
        locationCoords: { lat: 33.9806, lng: -117.3755 },
        locationVerified: true,
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
        location: 'Palm Desert, CA',
        locationFullName: 'Palm Desert, California, United States',
        locationCoords: { lat: 33.7222, lng: -116.3745 },
        locationVerified: true,
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
        location: 'Palm Springs, CA',
        locationFullName: 'Palm Springs, California, United States',
        locationCoords: { lat: 33.8303, lng: -116.5453 },
        locationVerified: true,
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
        location: 'Cherry Valley, CA',
        locationFullName: 'Cherry Valley, California, United States',
        locationCoords: { lat: 33.9722, lng: -116.9772 },
        locationVerified: true,
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
    reservations: [
      normalizeReservationItem({
        id: 'res-1',
        type: 'hotel',
        status: 'pending',
        title: 'Riverside Hotel (1 Night)',
        provider: 'Near Downtown Riverside',
        location: 'Downtown Riverside, CA',
        startDate: '2026-11-27',
        startTime: '17:30',
        endDate: '2026-11-28',
        endTime: '10:30',
        confirmationNumber: '',
        bookingUrl: '',
        bookingLinkLabel: '',
        notes: 'Check in first, unload luggage, and rest before Festival of Lights.'
      }),
      normalizeReservationItem({
        id: 'res-2',
        type: 'hotel',
        status: 'pending',
        title: 'Palm Desert Hotel (2 Nights)',
        provider: 'Close to The Living Desert',
        location: 'Palm Desert, CA',
        startDate: '2026-11-28',
        startTime: '15:00',
        endDate: '2026-11-30',
        endTime: '10:30',
        confirmationNumber: '',
        bookingUrl: '',
        bookingLinkLabel: '',
        notes: 'Ask about early check-in or luggage storage on Saturday around 12:15 PM.'
      }),
      normalizeReservationItem({
        id: 'res-mission-inn',
        type: 'ticket',
        status: 'pending',
        title: 'Mission Inn Festival of Lights',
        provider: 'Festival & Advance Parking Info',
        location: 'Downtown Riverside, CA',
        startDate: '2026-11-27',
        startTime: '17:00',
        endDate: '2026-11-27',
        endTime: '23:00',
        confirmationNumber: '',
        bookingUrl: 'https://www.missioninn.com/festival-of-lights/plan-your-visit/',
        bookingLinkLabel: 'Mission Inn',
        notes: 'Reserve advance parking if possible; closed Thanksgiving & Christmas Day.'
      }),
      normalizeReservationItem({
        id: 'res-3',
        type: 'ticket',
        status: 'pending',
        title: 'WildLights Day + Night Bundle',
        provider: 'The Living Desert · 2 Adults, 1 Infant',
        location: 'Palm Desert, CA',
        startDate: '2026-11-28',
        startTime: '13:30',
        endDate: '2026-11-28',
        endTime: '21:00',
        confirmationNumber: '',
        bookingUrl: 'https://www.livingdesert.org/events/wildlights-2026/2026-11-28/',
        bookingLinkLabel: 'WildLights',
        notes: 'Zoo until 5 PM · WildLights 6–9 PM (last entry 8:30 PM). Check date-specific tickets.'
      }),
      normalizeReservationItem({
        id: 'res-tramway',
        type: 'ticket',
        status: 'pending',
        title: 'Palm Springs Aerial Tramway',
        provider: 'Mountain Station (8,516 ft)',
        location: 'Palm Springs, CA (8,516 ft)',
        startDate: '2026-11-29',
        startTime: '15:45',
        endDate: '2026-11-29',
        endTime: '21:30',
        confirmationNumber: '',
        bookingUrl: 'https://pstramway.com/tickets/',
        bookingLinkLabel: 'Tram',
        notes: 'Mountain Station is 30–40°F colder; pack warm layers. Last tram down 9:30 PM.'
      }),
      normalizeReservationItem({
        id: 'res-4',
        type: 'restaurant',
        status: 'pending',
        title: 'Peaks Restaurant · Sunset Dinner',
        provider: 'Mountain Station · Party of 3',
        location: 'Mountain Station, Palm Springs',
        startDate: '2026-11-29',
        startTime: '17:15',
        endDate: '2026-11-29',
        endTime: '18:45',
        confirmationNumber: '',
        bookingUrl: 'https://pstramway.com/dining/',
        bookingLinkLabel: 'Peaks Dining',
        notes: 'Advance table reservations strongly recommended for sunset seating (5:00–7:45 PM).'
      }),
      normalizeReservationItem({
        id: 'res-air-museum',
        type: 'ticket',
        status: 'pending',
        title: 'Palm Springs Air Museum',
        provider: 'General Admission',
        location: 'Palm Springs, CA',
        startDate: '2026-11-29',
        startTime: '10:00',
        endDate: '2026-11-29',
        endTime: '17:00',
        confirmationNumber: '',
        bookingUrl: 'https://palmspringsairmuseum.org/visit/',
        bookingLinkLabel: 'Air Museum',
        notes: 'Open daily 10 AM – 5 PM; admission applies; great morning family stop.'
      }),
      normalizeReservationItem({
        id: 'res-moorten',
        type: 'ticket',
        status: 'pending',
        title: 'Moorten Botanical Garden',
        provider: 'Historic Desert Garden & Cactarium',
        location: 'Palm Springs, CA',
        startDate: '2026-11-29',
        startTime: '13:30',
        endDate: '2026-11-29',
        endTime: '16:00',
        confirmationNumber: '',
        bookingUrl: 'https://www.moortenbotanicalgarden.com/',
        bookingLinkLabel: 'Moorten Garden',
        notes: 'Season hours 10 AM – 4 PM (Closed Wed). Historic desert botanical garden & Cactarium.'
      }),
      normalizeReservationItem({
        id: 'res-5',
        type: 'ticket',
        status: 'pending',
        title: '123 Farm Christmas Nights',
        provider: 'Weekday Admission',
        location: 'Cherry Valley, CA',
        startDate: '2026-11-30',
        startTime: '17:00',
        endDate: '2026-11-30',
        endTime: '22:00',
        confirmationNumber: '',
        bookingUrl: 'https://ticket.123farm.com/xmas',
        bookingLinkLabel: '123 Farm',
        notes: 'Buy date-specific tickets online; gate tickets may not be available.'
      })
    ],
    notes: '',
    notesHtml: ''
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
  startLocation = 'San Diego, CA',
  startLocationFullName = 'San Diego, California, United States',
  startLocationCoords = { lat: 32.7157, lng: -117.1611 }
} = {}) {
  const loc = String(startLocation || '').trim() || 'San Diego, CA';
  const safeCoords = normalizeLocationCoords(startLocationCoords);
  const fullLoc = String(startLocationFullName || '').trim() || loc;

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
        temp: '--°F',
        location: loc,
        locationFullName: fullLoc,
        locationCoords: safeCoords,
        locationVerified: Boolean(safeCoords),
        landmark: fullLoc,
        cardLandmark: `${fullLoc} sightseeing`,
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
          { id: uid('ev'), time: firstDeparture || '9:00 AM', startMinutes: 9 * 60, durationMinutes: 120, isFixed: false, reservationMinutes: null, completed: false, category: 'drive', text: `Depart for ${loc}. Allow buffer time for traffic and scenic stops.`, location: loc, locationCoords: safeCoords },
          { id: uid('ev'), time: '3:00–4:00 PM', startMinutes: 15 * 60, durationMinutes: 60, isFixed: false, reservationMinutes: null, completed: false, category: 'hotel', text: `Check in to your ${loc} hotel, drop off luggage, and freshen up.`, location: loc, locationCoords: safeCoords },
          { id: uid('ev'), time: '6:00–7:30 PM', startMinutes: 18 * 60, durationMinutes: 90, isFixed: false, reservationMinutes: null, completed: false, category: 'food', text: `Welcome dinner and evening stroll around ${loc}.`, location: loc, locationCoords: safeCoords }
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
    reservations: [],
    notes: '',
    notesHtml: ''
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
  bookiPanelExpanded: true,
  notesPanelExpanded: true,
  expandedBudgetIds: new Set(),
  vaultTypeFilter: 'all',
  vaultStatusFilter: 'all',
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
  const isDefaultThanksgiving = fallbackIdx === 0 && rawTrip?.id === 'trip-thanksgiving-default';
  const base = isDefaultThanksgiving
    ? createInitialState()
    : createNewDefaultTrip();
  const rawDays = Array.isArray(rawTrip?.days) ? rawTrip.days : base.days;
  const normalizedDays = rawDays.map((d) => {
    const safeCoords = normalizeLocationCoords(d?.locationCoords);
    return {
      ...d,
      locationCoords: safeCoords,
      locationFullName: typeof d?.locationFullName === 'string' ? d.locationFullName : '',
      locationVerified: Boolean(safeCoords && d?.locationVerified !== false)
    };
  });

  const normalizedReservations = Array.isArray(rawTrip?.reservations)
    ? rawTrip.reservations.map((r) => normalizeReservationItem(r)).filter((r) => r.title)
    : (isDefaultThanksgiving ? base.reservations.map((r) => normalizeReservationItem(r)) : []);

  // Automatically merge any legacy saved Official Links into Booki (zero duplicates)
  if (Array.isArray(rawTrip?.links) && rawTrip.links.length > 0) {
    const existingUrls = new Set(
      normalizedReservations.map((r) => normalizeUrlForCompare(r.bookingUrl)).filter(Boolean)
    );
    const existingTitles = new Set(
      normalizedReservations.map((r) => r.title.toLowerCase())
    );

    rawTrip.links.forEach((lk) => {
      const converted = convertLegacyLinkToReservation(lk);
      if (!converted) return;
      const normUrl = normalizeUrlForCompare(converted.bookingUrl);
      const normTitle = converted.title.toLowerCase();
      if ((normUrl && existingUrls.has(normUrl)) || existingTitles.has(normTitle)) return;
      normalizedReservations.push(converted);
      if (normUrl) existingUrls.add(normUrl);
      existingTitles.add(normTitle);
    });
  }

  const rawNotesPlain = typeof rawTrip?.notes === 'string' ? rawTrip.notes : '';
  const rawNotesHtml = typeof rawTrip?.notesHtml === 'string' ? sanitizeRichNotesHtml(rawTrip.notesHtml) : '';
  const finalNotesHtml = rawNotesHtml || (rawNotesPlain ? plainTextToRichHtml(rawNotesPlain) : '');
  const finalNotesPlain = finalNotesHtml ? extractPlainTextFromRichHtml(finalNotesHtml) : rawNotesPlain;

  const merged = {
    ...base,
    ...rawTrip,
    id: rawTrip?.id || uid('trip'),
    createdAt: rawTrip?.createdAt || Date.now(),
    customCategories: Array.isArray(rawTrip?.customCategories) ? rawTrip.customCategories : [],
    meta: { ...base.meta, ...(rawTrip?.meta || {}) },
    days: normalizedDays,
    checklists: Array.isArray(rawTrip?.checklists) ? rawTrip.checklists : base.checklists,
    budget: rawTrip?.budget ? { ...base.budget, ...rawTrip.budget } : base.budget,
    reservations: normalizedReservations,
    notes: finalNotesPlain,
    notesHtml: finalNotesHtml
  };
  delete merged.links;
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
  appStore.vaultTypeFilter = 'all';
  appStore.vaultStatusFilter = 'all';

  const track = document.getElementById('carouselTrack');
  if (track) track.dataset.dayIds = '';

  updateBackdropForDay(appStore.state.days[0]);
  plannerHooks.renderAll();
  syncLiveWeatherForActiveDay();
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

  const query = (day.cardLandmark || `${day.locationFullName || day.location || ''} attractions`).trim();
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

  const searchTerm = (day?.landmark || day?.locationFullName || day?.location || '').trim();
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
    reservations: Array.isArray(trip.reservations)
      ? trip.reservations.map((r) => normalizeReservationItem(r))
      : [],
    notes: typeof trip.notes === 'string' ? trip.notes : '',
    notesHtml: typeof trip.notesHtml === 'string' ? trip.notesHtml : ''
  }));
  return JSON.stringify({
    version: 6,
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
                syncLiveWeatherForActiveDay();
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
  const setHtml = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };
  setHtml('editHeroInlineBtn', ICONS.edit);
  setHtml('addDayIcon', ICONS.plus);
  setHtml('addNewTripIcon', ICONS.newTrip);
  setHtml('switchTripsIcon', ICONS.trips);
  setHtml('savePdfIcon', ICONS.download);
  setHtml('prevIcon', ICONS.chevronLeft);
  setHtml('nextIcon', ICONS.chevronRight);
  setHtml('copyNotesIcon', ICONS.copy);
  setHtml('bookiHeaderIcon', ICONS.booki);
  setHtml('toggleBookiIcon', appStore.bookiPanelExpanded ? ICONS.eyeOff : ICONS.eye);
  setHtml('toggleNotesChevron', ICONS.chevronDown);
  setHtml('addReservationIcon', ICONS.plus);
  setHtml('rteHighlightIcon', ICONS.highlighter);
  setHtml('rteBulletIcon', ICONS.listBullet);
  setHtml('rteNumberIcon', ICONS.listNumber);
  setHtml('rteChecklistIcon', ICONS.checklist);
  setHtml('rteClearIcon', ICONS.clearFormat);
  setHtml('modalCloseBtn', ICONS.close);
  setHtml('toggleWeatherChevron', ICONS.chevronDown);
  setHtml('manageCategoriesIcon', ICONS.palette);
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
 * ============================================================================
 * LIVE ANIMATED 7-DAY WEATHER, VERIFIED LOCATION SEARCH & AUTO DAY/NIGHT SKY
 * ============================================================================
 */
const WEATHER_STORAGE_KEY = 'tripos_weather_cache_v4';
const WEATHER_CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes fresh cache

const US_STATE_NAMES = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california',
  CO: 'colorado', CT: 'connecticut', DE: 'delaware', FL: 'florida', GA: 'georgia',
  HI: 'hawaii', ID: 'idaho', IL: 'illinois', IN: 'indiana', IA: 'iowa',
  KS: 'kansas', KY: 'kentucky', LA: 'louisiana', ME: 'maine', MD: 'maryland',
  MA: 'massachusetts', MI: 'michigan', MN: 'minnesota', MS: 'mississippi', MO: 'missouri',
  MT: 'montana', NE: 'nebraska', NV: 'nevada', NH: 'new hampshire', NJ: 'new jersey',
  NM: 'new mexico', NY: 'new york', NC: 'north carolina', ND: 'north dakota', OH: 'ohio',
  OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania', RI: 'rhode island', SC: 'south carolina',
  SD: 'south dakota', TN: 'tennessee', TX: 'texas', UT: 'utah', VT: 'vermont',
  VA: 'virginia', WA: 'washington', WV: 'west virginia', WI: 'wisconsin', WY: 'wyoming',
  DC: 'district of columbia'
};

const US_STATE_CODES = Object.fromEntries(
  Object.entries(US_STATE_NAMES).map(([code, name]) => [name, code])
);

const weatherCache = new Map();
const pendingWeatherRequests = new Map();
let weatherSyncRequestId = 0;
let lastRenderedWeatherContext = { day: null, weatherData: null, renderedIsNight: null };

function normalizeWeatherKey(locationName) {
  return String(locationName || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildWeatherCacheKey(locationName, coords = null) {
  const safeCoords = normalizeLocationCoords(coords);
  if (safeCoords) {
    return `coords:${safeCoords.lat.toFixed(3)},${safeCoords.lng.toFixed(3)}`;
  }
  const key = normalizeWeatherKey(locationName);
  return key ? `name:${key}` : '';
}

function loadWeatherCacheFromStorage() {
  try {
    const raw = window.localStorage?.getItem(WEATHER_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    const maxRetainMs = 12 * 60 * 60 * 1000; // Keep up to 12 hrs for instant cold-refresh display
    const now = Date.now();
    Object.entries(parsed).forEach(([k, v]) => {
      if (v && v.fetchedAt && now - v.fetchedAt < maxRetainMs && Array.isArray(v.daily) && v.daily.length > 0) {
        weatherCache.set(k, v);
      }
    });
  } catch (err) {
    // Ignore storage read errors in restricted embeds
  }
}

function saveWeatherCacheToStorage() {
  try {
    const entries = Array.from(weatherCache.entries()).slice(-30);
    window.localStorage?.setItem(WEATHER_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch (err) {
    // Ignore storage quota errors
  }
}

loadWeatherCacheFromStorage();

function getCachedWeatherEntry(locationName, coords = null) {
  const key = buildWeatherCacheKey(locationName, coords);
  if (!key) return null;
  return weatherCache.get(key) || null;
}

function isLocalDaytimeNow() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 19;
}

function parseIsoTimeToMinutes(isoStr) {
  if (!isoStr || typeof isoStr !== 'string') return null;
  const match = isoStr.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatIsoClock12h(isoStr) {
  if (!isoStr || typeof isoStr !== 'string') return '';
  const match = isoStr.match(/T(\d{2}):(\d{2})/);
  if (!match) return '';
  let h = Number(match[1]);
  const m = match[2];
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${period}`;
}

function getDestinationNowMinutes(utcOffsetSeconds) {
  if (!Number.isFinite(Number(utcOffsetSeconds))) return null;
  const destDate = new Date(Date.now() + Number(utcOffsetSeconds) * 1000);
  return destDate.getUTCHours() * 60 + destDate.getUTCMinutes();
}

function computeIsDaytime(weatherData) {
  if (
    weatherData &&
    Number.isFinite(weatherData.sunriseMinutes) &&
    Number.isFinite(weatherData.sunsetMinutes) &&
    Number.isFinite(weatherData.utcOffsetSeconds)
  ) {
    const nowMins = getDestinationNowMinutes(weatherData.utcOffsetSeconds);
    if (nowMins !== null) {
      return nowMins >= weatherData.sunriseMinutes && nowMins < weatherData.sunsetMinutes;
    }
  }
  if (typeof weatherData?.isDay === 'boolean') return weatherData.isDay;
  return isLocalDaytimeNow();
}

async function fetchWeatherJson(url, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function formatCoordSnippet(lat, lng) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lng).toFixed(2)}°${ew}`;
}

function buildLocationCandidate({ name, admin1 = '', admin2 = '', country = '', countryCode = '', lat, lng, population = 0, source = 'open-meteo' }) {
  const cleanName = String(name || '').trim();
  const cleanAdmin1 = String(admin1 || '').trim();
  const cleanAdmin2 = String(admin2 || '').trim();
  const cleanCountry = String(country || '').trim();
  const codeUpper = String(countryCode || '').trim().toUpperCase();
  const numLat = Number(lat);
  const numLng = Number(lng);

  if (!cleanName || !Number.isFinite(numLat) || !Number.isFinite(numLng)) return null;

  const isUS = codeUpper === 'US' || cleanCountry.toLowerCase() === 'united states';
  const stateAbbr = isUS ? (US_STATE_CODES[cleanAdmin1.toLowerCase()] || cleanAdmin1) : '';

  let label = cleanName;
  if (isUS && stateAbbr) {
    label = `${cleanName}, ${stateAbbr}`;
  } else if (cleanCountry && cleanCountry.toLowerCase() !== cleanName.toLowerCase()) {
    label = `${cleanName}, ${cleanCountry}`;
  } else if (cleanAdmin1 && cleanAdmin1.toLowerCase() !== cleanName.toLowerCase()) {
    label = `${cleanName}, ${cleanAdmin1}`;
  }

  const fullParts = [];
  const seenLow = new Set();
  [cleanName, cleanAdmin1, cleanCountry].forEach((part) => {
    const low = part.toLowerCase();
    if (part && !seenLow.has(low)) {
      seenLow.add(low);
      fullParts.push(part);
    }
  });
  const fullName = fullParts.join(', ');

  const regionParts = [];
  const regionSeen = new Set();
  [cleanAdmin2 && cleanAdmin2.toLowerCase() !== cleanName.toLowerCase() ? cleanAdmin2 : '', cleanAdmin1, cleanCountry].forEach((part) => {
    const low = part.toLowerCase();
    if (part && !regionSeen.has(low)) {
      regionSeen.add(low);
      regionParts.push(part);
    }
  });
  const regionText = regionParts.join(', ');
  const sublabel = [regionText, formatCoordSnippet(numLat, numLng)].filter(Boolean).join(' · ');

  return {
    name: cleanName,
    admin1: cleanAdmin1,
    admin2: cleanAdmin2,
    country: cleanCountry,
    countryCode: codeUpper || (isUS ? 'US' : ''),
    label,
    fullName,
    sublabel,
    lat: numLat,
    lng: numLng,
    population: Number(population) || 0,
    source,
    score: 0
  };
}

/**
 * Search Disambiguated Cities & Destinations for "Location (Live Temp)" Verification
 */
export async function searchWeatherLocations(rawQuery) {
  const cleaned = String(rawQuery || '').trim();
  if (cleaned.length < 2) return [];

  const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean);
  const primaryName = parts[0] || cleaned;
  const regionRaw = parts.slice(1).join(' ').replace(/\b\d{5}(?:-\d{4})?\b/g, '').trim();
  const regionUpper = regionRaw.toUpperCase();
  const regionExpanded = (US_STATE_NAMES[regionUpper] || regionRaw).toLowerCase();
  const primaryLow = primaryName.toLowerCase();

  const geo = await fetchWeatherJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(primaryName)}&count=10&language=en&format=json`
  );
  const rawResults = Array.isArray(geo?.results) ? geo.results : [];

  let candidates = rawResults
    .map((p) => buildLocationCandidate({
      name: p.name,
      admin1: p.admin1 || '',
      admin2: p.admin2 || '',
      country: p.country || '',
      countryCode: p.country_code || '',
      lat: p.latitude,
      lng: p.longitude,
      population: p.population || 0,
      source: 'open-meteo'
    }))
    .filter(Boolean);

  // Fallback to Photon geocoder for landmarks, ZIP codes, or small neighborhoods
  if (candidates.length < 3) {
    const photon = await fetchWeatherJson(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(cleaned)}&limit=6`
    );
    const features = Array.isArray(photon?.features) ? photon.features : [];
    features.forEach((f) => {
      const coords = f?.geometry?.coordinates;
      const prop = f?.properties || {};
      if (!Array.isArray(coords) || coords.length < 2) return;
      const cand = buildLocationCandidate({
        name: prop.name || prop.city || prop.town || prop.village || primaryName,
        admin1: prop.state || '',
        admin2: prop.county || '',
        country: prop.country || '',
        countryCode: prop.countrycode || '',
        lat: coords[1],
        lng: coords[0],
        population: 0,
        source: 'photon'
      });
      if (cand) candidates.push(cand);
    });
  }

  // Score candidates against user's query & optional state/region/country filter
  candidates.forEach((cand) => {
    let score = 0;
    const nameLow = cand.name.toLowerCase();
    const admin1Low = cand.admin1.toLowerCase();
    const admin2Low = cand.admin2.toLowerCase();
    const countryLow = cand.country.toLowerCase();
    const countryCodeLow = cand.countryCode.toLowerCase();

    if (nameLow === primaryLow) score += 45;
    else if (nameLow.startsWith(primaryLow)) score += 28;
    else if (nameLow.includes(primaryLow)) score += 14;

    if (regionExpanded) {
      if (admin1Low === regionExpanded) score += 90;
      else if (admin1Low && admin1Low.includes(regionExpanded)) score += 65;
      else if (countryLow === regionExpanded || countryCodeLow === regionExpanded) score += 75;
      else if (countryLow && countryLow.includes(regionExpanded)) score += 50;
      else if (admin2Low && admin2Low.includes(regionExpanded)) score += 40;
      else score -= 45;
    }

    if (cand.source === 'open-meteo') score += 8;
    if (cand.population > 0) {
      score += Math.min(20, Math.log10(cand.population + 1) * 3.2);
    }

    cand.score = score;
  });

  // Sort best matches first & deduplicate co-located entries
  candidates.sort((a, b) => b.score - a.score);

  const unique = [];
  for (const cand of candidates) {
    if (regionExpanded && cand.score < 0 && unique.length > 0) continue;
    const duplicate = unique.some((u) => {
      const sameGeo = Math.abs(u.lat - cand.lat) < 0.05 && Math.abs(u.lng - cand.lng) < 0.05;
      const sameFull = u.fullName.toLowerCase() === cand.fullName.toLowerCase();
      return sameGeo || sameFull;
    });
    if (!duplicate) unique.push(cand);
    if (unique.length >= 6) break;
  }

  // If two distinct results still share the same short label, append region to keep labels unambiguous
  const labelCounts = new Map();
  unique.forEach((u) => {
    const k = u.label.toLowerCase();
    labelCounts.set(k, (labelCounts.get(k) || 0) + 1);
  });
  unique.forEach((u) => {
    if ((labelCounts.get(u.label.toLowerCase()) || 0) > 1 && u.admin1) {
      const extra = u.countryCode === 'US' ? (u.admin2 || u.admin1) : u.admin1;
      if (extra && !u.label.toLowerCase().includes(extra.toLowerCase())) {
        u.label = `${u.name}, ${extra}${u.countryCode ? `, ${u.countryCode}` : ''}`;
      }
    }
  });

  return unique;
}

/**
 * Verify a Typed Weather Location — Flags Ambiguous City Names Instead of Guessing
 */
export async function verifyWeatherLocation(rawQuery) {
  const cleaned = String(rawQuery || '').trim();
  if (cleaned.length < 2) {
    return {
      verified: false,
      ambiguous: false,
      matches: [],
      best: null,
      message: 'Enter a city or destination name first.'
    };
  }

  const matches = await searchWeatherLocations(cleaned);
  if (matches.length === 0) {
    return {
      verified: false,
      ambiguous: false,
      matches: [],
      best: null,
      message: 'Location not found — try including the state or country (e.g. "Springfield, IL" or "Paris, France").'
    };
  }

  if (matches.length === 1) {
    return {
      verified: true,
      ambiguous: false,
      matches,
      best: matches[0],
      message: `Verified: ${matches[0].fullName}`
    };
  }

  const normQuery = normalizeWeatherKey(cleaned);
  const exactFullOrLabel = matches.find(
    (m) => normalizeWeatherKey(m.fullName) === normQuery || normalizeWeatherKey(m.label) === normQuery
  );
  if (exactFullOrLabel) {
    return {
      verified: true,
      ambiguous: false,
      matches,
      best: exactFullOrLabel,
      message: `Verified: ${exactFullOrLabel.fullName}`
    };
  }

  const hasRegionHint = cleaned.includes(',');
  const top = matches[0];
  const second = matches[1];
  const clearWinner = hasRegionHint && (top.score - second.score >= 25);

  if (clearWinner) {
    return {
      verified: true,
      ambiguous: false,
      matches,
      best: top,
      message: `Verified: ${top.fullName}`
    };
  }

  return {
    verified: false,
    ambiguous: true,
    matches,
    best: null,
    message: `Multiple locations match "${cleaned}". Select the exact one below so weather stays accurate.`
  };
}

async function resolveWeatherCoords(locationName) {
  const matches = await searchWeatherLocations(locationName);
  if (matches.length === 0) return null;
  return {
    lat: matches[0].lat,
    lng: matches[0].lng,
    resolvedName: matches[0].name
  };
}

export function getAnimatedWeatherSvg(code, sizeClass = 'w-8 h-8', isNight = false) {
  if (code === 0) {
    if (isNight) {
      return `
        <svg viewBox="0 0 36 36" fill="none" class="${sizeClass} overflow-visible drop-shadow-[0_0_10px_rgba(191,219,254,0.55)]">
          <circle cx="17" cy="18" r="11" fill="rgba(129,140,248,0.18)" class="origin-center animate-sunPulse" />
          <path d="M23.8 22.8A8.6 8.6 0 0 1 13.2 12.2a8.6 8.6 0 1 0 10.6 10.6Z" fill="#fef9c3" stroke="#e0f2fe" stroke-width="0.9" class="origin-center animate-moonFloat" />
          <circle cx="25.8" cy="10.2" r="1.4" fill="#ffffff" class="origin-center animate-starTwinkle" />
          <circle cx="29.4" cy="15.4" r="1.0" fill="#bae6fd" style="animation-delay:0.7s" class="origin-center animate-starTwinkle" />
          <circle cx="10.2" cy="9.4" r="1.0" fill="#e0f2fe" style="animation-delay:1.3s" class="origin-center animate-starTwinkle" />
        </svg>
      `;
    }
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
        <circle cx="18" cy="18" r="6.6" fill="#fbbf24" stroke="#fef08a" stroke-width="1.2" class="origin-center animate-sunPulse" />
      </svg>
    `;
  }

  if (code === 1 || code === 2) {
    if (isNight) {
      return `
        <svg viewBox="0 0 36 36" fill="none" class="${sizeClass} overflow-visible drop-shadow-[0_0_8px_rgba(147,197,253,0.4)]">
          <circle cx="9" cy="8.5" r="1.1" fill="#e0f2fe" class="origin-center animate-starTwinkle" />
          <path d="M18.6 15.2a5.8 5.8 0 0 1-7.2-7.2 5.8 5.8 0 1 0 7.2 7.2Z" fill="#fef3c7" class="origin-[14px_12px] animate-moonFloat" />
          <path d="M12.5 27.5h13.5a5.5 5.5 0 0 0 .8-10.94A7.5 7.5 0 0 0 12.4 14.8a5 5 0 0 0 .1 12.7Z" fill="rgba(186,208,236,0.9)" stroke="rgba(224,242,254,0.55)" stroke-width="1.2" class="animate-cloudDrift" />
        </svg>
      `;
    }
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
        <path d="M10 22h16a5 5 0 0 0 .6-9.96A7 7 0 0 0 13 10.6a4.8 4.8 0 0 0-3 11.4Z" fill="${isNight ? 'rgba(100,116,139,0.92)' : 'rgba(148,163,184,0.9)'}" stroke="rgba(226,232,240,0.6)" stroke-width="1.2" class="animate-cloudDrift" />
        <polygon points="18.5,20 14,27 17.8,27 16,33.5 23,24.8 19,24.8" fill="#fde047" class="animate-stormFlash" />
        <line x1="11.5" y1="24" x2="10.2" y2="28" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" class="animate-rainFall" />
        <line x1="24.5" y1="24" x2="23.2" y2="28" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" style="animation-delay:0.45s" class="animate-rainFall" />
      </svg>
    `;
  }

  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return `
      <svg viewBox="0 0 36 36" fill="none" class="${sizeClass} overflow-visible drop-shadow-[0_0_8px_rgba(186,230,253,0.5)]">
        <path d="M10 22h16a5 5 0 0 0 .6-9.96A7 7 0 0 0 13 10.6a4.8 4.8 0 0 0-3 11.4Z" fill="${isNight ? 'rgba(186,214,242,0.9)' : 'rgba(224,242,254,0.92)'}" stroke="rgba(186,230,253,0.75)" stroke-width="1.2" class="animate-cloudDrift" />
        <circle cx="12.5" cy="25.5" r="1.6" fill="#e0f2fe" class="animate-rainFall" />
        <circle cx="18.5" cy="26.5" r="1.8" fill="#bae6fd" style="animation-delay:0.35s" class="animate-rainFall" />
        <circle cx="24" cy="25.5" r="1.5" fill="#e0f2fe" style="animation-delay:0.7s" class="animate-rainFall" />
      </svg>
    `;
  }

  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return `
      <svg viewBox="0 0 36 36" fill="none" class="${sizeClass} overflow-visible drop-shadow-[0_0_8px_rgba(56,189,248,0.45)]">
        <path d="M10 21.5h16a5 5 0 0 0 .6-9.96A7 7 0 0 0 13 10.1a4.8 4.8 0 0 0-3 11.4Z" fill="${isNight ? 'rgba(148,174,206,0.9)' : 'rgba(203,213,225,0.9)'}" stroke="rgba(186,230,253,0.65)" stroke-width="1.2" class="animate-cloudDrift" />
        <line x1="12.5" y1="23.5" x2="11" y2="28" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" class="animate-rainFall" />
        <line x1="18.5" y1="23.5" x2="17" y2="28" stroke="#7dd3fc" stroke-width="2" stroke-linecap="round" style="animation-delay:0.35s" class="animate-rainFall" />
        <line x1="24.5" y1="23.5" x2="23" y2="28" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" style="animation-delay:0.7s" class="animate-rainFall" />
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 36 36" fill="none" class="${sizeClass} overflow-visible drop-shadow-[0_0_8px_rgba(148,163,184,0.35)]">
      <path d="M14 21h12.5a4.2 4.2 0 0 0 .5-8.35A5.8 5.8 0 0 0 15.8 11.5a4 4 0 0 0-1.8 9.5Z" fill="${isNight ? 'rgba(100,116,139,0.62)' : 'rgba(148,163,184,0.55)'}" />
      <path d="M9.5 26h15.5a5 5 0 0 0 .6-9.96A7 7 0 0 0 12.2 14.6a4.8 4.8 0 0 0-2.7 11.4Z" fill="${isNight ? 'rgba(176,196,222,0.88)' : 'rgba(226,232,240,0.92)'}" stroke="rgba(255,255,255,0.55)" stroke-width="1.2" class="animate-cloudDrift" />
    </svg>
  `;
}

export function weatherCodeToMeta(code, isNight = false) {
  if (code === 0) return { desc: isNight ? 'Clear Night' : 'Clear Sky', tone: 'sunny', icon: getAnimatedWeatherSvg(code, 'w-5 h-5', isNight) };
  if (code === 1 || code === 2) return { desc: isNight ? 'Partly Cloudy Night' : 'Partly Cloudy', tone: 'partly', icon: getAnimatedWeatherSvg(code, 'w-5 h-5', isNight) };
  if (code === 3 || (code >= 45 && code <= 48)) return { desc: 'Cloudy', tone: 'cloudy', icon: getAnimatedWeatherSvg(code, 'w-5 h-5', isNight) };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { desc: 'Rain Showers', tone: 'rain', icon: getAnimatedWeatherSvg(code, 'w-5 h-5', isNight) };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { desc: 'Snow Flurries', tone: 'snow', icon: getAnimatedWeatherSvg(code, 'w-5 h-5', isNight) };
  if (code >= 95) return { desc: 'Thunderstorm', tone: 'storm', icon: getAnimatedWeatherSvg(code, 'w-5 h-5', isNight) };
  return { desc: isNight ? 'Clear Night' : 'Mild & Clear', tone: 'sunny', icon: getAnimatedWeatherSvg(0, 'w-5 h-5', isNight) };
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
      desc: weatherCodeToMeta(code, false).desc
    };
  });
}

export async function fetchLiveWeatherForLocation(locationName, coordsOrForce = null, forceRefresh = false) {
  let verifiedCoords = null;
  let force = Boolean(forceRefresh);

  if (typeof coordsOrForce === 'boolean') {
    force = coordsOrForce;
  } else {
    verifiedCoords = normalizeLocationCoords(coordsOrForce);
  }

  const key = buildWeatherCacheKey(locationName, verifiedCoords);
  if (!key) return null;

  const existing = weatherCache.get(key);
  if (!force && existing && Date.now() - existing.fetchedAt < WEATHER_CACHE_TTL_MS) {
    return existing;
  }

  if (pendingWeatherRequests.has(key)) {
    return pendingWeatherRequests.get(key);
  }

  const requestPromise = (async () => {
    try {
      const coords = verifiedCoords || await resolveWeatherCoords(locationName);
      if (!coords) return existing || null;

      const wData = await fetchWeatherJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=7&timezone=auto`
      );
      if (!wData) return existing || null;

      const tempVal = Math.round(wData?.current?.temperature_2m);
      const code = Number.isFinite(Number(wData?.current?.weather_code)) ? Number(wData.current.weather_code) : 0;
      if (!Number.isFinite(tempVal)) return existing || null;

      const utcOffsetSeconds = Number.isFinite(Number(wData?.utc_offset_seconds))
        ? Number(wData.utc_offset_seconds)
        : null;
      const sunriseIso = wData?.daily?.sunrise?.[0] || '';
      const sunsetIso = wData?.daily?.sunset?.[0] || '';
      const sunrise = formatIsoClock12h(sunriseIso);
      const sunset = formatIsoClock12h(sunsetIso);
      const sunriseMinutes = parseIsoTimeToMinutes(sunriseIso);
      const sunsetMinutes = parseIsoTimeToMinutes(sunsetIso);

      const isDay = wData?.current?.is_day !== undefined
        ? Number(wData.current.is_day) === 1
        : isLocalDaytimeNow();
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
          desc: weatherCodeToMeta(dCode, false).desc
        };
      });

      const result = {
        temp: `${tempVal}°F`,
        code,
        isDay,
        utcOffsetSeconds,
        sunrise,
        sunset,
        sunriseMinutes,
        sunsetMinutes,
        humidity,
        wind,
        daily: daily.length === 7 ? daily : buildFallback7DayForecast(`${tempVal}°F`),
        fetchedAt: Date.now()
      };

      weatherCache.set(key, result);
      saveWeatherCacheToStorage();
      return result;
    } catch (err) {
      return existing || null;
    } finally {
      pendingWeatherRequests.delete(key);
    }
  })();

  pendingWeatherRequests.set(key, requestPromise);
  return requestPromise;
}

export function renderSevenDayWeather(day, weatherData) {
  const locName = day?.location || 'California';
  const activeCode = weatherData?.code ?? 0;
  const isNight = !computeIsDaytime(weatherData);

  lastRenderedWeatherContext = { day, weatherData, renderedIsNight: isNight };

  const meta = weatherCodeToMeta(activeCode, isNight);
  const daily = weatherData?.daily?.length ? weatherData.daily : buildFallback7DayForecast(day?.temp || '72°F');

  const locTag = document.getElementById('weatherLocationTag');
  const tempLarge = document.getElementById('weatherCurrentTempLarge');
  const condEl = document.getElementById('weatherCurrentCondition');
  const currentIconEl = document.getElementById('weatherCurrentIcon');
  const dayNightBadge = document.getElementById('weatherDayNightBadge');
  const dayNightDot = document.getElementById('weatherDayNightDot');
  const dayNightLabel = document.getElementById('weatherDayNightLabel');
  const telemetryEl = document.getElementById('weatherTelemetryPills');
  const gridEl = document.getElementById('sevenDayGrid');
  const aura1 = document.getElementById('weatherAura');
  const aura2 = document.getElementById('weatherAuraSecondary');
  const weatherScene = document.getElementById('weatherScene');

  if (!gridEl) return;

  if (locTag) {
    locTag.textContent = locName;
    locTag.title = day?.locationFullName || locName;
  }
  if (tempLarge) tempLarge.textContent = weatherData?.temp || day?.temp || '72°F';
  if (condEl) {
    condEl.textContent = weatherData
      ? meta.desc
      : (isNight ? 'Night Outlook' : '7-Day Outlook');
  }

  if (currentIconEl) {
    currentIconEl.innerHTML = getAnimatedWeatherSvg(activeCode, 'w-8 h-8', isNight);
  }

  if (dayNightBadge && dayNightDot && dayNightLabel) {
    dayNightBadge.className = isNight
      ? 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-400/20 border border-indigo-300/40 text-indigo-100 select-none transition-colors duration-500'
      : 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400/20 border border-amber-300/40 text-amber-100 select-none transition-colors duration-500';
    dayNightDot.className = isNight
      ? 'w-1.5 h-1.5 rounded-full bg-indigo-300 shadow-[0_0_8px_rgba(165,180,252,0.9)]'
      : 'w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]';
    dayNightLabel.textContent = isNight ? 'Night' : 'Day';
  }

  if (weatherScene) {
    weatherScene.className = `weather-scene weather-scene--${meta.tone} ${isNight ? 'weather-scene--night' : 'weather-scene--day'} absolute inset-0 pointer-events-none`;
  }

  const auraColors = isNight
    ? ({
        sunny: ['bg-indigo-400/25', 'bg-sky-500/18'],
        partly: ['bg-indigo-400/22', 'bg-blue-500/18'],
        cloudy: ['bg-slate-400/18', 'bg-indigo-500/18'],
        rain: ['bg-sky-500/22', 'bg-indigo-600/24'],
        snow: ['bg-sky-200/20', 'bg-indigo-400/20'],
        storm: ['bg-violet-500/28', 'bg-indigo-500/22']
      }[meta.tone] || ['bg-indigo-400/20', 'bg-sky-500/15'])
    : ({
        sunny: ['bg-amber-400/20', 'bg-orange-400/15'],
        partly: ['bg-amber-300/18', 'bg-sky-400/18'],
        cloudy: ['bg-slate-300/15', 'bg-sky-400/15'],
        rain: ['bg-sky-400/22', 'bg-indigo-500/20'],
        snow: ['bg-cyan-200/20', 'bg-sky-300/20'],
        storm: ['bg-violet-500/22', 'bg-amber-400/18']
      }[meta.tone] || ['bg-amber-400/15', 'bg-sky-400/15']);

  if (aura1) aura1.className = `pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full ${auraColors[0]} blur-3xl transition-colors duration-700`;
  if (aura2) aura2.className = `pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full ${auraColors[1]} blur-3xl transition-colors duration-700`;

  const today = daily[0];
  const pills = [];
  if (today) pills.push(`H: ${today.max}° · L: ${today.min}°`);
  if (weatherData?.humidity) pills.push(`Humidity ${weatherData.humidity}%`);
  if (weatherData?.wind) pills.push(`Wind ${weatherData.wind} mph`);
  if (isNight && weatherData?.sunrise) pills.push(`Sunrise ${weatherData.sunrise}`);
  else if (!isNight && weatherData?.sunset) pills.push(`Sunset ${weatherData.sunset}`);

  if (telemetryEl) {
    telemetryEl.innerHTML = pills.map((p) => `
      <span class="px-2.5 py-1 rounded-full bg-black/30 border border-white/10 font-medium tabular-nums">${esc(p)}</span>
    `).join('');
  }

  const weekMin = Math.min(...daily.map((d) => d.min));
  const weekMax = Math.max(...daily.map((d) => d.max));
  const span = Math.max(1, weekMax - weekMin);

  gridEl.innerHTML = daily.map((d, idx) => {
    const isToday = idx === 0;
    const leftPct = Math.round(((d.min - weekMin) / span) * 100);
    const widthPct = Math.max(18, Math.round(((d.max - d.min) / span) * 100));
    const clampedWidth = Math.min(100 - leftPct, widthPct);
    const cardIsNight = isToday && isNight;

    return `
      <div
        class="group/wday relative rounded-2xl p-3 sm:p-3.5 border backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 animate-fadeUp ${
          isToday
            ? (isNight
                ? 'bg-gradient-to-b from-indigo-400/20 to-sky-500/14 border-indigo-300/45 shadow-lg shadow-indigo-950/50'
                : 'bg-gradient-to-b from-white/18 to-sky-500/12 border-sky-300/40 shadow-lg shadow-sky-950/40')
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
          ${getAnimatedWeatherSvg(d.code, 'w-10 h-10', cardIsNight)}
        </div>

        <div class="text-[10px] text-center text-white/65 truncate mb-2">${esc(cardIsNight ? weatherCodeToMeta(d.code, true).desc : d.desc)}</div>

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

export function refreshWeatherDayNightAuto() {
  const { day, weatherData, renderedIsNight } = lastRenderedWeatherContext;
  if (!day) return;
  const nextIsNight = !computeIsDaytime(weatherData);
  if (renderedIsNight !== null && nextIsNight !== renderedIsNight) {
    renderSevenDayWeather(day, weatherData);
  }
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

export function setBookiPanelExpanded(expanded) {
  appStore.bookiPanelExpanded = Boolean(expanded);
  const wrap = document.getElementById('bookiBodyWrap');
  const iconEl = document.getElementById('toggleBookiIcon');
  const btn = document.getElementById('toggleBookiBtn');
  if (!wrap) return;

  wrap.classList.toggle('hidden', !appStore.bookiPanelExpanded);
  if (iconEl) iconEl.innerHTML = appStore.bookiPanelExpanded ? ICONS.eyeOff : ICONS.eye;
  if (btn) {
    const labelText = appStore.bookiPanelExpanded ? 'Hide Booki' : 'Show Booki';
    btn.setAttribute('aria-expanded', String(appStore.bookiPanelExpanded));
    btn.setAttribute('aria-label', labelText);
    btn.title = labelText;
    btn.className = appStore.bookiPanelExpanded
      ? 'w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 hover:text-white flex items-center justify-center transition-all hover:scale-[1.03] active:scale-95 cursor-pointer shrink-0'
      : 'w-9 h-9 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 hover:text-white flex items-center justify-center transition-all hover:scale-[1.03] active:scale-95 cursor-pointer shrink-0';
  }
}

export function setNotesPanelExpanded(expanded) {
  appStore.notesPanelExpanded = Boolean(expanded);
  const wrap = document.getElementById('notesBodyWrap');
  const label = document.getElementById('toggleNotesLabel');
  const chev = document.getElementById('toggleNotesChevron');
  const btn = document.getElementById('toggleNotesBtn');
  if (!wrap) return;

  wrap.classList.toggle('hidden', !appStore.notesPanelExpanded);
  if (!appStore.notesPanelExpanded) {
    document.getElementById('rteTextColorPopover')?.classList.add('hidden');
    document.getElementById('rteBgColorPopover')?.classList.add('hidden');
  }
  if (label) label.textContent = appStore.notesPanelExpanded ? 'Hide' : 'Show';
  if (chev) chev.classList.toggle('rotate-180', appStore.notesPanelExpanded);
  if (btn) {
    btn.setAttribute('aria-expanded', String(appStore.notesPanelExpanded));
    btn.title = appStore.notesPanelExpanded
      ? 'Hide Personal Trip Notes & Quick Reminders'
      : 'Show Personal Trip Notes & Quick Reminders';
  }
}

export async function syncLiveWeatherForActiveDay() {
  const day = appStore.state.days[appStore.activeCarouselIndex] || appStore.state.days[0];
  if (!day) return;

  const reqId = ++weatherSyncRequestId;
  const targetDayId = day.id;
  const targetLocKey = buildWeatherCacheKey(day.location, day.locationCoords);

  // Immediately render cached weather (or clean fallback) so refresh never sits blank
  const cached = getCachedWeatherEntry(day.location, day.locationCoords);
  if (cached) {
    day.temp = cached.temp;
    renderSevenDayWeather(day, cached);
    renderForecastStrip();
    renderCarousel();
  } else {
    renderSevenDayWeather(day, null);
  }

  // Fetch fresh live weather if cache is missing or older than TTL
  const isFresh = cached && Date.now() - cached.fetchedAt < WEATHER_CACHE_TTL_MS;
  if (isFresh) return;

  const live = await fetchLiveWeatherForLocation(day.location, day.locationCoords);
  if (!live) return;

  day.temp = live.temp;

  const currentDay = appStore.state.days[appStore.activeCarouselIndex] || appStore.state.days[0];
  if (
    reqId === weatherSyncRequestId &&
    currentDay &&
    currentDay.id === targetDayId &&
    buildWeatherCacheKey(currentDay.location, currentDay.locationCoords) === targetLocKey
  ) {
    renderSevenDayWeather(currentDay, live);
  }
  renderForecastStrip();
  renderCarousel();
}

export async function prefetchAllDaysWeather() {
  // Always load the visible active day immediately first
  syncLiveWeatherForActiveDay();

  // Quietly prefetch remaining days in the background for instant day switching
  const activeDay = appStore.state.days[appStore.activeCarouselIndex] || appStore.state.days[0];
  const otherDays = appStore.state.days.filter((d) => d && d.id !== activeDay?.id);
  if (otherDays.length === 0) return;

  let anyUpdated = false;
  await Promise.all(
    otherDays.map(async (d) => {
      const live = await fetchLiveWeatherForLocation(d.location, d.locationCoords);
      if (live && d.temp !== live.temp) {
        d.temp = live.temp;
        anyUpdated = true;
      }
    })
  );

  if (anyUpdated) {
    renderForecastStrip();
    renderCarousel();
  }
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
        title="${esc(day.locationFullName || day.location || '')}"
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