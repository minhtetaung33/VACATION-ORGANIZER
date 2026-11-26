import {
  ICONS,
  LINK_ICON_META,
  RESERVATION_TYPE_META,
  RESERVATION_STATUS_META,
  CATEGORY_META,
  CUSTOM_CATEGORY_THEMES,
  CUSTOM_CATEGORY_ICON_OPTIONS,
  CUSTOM_CATEGORY_ANIM_OPTIONS,
  BUDGET_CATEGORY_META,
  appStore,
  uid,
  esc,
  normalizeLocationCoords,
  normalizeReservationItem,
  getAllCategories,
  getCategoryMeta,
  inferBudgetCategory,
  getItemFinalCost,
  showToast,
  openModal,
  closeModal,
  openConfirmDeleteModal,
  createInitialState,
  createNewDefaultTrip,
  syncActiveTripRef,
  switchToTrip,
  updateBackdropForDay,
  prefetchCardPhotoForDay,
  prefetchAllCardPhotos,
  scheduleCloudSave,
  searchWeatherLocations,
  verifyWeatherLocation,
  syncLiveWeatherForActiveDay,
  prefetchAllDaysWeather,
  refreshTripTravelRoutes,
  renderHero,
  renderForecastStrip,
  renderCarousel
} from './trip-planner.js';

import {
  DURATION_OPTIONS,
  TIME_SLOT_STEP,
  getTimeSlotOptions,
  formatMinutesTo12h,
  formatTimeWindow,
  roundUpToSlot,
  normalizeEventSchedule,
  rippleFlexibleActivitiesFrom,
  reorderEventInDay,
  moveEventToTimeSlot,
  moveEventAcrossDays,
  duplicateEventInDay,
  copyEventToDay,
  autoFitDaySchedule,
  searchAddressSuggestions,
  verifyAddress
} from './trip-timeline-engine.js';

import {
  renderItinerary,
  renderChecklist,
  renderBudget,
  updateBudgetTotals,
  renderReservations,
  renderLinks,
  renderAll
} from './trip-planner-detail.js';

/**
 * Flash-highlight helper for activities whose time slots auto-adjusted
 */
let shiftFlashTimer = null;
function markShiftedEvents(ids = []) {
  appStore.justShiftedEventIds = new Set(ids.filter(Boolean));
  clearTimeout(shiftFlashTimer);
  shiftFlashTimer = setTimeout(() => {
    appStore.justShiftedEventIds.clear();
  }, 950);
}

function captureStartSnapshot(day) {
  const snap = new Map();
  (day?.events || []).forEach((ev) => snap.set(ev.id, ev.startMinutes));
  return snap;
}

function getChangedEventIds(day, snapshot, extraIds = []) {
  const changed = [...extraIds];
  (day?.events || []).forEach((ev) => {
    if (snapshot.has(ev.id) && snapshot.get(ev.id) !== ev.startMinutes) {
      changed.push(ev.id);
    }
  });
  return changed;
}

/**
 * Reusable Verified Weather Location Picker (Used in Add/Edit Day & Create New Trip Modals)
 * Guarantees exact coordinates so same-named cities never get confused.
 */
function formatCoordsBrief(coords) {
  if (!coords) return '';
  const ns = coords.lat >= 0 ? 'N' : 'S';
  const ew = coords.lng >= 0 ? 'E' : 'W';
  return `${Math.abs(coords.lat).toFixed(2)}°${ns}, ${Math.abs(coords.lng).toFixed(2)}°${ew}`;
}

function attachVerifiedLocationPicker({
  inputId,
  verifyBtnId,
  suggestionsId,
  statusId,
  initialLocation = '',
  initialFullName = '',
  initialCoords = null
}) {
  const inputEl = document.getElementById(inputId);
  const verifyBtn = document.getElementById(verifyBtnId);
  const suggestionsBox = document.getElementById(suggestionsId);
  const statusEl = document.getElementById(statusId);

  const safeCoords = normalizeLocationCoords(initialCoords);
  let verifiedSelection = (safeCoords && String(initialLocation || '').trim())
    ? {
        label: String(initialLocation).trim(),
        fullName: String(initialFullName || initialLocation).trim(),
        coords: safeCoords
      }
    : null;

  let suggestTimer = null;
  let suggestReqId = 0;

  function setStatus(htmlText, tone = 'muted') {
    if (!statusEl) return;
    const toneClass = tone === 'ok'
      ? 'text-emerald-300 font-medium'
      : tone === 'warn'
        ? 'text-amber-300 font-medium'
        : tone === 'error'
          ? 'text-rose-300 font-medium'
          : 'text-white/50';
    statusEl.className = `text-[11px] leading-snug ${toneClass}`;
    statusEl.innerHTML = htmlText;
  }

  function syncBorderState() {
    if (!inputEl) return;
    inputEl.classList.toggle('border-emerald-400/50', Boolean(verifiedSelection));
    inputEl.classList.toggle('border-sky-400/30', !verifiedSelection);
  }

  function applyVerifiedChoice(choice) {
    verifiedSelection = {
      label: choice.label,
      fullName: choice.fullName || choice.label,
      coords: { lat: Number(choice.lat), lng: Number(choice.lng) }
    };
    if (inputEl) inputEl.value = verifiedSelection.label;
    if (suggestionsBox) {
      suggestionsBox.classList.add('hidden');
      suggestionsBox.innerHTML = '';
    }
    syncBorderState();
    setStatus(
      `✓ Verified: ${esc(verifiedSelection.fullName)} <span class="text-emerald-200/70">(${esc(formatCoordsBrief(verifiedSelection.coords))})</span>`,
      'ok'
    );
  }

  function renderSuggestions(list) {
    if (!suggestionsBox) return;
    if (!Array.isArray(list) || list.length === 0) {
      suggestionsBox.classList.add('hidden');
      suggestionsBox.innerHTML = '';
      return;
    }

    suggestionsBox.innerHTML = list.map((item, idx) => `
      <button
        type="button"
        data-wloc-sug="${idx}"
        class="w-full text-left flex items-start gap-2.5 px-3 py-2 rounded-xl hover:bg-sky-500/20 border border-transparent hover:border-sky-400/35 transition-all cursor-pointer"
      >
        <span class="text-sky-300 mt-0.5 shrink-0">${ICONS.pin}</span>
        <div class="min-w-0 flex-1">
          <div class="text-xs font-semibold text-white truncate">${esc(item.label)}</div>
          ${item.sublabel ? `<div class="text-[10px] text-white/55 truncate">${esc(item.sublabel)}</div>` : ''}
        </div>
        ${item.countryCode ? `<span class="px-1.5 py-0.5 rounded-md bg-white/10 border border-white/15 text-[9px] font-bold text-sky-200 shrink-0">${esc(item.countryCode)}</span>` : ''}
      </button>
    `).join('');

    suggestionsBox.classList.remove('hidden');

    suggestionsBox.querySelectorAll('[data-wloc-sug]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const picked = list[Number(btn.dataset.wlocSug)];
        if (picked) applyVerifiedChoice(picked);
      });
    });
  }

  async function runVerify() {
    const val = inputEl?.value.trim() || '';
    if (!val) {
      setStatus('Enter a city or destination name first.', 'warn');
      inputEl?.focus();
      return { ok: false, reason: 'empty' };
    }

    clearTimeout(suggestTimer);
    suggestReqId++;

    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Checking…';
    }
    setStatus('Verifying exact location & coordinates…', 'muted');

    const res = await verifyWeatherLocation(val);

    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verify';
    }

    if (res.verified && res.best) {
      applyVerifiedChoice(res.best);
      return { ok: true, ...verifiedSelection };
    }

    if (res.ambiguous && res.matches.length > 0) {
      verifiedSelection = null;
      syncBorderState();
      renderSuggestions(res.matches);
      setStatus(`⚠ ${esc(res.message)}`, 'warn');
      return { ok: false, reason: 'ambiguous' };
    }

    verifiedSelection = null;
    syncBorderState();
    renderSuggestions([]);
    setStatus(`✕ ${esc(res.message)}`, 'error');
    return { ok: false, reason: 'not_found' };
  }

  inputEl?.addEventListener('input', () => {
    const val = inputEl.value.trim();
    verifiedSelection = null;
    syncBorderState();
    clearTimeout(suggestTimer);

    if (val.length < 2) {
      renderSuggestions([]);
      setStatus('Type a city or destination, then pick a match or click Verify.', 'muted');
      return;
    }

    setStatus('Searching exact locations…', 'muted');
    const reqId = ++suggestReqId;
    suggestTimer = setTimeout(async () => {
      const results = await searchWeatherLocations(val);
      if (reqId !== suggestReqId) return;
      if (results.length > 0) {
        renderSuggestions(results);
        setStatus('Select the exact location below or click Verify.', 'muted');
      } else {
        renderSuggestions([]);
        setStatus('No instant matches yet — include state or country, then click Verify.', 'warn');
      }
    }, 320);
  });

  inputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runVerify();
    }
  });

  verifyBtn?.addEventListener('click', () => {
    runVerify();
  });

  // Render initial verification status cleanly
  syncBorderState();
  if (verifiedSelection) {
    setStatus(
      `✓ Verified: ${esc(verifiedSelection.fullName)} <span class="text-emerald-200/70">(${esc(formatCoordsBrief(verifiedSelection.coords))})</span>`,
      'ok'
    );
  } else if (String(initialLocation || '').trim()) {
    setStatus('Click Verify or pick a suggestion to lock exact coordinates for live weather.', 'warn');
  }

  return {
    getSelection: () => verifiedSelection,
    async ensureVerified() {
      const val = inputEl?.value.trim() || '';
      if (!val) {
        setStatus('Please enter and verify a location.', 'error');
        inputEl?.focus();
        return { ok: false, reason: 'empty' };
      }
      if (verifiedSelection && verifiedSelection.label.toLowerCase() === val.toLowerCase()) {
        return { ok: true, ...verifiedSelection };
      }
      return await runVerify();
    }
  };
}

/**
 * Edit Current Trip Overview OR Create a Brand-New Trip
 */
export function openHeroModal(mode = 'edit') {
  const isCreate = mode === 'create';
  const state = appStore.state;
  const inp = 'w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-sky-400/40 transition-all';

  const defaults = isCreate
    ? {
        title: `Trip ${appStore.trips.length + 1} · Weekend Getaway`,
        subtitle: 'A fresh travel itinerary ready for new destinations, stops, and memories.',
        tripLength: '3 days / 2 nights',
        firstDeparture: 'Friday · 9:00 AM',
        hotelPlan: '2 nights',
        startLocation: 'San Diego, CA',
        startLocationFullName: 'San Diego, California, United States',
        startLocationCoords: { lat: 32.7157, lng: -117.1611 }
      }
    : {
        title: state.meta.title,
        subtitle: state.meta.subtitle,
        tripLength: state.meta.tripLength,
        firstDeparture: state.meta.firstDeparture,
        hotelPlan: state.meta.hotelPlan,
        startLocation: state.days[0]?.location || ''
      };

  let heroLocationPicker = null;
  let isSavingHero = false;

  openModal({
    title: isCreate ? 'Edit Trip Overview · New Trip' : 'Edit Trip Overview',
    bodyHtml: `
      <div class="space-y-4">
        ${isCreate ? `
          <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500/20 via-sky-500/15 to-indigo-500/20 border border-white/20 p-4 flex items-center gap-3.5 animate-fadeUp">
            <div class="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent animate-shimmer"></div>
            <div class="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-400/30 to-sky-400/30 border border-white/25 flex items-center justify-center text-white shrink-0 animate-floatGentle">
              ${ICONS.newTrip}
            </div>
            <div class="relative z-10 min-w-0">
              <div class="text-[10px] font-bold uppercase tracking-widest text-sky-300">New Default Trip</div>
              <p class="text-xs text-white/80 leading-relaxed mt-0.5">Fill out your trip overview below — your previous trips stay safely saved in the <strong>Trips</strong> menu.</p>
            </div>
          </div>
        ` : ''}

        <div class="space-y-3 animate-fadeUp" style="animation-delay: 60ms;">
          <div>
            <label class="block text-xs font-semibold text-white/60 mb-1">Trip Title</label>
            <input id="hTitle" placeholder="e.g. Summer Coast Road Trip" class="${inp}" value="${esc(defaults.title)}" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-white/60 mb-1">Subtitle / Description</label>
            <textarea id="hSub" rows="2" placeholder="Describe the highlights of your trip..." class="${inp}">${esc(defaults.subtitle)}</textarea>
          </div>
          ${isCreate ? `
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-sky-300/90">Starting Destination <span class="text-white/40 font-normal">(Verify for Day 1 Live Weather &amp; Backdrop)</span></label>
              <div class="flex items-center gap-1.5">
                <input
                  id="hLoc"
                  autocomplete="off"
                  placeholder="e.g. San Diego, CA · Big Bear, CA · Paris, France"
                  class="${inp} border-sky-400/30 flex-1 min-w-0"
                  value="${esc(defaults.startLocation)}"
                />
                <button
                  id="hVerifyLocBtn"
                  type="button"
                  class="px-3 py-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/40 text-xs font-semibold text-sky-100 transition-all cursor-pointer shrink-0"
                >Verify</button>
              </div>
              <div id="hLocSuggestions" class="hidden rounded-2xl border border-sky-400/30 bg-[#141720]/98 backdrop-blur-2xl p-1.5 space-y-1 shadow-2xl shadow-black/70 max-h-52 overflow-y-auto animate-slideDown"></div>
              <div id="hLocVerifyStatus" class="text-[11px] leading-snug text-white/50"></div>
            </div>
          ` : ''}
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div><label class="block text-xs font-semibold text-white/60 mb-1">Trip Length</label><input id="hLen" class="${inp}" value="${esc(defaults.tripLength)}" /></div>
            <div><label class="block text-xs font-semibold text-white/60 mb-1">First Departure</label><input id="hDep" class="${inp}" value="${esc(defaults.firstDeparture)}" /></div>
            <div><label class="block text-xs font-semibold text-white/60 mb-1">Hotel Plan</label><input id="hHotel" class="${inp}" value="${esc(defaults.hotelPlan)}" /></div>
          </div>
        </div>
      </div>
    `,
    footerButtons: [
      { label: 'Cancel', onClick: closeModal },
      {
        label: isCreate ? 'Create New Trip' : 'Save Changes',
        variant: 'primary',
        onClick: async () => {
          if (isSavingHero) return;
          const title = document.getElementById('hTitle').value.trim();
          if (!title) return showToast('Please enter a trip title', 'error');
          const subtitle = document.getElementById('hSub').value.trim();
          const tripLength = document.getElementById('hLen').value.trim() || defaults.tripLength;
          const firstDeparture = document.getElementById('hDep').value.trim() || defaults.firstDeparture;
          const hotelPlan = document.getElementById('hHotel').value.trim() || defaults.hotelPlan;

          if (isCreate) {
            isSavingHero = true;
            const locRes = await heroLocationPicker.ensureVerified();
            isSavingHero = false;

            if (!locRes.ok) {
              if (locRes.reason === 'ambiguous') {
                return showToast('Multiple locations match — please pick the exact one from the list', 'error');
              }
              return showToast('Please verify the starting destination first', 'error');
            }

            const newTrip = createNewDefaultTrip({
              title,
              subtitle,
              tripLength,
              firstDeparture,
              hotelPlan,
              startLocation: locRes.label,
              startLocationFullName: locRes.fullName,
              startLocationCoords: locRes.coords
            });
            appStore.trips.push(newTrip);
            closeModal();
            switchToTrip(newTrip.id, true);
            showToast(`Created "${title}" (${locRes.label})!`);
          } else {
            appStore.state.meta.title = title;
            appStore.state.meta.subtitle = subtitle;
            appStore.state.meta.tripLength = tripLength;
            appStore.state.meta.firstDeparture = firstDeparture;
            appStore.state.meta.hotelPlan = hotelPlan;
            closeModal();
            renderHero();
            renderForecastStrip();
            scheduleCloudSave();
            showToast('Trip overview updated');
          }
        }
      }
    ]
  });

  if (isCreate) {
    heroLocationPicker = attachVerifiedLocationPicker({
      inputId: 'hLoc',
      verifyBtnId: 'hVerifyLocBtn',
      suggestionsId: 'hLocSuggestions',
      statusId: 'hLocVerifyStatus',
      initialLocation: defaults.startLocation,
      initialFullName: defaults.startLocationFullName,
      initialCoords: defaults.startLocationCoords
    });
  }

  setTimeout(() => {
    const titleEl = document.getElementById('hTitle');
    if (titleEl && isCreate) {
      titleEl.focus();
      titleEl.select();
    }
  }, 120);
}

/**
 * Previous & Saved Trips Switcher Modal
 */
export function openTripsModal() {
  const tripCardsHtml = appStore.trips.map((trip, idx) => {
    const isActive = trip.id === appStore.activeTripId;
    const budgetItems = trip.budget?.items || [];
    const estSum = budgetItems.reduce((acc, i) => acc + (Number(i.estimated) || 0), 0);
    const hasAnyFinal = budgetItems.some((i) => getItemFinalCost(i) !== null);
    const finSum = budgetItems.reduce((acc, i) => acc + (getItemFinalCost(i) || 0), 0);
    const estFmt = `$${estSum.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    const finFmt = `$${finSum.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    const dayCount = trip.days?.length || 0;
    const firstLoc = trip.days?.[0]?.location || 'Custom Trip';

    return `
      <div
        data-trip-select="${esc(trip.id)}"
        class="group relative rounded-2xl border p-4 transition-all duration-200 cursor-pointer animate-fadeUp ${
          isActive
            ? 'bg-gradient-to-r from-orange-500/15 to-sky-500/15 border-sky-400/50 shadow-lg shadow-sky-500/10'
            : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/12 hover:border-white/25'
        }"
        style="animation-delay: ${idx * 45}ms;"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <h4 class="text-sm sm:text-base font-semibold text-white truncate">${esc(trip.meta?.title || 'Untitled Trip')}</h4>
              ${isActive ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">Active</span>` : ''}
            </div>
            <p class="text-xs text-white/60 line-clamp-1">${esc(trip.meta?.subtitle || '')}</p>
            <div class="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-white/75">
              <span class="px-2 py-0.5 rounded-lg bg-black/30 border border-white/10">${esc(firstLoc)}</span>
              <span class="px-2 py-0.5 rounded-lg bg-black/30 border border-white/10">${dayCount} ${dayCount === 1 ? 'Day' : 'Days'}</span>
              <span class="px-2 py-0.5 rounded-lg bg-black/30 border border-white/10 text-orange-200 tabular-nums">${esc(estFmt)} est.</span>
              <span class="px-2 py-0.5 rounded-lg ${hasAnyFinal ? 'bg-sky-500/15 border border-sky-400/35 text-sky-200 font-semibold' : 'bg-black/30 border border-white/10 text-white/55'} tabular-nums">${esc(finFmt)} final</span>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            ${!isActive ? `<span class="px-2.5 py-1 rounded-xl text-xs font-semibold bg-white/10 group-hover:bg-sky-500/30 text-white transition-colors">Open</span>` : ''}
            ${appStore.trips.length > 1 ? `
              <button type="button" data-trip-delete="${esc(trip.id)}" title="Delete Trip" class="p-1.5 rounded-xl text-white/45 hover:text-rose-300 hover:bg-rose-500/20 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer">
                ${ICONS.trash}
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  openModal({
    title: `My Trips (${appStore.trips.length})`,
    bodyHtml: `
      <div class="space-y-3">
        <p class="text-xs text-white/60">Select any previous or active trip to open its itinerary, reservations, checklist, budget, and backdrop.</p>
        <div class="space-y-2.5">${tripCardsHtml}</div>
      </div>
    `,
    footerButtons: [
      {
        label: '+ New Trip',
        variant: 'primary',
        onClick: () => {
          closeModal();
          openHeroModal('create');
        }
      },
      { label: 'Close', onClick: closeModal }
    ]
  });

  document.querySelectorAll('[data-trip-select]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-trip-delete]')) return;
      const id = card.dataset.tripSelect;
      closeModal();
      if (id !== appStore.activeTripId) {
        switchToTrip(id);
      }
    });
  });

  document.querySelectorAll('[data-trip-delete]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = btn.dataset.tripDelete;
      const targetTrip = appStore.trips.find((t) => t.id === targetId);
      if (!targetTrip || appStore.trips.length <= 1) return;
      openConfirmDeleteModal({
        title: 'Delete Saved Trip',
        itemName: targetTrip.meta?.title || 'Trip',
        detail: 'This will permanently remove this trip and all of its days, reservations, budget, and notes.',
        confirmLabel: 'Yes, Delete Trip',
        onConfirm: () => {
          appStore.trips = appStore.trips.filter((t) => t.id !== targetId);
          if (appStore.activeTripId === targetId) {
            switchToTrip(appStore.trips[0].id, true);
          } else {
            renderHero();
            scheduleCloudSave();
          }
          showToast('Trip deleted');
          openTripsModal();
        }
      });
    });
  });
}

/**
 * ============================================================================
 * UNIFIED RESERVATIONS & BOOKINGS MODAL (Dynamic Category Labels + Status)
 * ============================================================================
 */
export function openReservationModal(reservationId = null, preselectedType = null) {
  const state = appStore.state;
  if (!Array.isArray(state.reservations)) state.reservations = [];
  const existing = reservationId ? state.reservations.find((r) => r.id === reservationId) : null;

  let selectedType = (existing?.type && RESERVATION_TYPE_META[existing.type])
    ? existing.type
    : (preselectedType && RESERVATION_TYPE_META[preselectedType] ? preselectedType : 'hotel');
  let selectedStatus = (existing?.status && RESERVATION_STATUS_META[existing.status])
    ? existing.status
    : 'confirmed';

  const typeMeta = RESERVATION_TYPE_META[selectedType];
  const statusMeta = RESERVATION_STATUS_META[selectedStatus];
  const inp = 'w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-sky-400/40 transition-all';

  const typeButtonsHtml = Object.entries(RESERVATION_TYPE_META).map(([key, meta]) => `
    <button
      type="button"
      data-res-type="${key}"
      class="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
        selectedType === key
          ? `${meta.style} ring-1 ring-white/50 shadow-md scale-[1.02]`
          : 'bg-black/35 border-white/10 text-white/65 hover:bg-white/10 hover:text-white'
      }"
    >
      <span class="shrink-0">${ICONS[meta.icon]}</span>
      <span class="truncate">${esc(meta.shortLabel)}</span>
    </button>
  `).join('');

  const statusButtonsHtml = Object.entries(RESERVATION_STATUS_META).map(([key, meta]) => `
    <button
      type="button"
      data-res-status="${key}"
      class="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
        selectedStatus === key
          ? `${meta.badgeClass} ring-1 ring-white/45 shadow-md scale-[1.02]`
          : 'bg-black/35 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
      }"
    >
      <span class="w-2 h-2 rounded-full ${meta.dotClass}"></span>
      <span>${esc(meta.label)}</span>
    </button>
  `).join('');

  openModal({
    title: existing ? 'Edit Booking / Reservation' : 'Add Booking / Reservation',
    bodyHtml: `
      <div class="space-y-4">
        <!-- Live Preview Strip -->
        <div class="rounded-2xl bg-black/35 border border-white/15 px-3.5 py-3 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <span id="rPreviewIcon" class="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${typeMeta.style}">
              ${ICONS[typeMeta.icon]}
            </span>
            <div class="min-w-0">
              <div id="rPreviewType" class="text-[10px] font-bold uppercase tracking-widest text-sky-300">${esc(typeMeta.label)}</div>
              <div id="rPreviewTitle" class="text-sm font-semibold text-white truncate">${esc(existing?.title || 'New Reservation')}</div>
            </div>
          </div>
          <span id="rPreviewStatus" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold shrink-0 ${statusMeta.badgeClass}">
            <span class="w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}"></span>
            <span>${esc(statusMeta.label)}</span>
          </span>
        </div>

        <!-- Category Selector -->
        <div>
          <label class="block text-xs font-semibold text-white/65 mb-1.5">Booking Category</label>
          <div id="rTypeGrid" class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">${typeButtonsHtml}</div>
        </div>

        <!-- Status Selector -->
        <div>
          <label class="block text-xs font-semibold text-white/65 mb-1.5">Reservation Status</label>
          <div id="rStatusGrid" class="grid grid-cols-3 gap-2">${statusButtonsHtml}</div>
        </div>

        <!-- Core Info -->
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-semibold text-white/65 mb-1">Booking Title / Name</label>
            <input id="rTitle" placeholder="${esc(typeMeta.titlePlaceholder)}" class="${inp}" value="${esc(existing?.title || '')}" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label class="block text-xs font-semibold text-white/65 mb-1">Provider / Details <span class="text-white/40 font-normal">(Optional)</span></label>
              <input id="rProvider" placeholder="${esc(typeMeta.providerPlaceholder)}" class="${inp}" value="${esc(existing?.provider || '')}" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-white/65 mb-1">Location / Address <span class="text-white/40 font-normal">(Optional)</span></label>
              <input id="rLocation" placeholder="${esc(typeMeta.locationPlaceholder)}" class="${inp}" value="${esc(existing?.location || '')}" />
            </div>
          </div>

          <!-- Dynamic Check-In / Check-Out Times -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label id="rCheckInLabel" class="block text-xs font-semibold text-sky-300/90 mb-1">${esc(typeMeta.startLabel)}</label>
              <input id="rCheckIn" placeholder="${esc(typeMeta.startPlaceholder)}" class="${inp} border-sky-400/25" value="${esc(existing?.checkIn || '')}" />
            </div>
            <div>
              <label id="rCheckOutLabel" class="block text-xs font-semibold text-orange-300/90 mb-1">${esc(typeMeta.endLabel)}</label>
              <input id="rCheckOut" placeholder="${esc(typeMeta.endPlaceholder)}" class="${inp} border-orange-400/25" value="${esc(existing?.checkOut || '')}" />
            </div>
          </div>

          <!-- Confirmation # & Booking Link -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label class="block text-xs font-semibold text-white/65 mb-1">Confirmation Number</label>
              <input id="rCode" placeholder="${esc(typeMeta.codePlaceholder)}" class="${inp} font-mono tracking-wider uppercase" value="${esc(existing?.confirmationNumber || '')}" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-white/65 mb-1">Booking / Ticket Link</label>
              <input id="rUrl" type="url" placeholder="https://..." class="${inp}" value="${esc(existing?.bookingUrl || '')}" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-white/65 mb-1">Notes / Check-in Instructions</label>
            <textarea id="rNotes" rows="2" placeholder="${esc(typeMeta.notePlaceholder)}" class="${inp}">${esc(existing?.notes || '')}</textarea>
          </div>
        </div>
      </div>
    `,
    footerButtons: [
      { label: 'Cancel', onClick: closeModal },
      {
        label: existing ? 'Save Booking' : 'Add Booking',
        variant: 'primary',
        onClick: () => {
          const title = document.getElementById('rTitle').value.trim();
          if (!title) return showToast('Please enter a booking title', 'error');

          let bookingUrl = document.getElementById('rUrl').value.trim();
          if (bookingUrl && !/^https?:\/\//i.test(bookingUrl)) {
            bookingUrl = 'https://' + bookingUrl;
          }

          const payload = normalizeReservationItem({
            id: existing ? existing.id : uid('res'),
            type: selectedType,
            status: selectedStatus,
            title,
            provider: document.getElementById('rProvider').value.trim(),
            location: document.getElementById('rLocation').value.trim(),
            checkIn: document.getElementById('rCheckIn').value.trim(),
            checkOut: document.getElementById('rCheckOut').value.trim(),
            confirmationNumber: document.getElementById('rCode').value.trim(),
            bookingUrl,
            notes: document.getElementById('rNotes').value.trim()
          });

          if (existing) {
            Object.assign(existing, payload);
            showToast('Booking updated');
          } else {
            state.reservations.push(payload);
            // Reset vault filter if the newly added booking would otherwise be hidden
            if (appStore.vaultTypeFilter !== 'all' && appStore.vaultTypeFilter !== payload.type) {
              appStore.vaultTypeFilter = 'all';
            }
            if (appStore.vaultStatusFilter !== 'all' && appStore.vaultStatusFilter !== payload.status) {
              appStore.vaultStatusFilter = 'all';
            }
            showToast(`Added "${payload.title}" to Trip Vault`);
          }

          closeModal();
          renderReservations();
          scheduleCloudSave();
        }
      }
    ]
  });

  const titleEl = document.getElementById('rTitle');
  const providerEl = document.getElementById('rProvider');
  const locationEl = document.getElementById('rLocation');
  const checkInEl = document.getElementById('rCheckIn');
  const checkOutEl = document.getElementById('rCheckOut');
  const checkInLbl = document.getElementById('rCheckInLabel');
  const checkOutLbl = document.getElementById('rCheckOutLabel');
  const codeEl = document.getElementById('rCode');
  const notesEl = document.getElementById('rNotes');
  const previewIconEl = document.getElementById('rPreviewIcon');
  const previewTypeEl = document.getElementById('rPreviewType');
  const previewTitleEl = document.getElementById('rPreviewTitle');
  const previewStatusEl = document.getElementById('rPreviewStatus');

  function syncReservationModalUI() {
    const tMeta = RESERVATION_TYPE_META[selectedType] || RESERVATION_TYPE_META.hotel;
    const sMeta = RESERVATION_STATUS_META[selectedStatus] || RESERVATION_STATUS_META.confirmed;

    if (previewIconEl) {
      previewIconEl.className = `w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tMeta.style}`;
      previewIconEl.innerHTML = ICONS[tMeta.icon];
    }
    if (previewTypeEl) previewTypeEl.textContent = tMeta.label;
    if (previewTitleEl) previewTitleEl.textContent = titleEl?.value.trim() || `New ${tMeta.label}`;
    if (previewStatusEl) {
      previewStatusEl.className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold shrink-0 ${sMeta.badgeClass}`;
      previewStatusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${sMeta.dotClass}"></span><span>${esc(sMeta.label)}</span>`;
    }

    if (titleEl) titleEl.placeholder = tMeta.titlePlaceholder;
    if (providerEl) providerEl.placeholder = tMeta.providerPlaceholder;
    if (locationEl) locationEl.placeholder = tMeta.locationPlaceholder;
    if (checkInLbl) checkInLbl.textContent = tMeta.startLabel;
    if (checkOutLbl) checkOutLbl.textContent = tMeta.endLabel;
    if (checkInEl) checkInEl.placeholder = tMeta.startPlaceholder;
    if (checkOutEl) checkOutEl.placeholder = tMeta.endPlaceholder;
    if (codeEl) codeEl.placeholder = tMeta.codePlaceholder;
    if (notesEl) notesEl.placeholder = tMeta.notePlaceholder;

    document.querySelectorAll('[data-res-type]').forEach((btn) => {
      const k = btn.dataset.resType;
      const m = RESERVATION_TYPE_META[k];
      const active = k === selectedType;
      btn.className = `flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
        active
          ? `${m.style} ring-1 ring-white/50 shadow-md scale-[1.02]`
          : 'bg-black/35 border-white/10 text-white/65 hover:bg-white/10 hover:text-white'
      }`;
    });

    document.querySelectorAll('[data-res-status]').forEach((btn) => {
      const k = btn.dataset.resStatus;
      const m = RESERVATION_STATUS_META[k];
      const active = k === selectedStatus;
      btn.className = `flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
        active
          ? `${m.badgeClass} ring-1 ring-white/45 shadow-md scale-[1.02]`
          : 'bg-black/35 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
      }`;
    });
  }

  document.querySelectorAll('[data-res-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedType = btn.dataset.resType;
      syncReservationModalUI();
    });
  });

  document.querySelectorAll('[data-res-status]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedStatus = btn.dataset.resStatus;
      syncReservationModalUI();
    });
  });

  titleEl?.addEventListener('input', () => {
    if (previewTitleEl) {
      const tMeta = RESERVATION_TYPE_META[selectedType] || RESERVATION_TYPE_META.hotel;
      previewTitleEl.textContent = titleEl.value.trim() || `New ${tMeta.label}`;
    }
  });

  setTimeout(() => {
    if (!existing && titleEl) titleEl.focus();
  }, 100);
}

/**
 * One-Click Status Cycle on Any Booking Card (Confirmed → Pending → Cancelled)
 */
export function cycleReservationStatus(reservationId) {
  const list = appStore.state.reservations || [];
  const target = list.find((r) => r.id === reservationId);
  if (!target) return;

  const currMeta = RESERVATION_STATUS_META[target.status] || RESERVATION_STATUS_META.pending;
  const nextStatus = currMeta.next || 'confirmed';
  const nextMeta = RESERVATION_STATUS_META[nextStatus] || RESERVATION_STATUS_META.confirmed;

  target.status = nextStatus;
  renderReservations();
  scheduleCloudSave();
  showToast(`"${target.title}" marked ${nextMeta.label}`);
}

/**
 * Delete Booking Confirmation
 */
export function deleteReservation(reservationId) {
  const state = appStore.state;
  const target = (state.reservations || []).find((r) => r.id === reservationId);
  if (!target) return;

  openConfirmDeleteModal({
    title: 'Delete Reservation',
    itemName: target.title,
    detail: 'Do you want to remove this booking and its confirmation details from your Trip Vault?',
    confirmLabel: 'Yes, Remove Booking',
    onConfirm: () => {
      state.reservations = (state.reservations || []).filter((r) => r.id !== target.id);
      renderReservations();
      scheduleCloudSave();
      showToast('Booking removed');
    }
  });
}

/**
 * Add or Edit a Checklist Category
 */
export function openChecklistCategoryModal(groupId = null) {
  const state = appStore.state;
  const existing = groupId ? state.checklists.find((g) => g.id === groupId) : null;
  const inp = 'w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-sky-400/40';

  openModal({
    title: existing ? 'Rename Checklist Category' : 'Add New Checklist Category',
    bodyHtml: `
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-semibold text-white/60 mb-1">Category Name</label>
          <input id="catTitleInput" placeholder="e.g. Packing List, Baby Essentials, Road Trip Snacks" class="${inp}" value="${esc(existing ? existing.title : '')}" />
        </div>
        ${!existing ? `
          <div>
            <label class="block text-xs font-semibold text-white/60 mb-1">First Item <span class="text-white/40 font-normal">(Optional)</span></label>
            <input id="catFirstItemInput" placeholder="e.g. Sunglasses & sunscreen" class="${inp}" />
          </div>
        ` : ''}
      </div>
    `,
    footerButtons: [
      { label: 'Cancel', onClick: closeModal },
      {
        label: existing ? 'Save Name' : 'Add Category',
        variant: 'primary',
        onClick: () => {
          const title = document.getElementById('catTitleInput').value.trim();
          if (!title) return showToast('Please enter a category name', 'error');

          if (existing) {
            existing.title = title;
            showToast('Category renamed');
          } else {
            const firstItemText = document.getElementById('catFirstItemInput')?.value.trim() || '';
            const items = firstItemText ? [{ id: uid('c'), text: firstItemText, done: false }] : [];
            state.checklists.push({ id: uid('cat'), title, items });
            showToast(`Added "${title}" category`);
          }

          closeModal();
          renderChecklist();
          scheduleCloudSave();
        }
      }
    ]
  });

  setTimeout(() => {
    const inputEl = document.getElementById('catTitleInput');
    if (inputEl) inputEl.focus();
  }, 100);
}

/**
 * Add or Edit Official Link Modal
 */
export function openLinkModal(linkId = null) {
  const state = appStore.state;
  const existing = linkId ? state.links.find((l) => l.id === linkId) : null;
  const inp = 'w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-400/40';
  const iconOptions = Object.entries(LINK_ICON_META)
    .map(([k, v]) => `<option value="${k}" class="bg-slate-900" ${(existing?.icon || 'ticket') === k ? 'selected' : ''}>${v.label}</option>`)
    .join('');

  openModal({
    title: existing ? 'Edit Official Link' : 'Add Official Link',
    bodyHtml: `
      <div class="space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-white/60 mb-1">Link Label</label>
            <input id="lLabel" placeholder="e.g. Aerial Tramway" class="${inp}" value="${esc(existing ? existing.label : '')}" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-white/60 mb-1">Icon &amp; Category</label>
            <select id="lIcon" class="${inp}">${iconOptions}</select>
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-white/60 mb-1">Website URL</label>
          <input id="lUrl" type="url" placeholder="https://..." class="${inp}" value="${esc(existing ? existing.url : '')}" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-white/60 mb-1">Location</label>
            <input id="lLoc" placeholder="e.g. Palm Springs, CA" class="${inp}" value="${esc(existing ? (existing.location || '') : '')}" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-white/60 mb-1">Operating Hours</label>
            <input id="lHours" placeholder="e.g. Daily 10 AM – 5 PM" class="${inp}" value="${esc(existing ? (existing.hours || '') : '')}" />
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-white/60 mb-1">Important Info / Tips</label>
          <textarea id="lInfo" rows="2" placeholder="Parking notes, ticket deadlines, dress code, reservation tips..." class="${inp}">${esc(existing ? (existing.info || '') : '')}</textarea>
        </div>
      </div>
    `,
    footerButtons: [
      { label: 'Cancel', onClick: closeModal },
      {
        label: existing ? 'Save Changes' : 'Add Link',
        variant: 'primary',
        onClick: () => {
          const label = document.getElementById('lLabel').value.trim();
          let url = document.getElementById('lUrl').value.trim();
          const icon = document.getElementById('lIcon').value;
          const location = document.getElementById('lLoc').value.trim();
          const hours = document.getElementById('lHours').value.trim();
          const info = document.getElementById('lInfo').value.trim();

          if (!label || !url) return showToast('Please enter label and URL', 'error');
          if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

          if (existing) {
            Object.assign(existing, { label, url, icon, location, hours, info });
            showToast('Link updated');
          } else {
            state.links.push({ id: uid('l'), label, url, icon, location, hours, info });
            showToast('Link added');
          }
          closeModal();
          renderLinks();
          scheduleCloudSave();
        }
      }
    ]
  });
}

/**
 * Add or Edit Budget Expense Modal (with Category Icon Dropdown & Final Cost Breakdown)
 */
export function openBudgetModal(itemId = null) {
  const state = appStore.state;
  const existing = itemId ? state.budget.items.find((i) => i.id === itemId) : null;
  let selectedCategory = existing ? inferBudgetCategory(existing) : 'hotel';
  const initialEntries = existing
    ? (Array.isArray(existing.finalEntries) && existing.finalEntries.length > 0
        ? existing.finalEntries.map((e) => ({ ...e }))
        : (existing.final !== null && existing.final !== '' && !Number.isNaN(Number(existing.final))
            ? [{ id: uid('fe'), detail: 'Final Cost', amount: Number(existing.final) }]
            : []))
    : [];
  let modalEntries = initialEntries;

  const selectedMeta = BUDGET_CATEGORY_META[selectedCategory] || BUDGET_CATEGORY_META.custom;
  const isCustomInitial = selectedCategory === 'custom' || (existing && existing.label && existing.label !== selectedMeta.defaultName);
  const inp = 'w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-sky-400/40 transition-all';

  const dropdownItemsHtml = Object.entries(BUDGET_CATEGORY_META).map(([key, meta]) => `
    <button
      type="button"
      data-cat-option="${key}"
      class="w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-150 hover:bg-white/10 hover:translate-x-0.5 cursor-pointer ${selectedCategory === key ? 'bg-sky-500/20 border border-sky-400/35' : 'border border-transparent'}"
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <span class="w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${meta.style}">${ICONS[meta.icon]}</span>
        <span class="text-xs sm:text-sm font-medium text-white truncate">${esc(meta.label)}</span>
      </div>
      ${key === 'custom' ? `<span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-400/20 text-orange-200">Custom</span>` : ''}
    </button>
  `).join('');

  openModal({
    title: existing ? 'Edit Budget Expense' : 'Add Budget Expense',
    bodyHtml: `
      <div class="space-y-4">
        <div class="relative space-y-2">
          <label class="block text-xs font-semibold text-white/60">Expense Category &amp; Name</label>
          <button
            id="bCatTrigger"
            type="button"
            class="w-full flex items-center justify-between gap-3 rounded-2xl border border-white/15 hover:border-sky-400/40 bg-black/45 px-3.5 py-2.5 text-left transition-all duration-200 cursor-pointer"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span id="bCatIconBadge" class="w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 ${selectedMeta.style}">
                ${ICONS[selectedMeta.icon]}
              </span>
              <div class="min-w-0">
                <div id="bCatTriggerLabel" class="text-sm font-semibold text-white truncate">${esc(selectedMeta.label)}</div>
                <div class="text-[10px] text-white/45">Click to choose category or Custom</div>
              </div>
            </div>
            <span id="bCatChevron" class="text-white/60 transition-transform duration-300 shrink-0">${ICONS.chevronDown}</span>
          </button>

          <div id="bCatMenu" class="hidden rounded-2xl border border-white/20 bg-[#141720]/98 backdrop-blur-2xl p-2 space-y-1 shadow-2xl shadow-black/70 max-h-56 overflow-y-auto animate-slideDown">
            ${dropdownItemsHtml}
          </div>

          <div id="bCustomNameWrap" class="${isCustomInitial ? '' : 'hidden'} pt-1 animate-slideDown">
            <label class="block text-[11px] font-semibold text-orange-200/90 mb-1">Custom Expense Name</label>
            <input id="bLabel" placeholder="e.g. Boutique Hotels, Disney Tickets, Car Rental" class="${inp} border-orange-400/30" value="${esc(existing ? existing.label : (selectedMeta.defaultName || ''))}" />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-white/60 mb-1">Estimated Cost ($)</label>
            <input id="bEst" type="number" min="0" step="0.01" value="${existing ? (Number(existing.estimated) || 0) : 100}" class="${inp}" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-white/60 mb-1">General Note <span class="text-white/40 font-normal">(Optional)</span></label>
            <input id="bNote" placeholder="e.g. 3 nights across 2 cities" class="${inp}" value="${esc(existing ? (existing.note || '') : '')}" />
          </div>
        </div>

        <div class="rounded-2xl border border-sky-400/25 bg-sky-500/[0.06] p-3.5 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <div>
              <div class="text-xs font-semibold text-sky-200 flex items-center gap-1.5">
                <span>${ICONS.receipt}</span>
                <span>Final Cost Breakdown</span>
              </div>
              <p class="text-[11px] text-white/50 mt-0.5">Add each hotel, meal, or receipt separately — auto-totals below.</p>
            </div>
            <div class="text-right shrink-0">
              <div class="text-[10px] uppercase tracking-wider text-white/45 font-bold">Final Sum</div>
              <div id="bModalFinalSum" class="text-base font-bold bg-gradient-to-r from-orange-300 to-sky-300 bg-clip-text text-transparent tabular-nums">$0.00</div>
            </div>
          </div>

          <div id="bModalEntriesList" class="space-y-1.5 max-h-36 overflow-y-auto pr-0.5"></div>

          <div class="flex items-center gap-1.5 pt-1">
            <input id="bNewEntryDetail" type="text" placeholder="${esc(selectedMeta.placeholder)}" class="flex-1 min-w-0 rounded-xl border border-white/15 bg-black/45 px-3 py-2 text-xs text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-sky-400/40" />
            <div class="relative w-24 shrink-0">
              <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-sky-300/70">$</span>
              <input id="bNewEntryAmount" type="number" min="0" step="0.01" placeholder="0.00" class="w-full rounded-xl border border-sky-400/25 bg-sky-500/10 pl-6 pr-2 py-2 text-xs font-semibold text-right text-sky-100 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-sky-400/50 tabular-nums" />
            </div>
            <button id="bAddEntryBtn" type="button" class="px-3 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-sky-500 hover:from-orange-400 hover:to-sky-400 text-white text-xs font-semibold shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0">+ Add</button>
          </div>
        </div>
      </div>
    `,
    footerButtons: [
      { label: 'Cancel', onClick: closeModal },
      {
        label: existing ? 'Save Changes' : 'Add Expense',
        variant: 'primary',
        onClick: () => {
          const pendingDetail = document.getElementById('bNewEntryDetail')?.value.trim() || '';
          const pendingAmtRaw = document.getElementById('bNewEntryAmount')?.value.trim() || '';
          if (pendingDetail && pendingAmtRaw !== '') {
            modalEntries.push({ id: uid('fe'), detail: pendingDetail, amount: Math.max(0, Number(pendingAmtRaw) || 0) });
          }

          const meta = BUDGET_CATEGORY_META[selectedCategory] || BUDGET_CATEGORY_META.custom;
          const customTyped = document.getElementById('bLabel')?.value.trim() || '';
          const label = selectedCategory === 'custom'
            ? customTyped
            : (customTyped || meta.defaultName || meta.label);

          if (!label) return showToast('Please enter a custom expense name', 'error');

          const estimated = Math.max(0, Number(document.getElementById('bEst').value) || 0);
          const note = document.getElementById('bNote').value.trim();
          const computedFinal = modalEntries.length > 0
            ? modalEntries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
            : null;

          if (existing) {
            existing.category = selectedCategory;
            existing.label = label;
            existing.estimated = estimated;
            existing.final = computedFinal;
            existing.finalEntries = modalEntries;
            existing.note = note;
            if (modalEntries.length > 0) appStore.expandedBudgetIds.add(existing.id);
            showToast('Expense updated');
          } else {
            const newId = uid('b');
            state.budget.items.push({
              id: newId,
              category: selectedCategory,
              label,
              estimated,
              final: computedFinal,
              finalEntries: modalEntries,
              note
            });
            if (modalEntries.length > 0) appStore.expandedBudgetIds.add(newId);
            showToast('Expense added');
          }
          closeModal();
          renderBudget();
          updateBudgetTotals(true);
          scheduleCloudSave();
        }
      }
    ]
  });

  const triggerBtn = document.getElementById('bCatTrigger');
  const menuEl = document.getElementById('bCatMenu');
  const chevronEl = document.getElementById('bCatChevron');
  const iconBadgeEl = document.getElementById('bCatIconBadge');
  const triggerLabelEl = document.getElementById('bCatTriggerLabel');
  const customWrapEl = document.getElementById('bCustomNameWrap');
  const labelInp = document.getElementById('bLabel');
  const detailInp = document.getElementById('bNewEntryDetail');
  const amtInp = document.getElementById('bNewEntryAmount');
  const entriesListEl = document.getElementById('bModalEntriesList');
  const finalSumEl = document.getElementById('bModalFinalSum');

  function renderModalEntries(animateSum = false) {
    const sum = modalEntries.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    finalSumEl.textContent = `$${sum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (animateSum) {
      finalSumEl.classList.remove('animate-budgetPop');
      void finalSumEl.offsetWidth;
      finalSumEl.classList.add('animate-budgetPop');
    }

    if (modalEntries.length === 0) {
      entriesListEl.innerHTML = `<div class="rounded-xl border border-dashed border-white/10 bg-black/25 px-3 py-2 text-[11px] text-white/40 text-center">No final items added yet — add individual costs below.</div>`;
      return;
    }

    entriesListEl.innerHTML = modalEntries.map((entry) => `
      <div class="flex items-center justify-between gap-2 rounded-xl bg-black/40 border border-white/10 px-3 py-1.5 animate-rowEnter">
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-orange-400 to-sky-400 shrink-0"></span>
          <span class="text-xs text-white/90 truncate">${esc(entry.detail)}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-xs font-bold text-sky-200 tabular-nums">$${(Number(entry.amount) || 0).toFixed(2)}</span>
          <button type="button" data-modal-del-entry="${esc(entry.id)}" class="p-1 rounded-lg text-white/45 hover:text-rose-300 hover:bg-rose-500/20 cursor-pointer">${ICONS.close}</button>
        </div>
      </div>
    `).join('');

    entriesListEl.querySelectorAll('[data-modal-del-entry]').forEach((delBtn) => {
      delBtn.addEventListener('click', () => {
        modalEntries = modalEntries.filter((e) => e.id !== delBtn.dataset.modalDelEntry);
        renderModalEntries(true);
      });
    });
  }

  const addModalEntry = () => {
    const detail = detailInp.value.trim();
    const amtRaw = amtInp.value.trim();
    if (!detail || amtRaw === '') return showToast('Enter detail name and amount', 'error');
    modalEntries.push({ id: uid('fe'), detail, amount: Math.max(0, Number(amtRaw) || 0) });
    detailInp.value = '';
    amtInp.value = '';
    detailInp.focus();
    renderModalEntries(true);
  };

  document.getElementById('bAddEntryBtn')?.addEventListener('click', addModalEntry);
  amtInp?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addModalEntry();
    }
  });

  triggerBtn?.addEventListener('click', () => {
    const isHidden = menuEl.classList.contains('hidden');
    menuEl.classList.toggle('hidden');
    chevronEl.classList.toggle('rotate-180', isHidden);
  });

  menuEl?.querySelectorAll('[data-cat-option]').forEach((optBtn) => {
    optBtn.addEventListener('click', () => {
      selectedCategory = optBtn.dataset.catOption;
      const meta = BUDGET_CATEGORY_META[selectedCategory] || BUDGET_CATEGORY_META.custom;

      iconBadgeEl.className = `w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 animate-budgetPop ${meta.style}`;
      iconBadgeEl.innerHTML = ICONS[meta.icon];
      triggerLabelEl.textContent = meta.label;
      detailInp.placeholder = meta.placeholder;

      menuEl.querySelectorAll('[data-cat-option]').forEach((b) => {
        const active = b.dataset.catOption === selectedCategory;
        b.classList.toggle('bg-sky-500/20', active);
        b.classList.toggle('border-sky-400/35', active);
        b.classList.toggle('border-transparent', !active);
      });

      if (selectedCategory === 'custom') {
        customWrapEl.classList.remove('hidden');
        if (!existing || Object.values(BUDGET_CATEGORY_META).some((m) => m.defaultName === labelInp.value.trim())) {
          labelInp.value = '';
        }
        setTimeout(() => labelInp.focus(), 80);
      } else {
        customWrapEl.classList.add('hidden');
        labelInp.value = meta.defaultName;
      }

      menuEl.classList.add('hidden');
      chevronEl.classList.remove('rotate-180');
    });
  });

  renderModalEntries(false);
}

/**
 * Add or Edit Trip Day Modal (with Verified Location Picker, Scene Presets & Custom Photo Links)
 */
export function openDayModal(dayId = null) {
  const state = appStore.state;
  const existing = dayId ? state.days.find((d) => d.id === dayId) : null;
  const inp = 'w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-sky-400/40 transition-all';
  const currentScene = existing?.scene || 'desert';
  const sceneOptions = [
    { k: 'ps_tramway', l: 'Palm Springs Aerial Tramway' },
    { k: 'xmas_lights', l: 'Christmas Lights & Golden Glow' },
    { k: 'xmas_village', l: 'Christmas Village & Festive Street' },
    { k: 'lights', l: 'Twilight Foothills & Holiday Lights' },
    { k: 'desert', l: 'Desert Oasis & Palm Sunset' },
    { k: 'tram', l: 'Alpine Mountain Peaks & Snow' },
    { k: 'farm', l: 'Evergreen Pine Forest & Village' },
    { k: 'beach', l: 'Coastal Ocean Sunset' },
    { k: 'canyon', l: 'Red Rock Canyon & Mesa' },
    { k: 'city', l: 'Neon City Skyline & Night' },
    { k: 'lake', l: 'Emerald Lake & Reflections' },
    { k: 'meadow', l: 'Golden Valley & Wildflowers' },
    { k: 'autumn', l: 'Autumn Forest & Foliage' },
    { k: 'custom', l: 'Custom Photo Links (Paste URL)' }
  ].map((o) => `<option value="${o.k}" class="bg-slate-900" ${currentScene === o.k ? 'selected' : ''}>${o.l}</option>`).join('');

  let dayLocationPicker = null;
  let isSavingDay = false;

  openModal({
    title: existing ? 'Edit Day Details' : 'Add New Day',
    bodyHtml: `
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-2.5">
          <div><label class="block text-xs font-semibold text-white/60 mb-1">Day Code</label><input id="dShort" placeholder="TUE" class="${inp}" value="${esc(existing ? existing.shortDay : `DAY ${state.days.length + 1}`)}" /></div>
          <div><label class="block text-xs font-semibold text-white/60 mb-1">Date</label><input id="dDate" placeholder="Dec 1" class="${inp}" value="${esc(existing ? existing.shortDate : '')}" /></div>
        </div>

        <!-- Verified Location (Live Temp) Picker -->
        <div class="relative space-y-1.5">
          <label class="block text-xs font-semibold text-sky-300/90">Location (Live Temp) <span class="text-white/40 font-normal">(Pick match or Verify exact city)</span></label>
          <div class="flex items-center gap-1.5">
            <input
              id="dLoc"
              autocomplete="off"
              placeholder="Search city &amp; state/country (e.g. Palm Springs, CA · Paris, France)"
              class="${inp} border-sky-400/30 flex-1 min-w-0"
              value="${esc(existing ? existing.location : '')}"
            />
            <button
              id="dVerifyLocBtn"
              type="button"
              class="px-3 py-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/40 text-xs font-semibold text-sky-100 transition-all cursor-pointer shrink-0"
            >Verify</button>
          </div>
          <div id="dLocSuggestions" class="hidden rounded-2xl border border-sky-400/30 bg-[#141720]/98 backdrop-blur-2xl p-1.5 space-y-1 shadow-2xl shadow-black/70 max-h-52 overflow-y-auto animate-slideDown"></div>
          <div id="dLocVerifyStatus" class="text-[11px] leading-snug text-white/50">
            Type a city or destination, then pick a match or click Verify so weather never confuses locations.
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-white/60 mb-1">Landscape &amp; 3D Scene</label>
          <select id="dScene" class="${inp}">${sceneOptions}</select>
        </div>

        <div id="customPhotoBox" class="${currentScene === 'custom' ? '' : 'hidden'} rounded-2xl border border-sky-400/30 bg-sky-500/10 p-3.5 space-y-3 animate-popIn">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold text-sky-200">Custom Photo Links</span>
            <span class="text-[11px] text-white/55">Paste any direct image URL (.jpg, .png, .webp)</span>
          </div>
          <div class="space-y-2.5">
            <div>
              <label class="block text-[11px] font-semibold text-white/70 mb-1">3D Spotlight Card Image URL</label>
              <div class="flex items-center gap-2">
                <input id="dCustomCardUrl" type="url" placeholder="https://example.com/card-photo.jpg" class="${inp} text-xs" value="${esc(existing?.customCardUrl || '')}" />
                <img id="previewCustomCard" src="${esc(existing?.customCardUrl || 'https://placehold.co/96x64/16171d/94a3b8?text=Card')}" alt="Card preview" onerror="this.src='https://placehold.co/96x64/16171d/f87171?text=Invalid'" class="w-14 h-10 rounded-lg object-cover border border-white/15 shrink-0 bg-black/40" />
              </div>
            </div>
            <div>
              <label class="block text-[11px] font-semibold text-white/70 mb-1">Main Page Background Image URL (Optional)</label>
              <div class="flex items-center gap-2">
                <input id="dCustomBgUrl" type="url" placeholder="https://example.com/background-landscape.jpg" class="${inp} text-xs" value="${esc(existing?.customBgUrl || '')}" />
                <img id="previewCustomBg" src="${esc(existing?.customBgUrl || 'https://placehold.co/96x64/16171d/94a3b8?text=BG')}" alt="Background preview" onerror="this.src='https://placehold.co/96x64/16171d/f87171?text=Invalid'" class="w-14 h-10 rounded-lg object-cover border border-white/15 shrink-0 bg-black/40" />
              </div>
            </div>
          </div>
        </div>

        <div><label class="block text-xs font-semibold text-white/60 mb-1">Full Day Title</label><input id="dTitle" placeholder="Day 5 · Tuesday, Dec 1" class="${inp}" value="${esc(existing ? existing.title : `Day ${state.days.length + 1} · `)}" /></div>
        <div><label class="block text-xs font-semibold text-white/60 mb-1">Subtitle / Theme</label><input id="dSub" placeholder="Highlights for the day" class="${inp}" value="${esc(existing ? existing.subtitle : '')}" /></div>
        <div><label class="block text-xs font-semibold text-white/60 mb-1">Hotel / Status Tag</label><input id="dTag" placeholder="Hotel: Palm Desert" class="${inp}" value="${esc(existing ? existing.tag : '')}" /></div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div><label class="block text-xs font-semibold text-white/60 mb-1">Tip Label</label><input id="dNoteTitle" class="${inp}" value="${esc(existing ? existing.noteTitle : 'Reminder')}" /></div>
          <div class="sm:col-span-2"><label class="block text-xs font-semibold text-white/60 mb-1">Day Tip / Note</label><textarea id="dNoteBody" rows="2" class="${inp}">${esc(existing ? existing.noteBody : '')}</textarea></div>
        </div>
      </div>
    `,
    footerButtons: [
      { label: 'Cancel', onClick: closeModal },
      {
        label: existing ? 'Save Day' : 'Create Day',
        variant: 'primary',
        onClick: async () => {
          if (isSavingDay) return;
          const title = document.getElementById('dTitle').value.trim();
          if (!title) return showToast('Please enter a day title', 'error');
          const selectedScene = document.getElementById('dScene').value;
          const customCardUrl = document.getElementById('dCustomCardUrl')?.value.trim() || '';
          const customBgUrl = document.getElementById('dCustomBgUrl')?.value.trim() || '';

          if (selectedScene === 'custom' && !customCardUrl && !customBgUrl) {
            return showToast('Please paste at least one custom photo link', 'error');
          }

          isSavingDay = true;
          const locRes = await dayLocationPicker.ensureVerified();
          isSavingDay = false;

          if (!locRes.ok) {
            if (locRes.reason === 'ambiguous') {
              return showToast('Multiple locations match — please pick the exact one from the list', 'error');
            }
            return showToast('Please verify the location before saving', 'error');
          }

          const prevCoords = normalizeLocationCoords(existing?.locationCoords);
          const locationChanged = !existing ||
            !prevCoords ||
            Math.abs(prevCoords.lat - locRes.coords.lat) > 0.001 ||
            Math.abs(prevCoords.lng - locRes.coords.lng) > 0.001;

          const payload = {
            shortDay: document.getElementById('dShort').value.trim() || `DAY ${state.days.length + 1}`,
            shortDate: document.getElementById('dDate').value.trim(),
            location: locRes.label,
            locationFullName: locRes.fullName,
            locationCoords: { lat: locRes.coords.lat, lng: locRes.coords.lng },
            locationVerified: true,
            landmark: existing && !locationChanged ? (existing.landmark || locRes.fullName) : locRes.fullName,
            cardLandmark: existing && !locationChanged ? (existing.cardLandmark || `${locRes.fullName} sightseeing`) : `${locRes.fullName} sightseeing`,
            resolvedCardPhoto: null,
            scene: selectedScene,
            useScenePreset: selectedScene !== 'custom',
            customCardUrl,
            customBgUrl,
            title,
            subtitle: document.getElementById('dSub').value.trim(),
            tag: document.getElementById('dTag').value.trim(),
            noteTitle: document.getElementById('dNoteTitle').value.trim() || 'Tip',
            noteBody: document.getElementById('dNoteBody').value.trim()
          };

          if (existing) {
            if (locationChanged) payload.temp = '--°F';
            Object.assign(existing, payload);
            showToast(`Day updated (${locRes.label}) · syncing live weather...`);
          } else {
            state.days.push({ id: uid('day'), temp: '--°F', ...payload, events: [] });
            appStore.activeCarouselIndex = state.days.length - 1;
            showToast(`New day added (${locRes.label}) · syncing live weather...`);
          }
          closeModal();
          updateBackdropForDay(state.days[appStore.activeCarouselIndex]);
          prefetchCardPhotoForDay(state.days[appStore.activeCarouselIndex]).then(() => renderCarousel());
          renderForecastStrip();
          renderCarousel();
          renderItinerary();
          syncLiveWeatherForActiveDay();
          refreshTripTravelRoutes();
          scheduleCloudSave();
        }
      }
    ]
  });

  dayLocationPicker = attachVerifiedLocationPicker({
    inputId: 'dLoc',
    verifyBtnId: 'dVerifyLocBtn',
    suggestionsId: 'dLocSuggestions',
    statusId: 'dLocVerifyStatus',
    initialLocation: existing ? existing.location : '',
    initialFullName: existing ? (existing.locationFullName || existing.location) : '',
    initialCoords: existing ? existing.locationCoords : null
  });

  const sceneSelect = document.getElementById('dScene');
  const customBox = document.getElementById('customPhotoBox');
  const cardUrlInp = document.getElementById('dCustomCardUrl');
  const bgUrlInp = document.getElementById('dCustomBgUrl');
  const cardPreview = document.getElementById('previewCustomCard');
  const bgPreview = document.getElementById('previewCustomBg');

  sceneSelect?.addEventListener('change', () => {
    if (sceneSelect.value === 'custom') {
      customBox.classList.remove('hidden');
    } else {
      customBox.classList.add('hidden');
    }
  });

  cardUrlInp?.addEventListener('input', () => {
    const val = cardUrlInp.value.trim();
    cardPreview.src = val || 'https://placehold.co/96x64/16171d/94a3b8?text=Card';
  });

  bgUrlInp?.addEventListener('input', () => {
    const val = bgUrlInp.value.trim();
    bgPreview.src = val || 'https://placehold.co/96x64/16171d/94a3b8?text=BG';
  });
}

/**
 * Delete Trip Day Confirmation
 */
export function confirmDeleteDay(dayId) {
  const state = appStore.state;
  const day = state.days.find((d) => d.id === dayId);
  if (!day) return;
  openConfirmDeleteModal({
    title: 'Delete Trip Day',
    itemName: day.title,
    detail: `This will permanently remove this day and all ${day.events.length} scheduled stops.`,
    confirmLabel: 'Yes, Delete Day',
    onConfirm: () => {
      state.days = state.days.filter((d) => d.id !== dayId);
      if (appStore.activeCarouselIndex >= state.days.length) {
        appStore.activeCarouselIndex = Math.max(0, state.days.length - 1);
      }
      updateBackdropForDay(state.days[appStore.activeCarouselIndex]);
      renderForecastStrip();
      renderCarousel();
      renderItinerary();
      syncLiveWeatherForActiveDay();
      scheduleCloudSave();
      showToast('Day deleted');
    }
  });
}

/**
 * ============================================================================
 * SMART ITINERARY STOP MODAL (Time Slots, 0-Min Milestone, Verified Address)
 * ============================================================================
 */
export function openEventModal(dayId, eventId = null, preselectedCategory = null) {
  const day = appStore.state.days.find((d) => d.id === dayId);
  if (!day) return;

  const existing = eventId ? day.events.find((e) => e.id === eventId) : null;
  if (existing) normalizeEventSchedule(existing);

  let defaultStart = 9 * 60;
  if (existing) {
    defaultStart = existing.startMinutes;
  } else if (day.events.length > 0) {
    const last = day.events[day.events.length - 1];
    normalizeEventSchedule(last);
    const stepAfterLast = last.durationMinutes > 0 ? last.durationMinutes : TIME_SLOT_STEP;
    defaultStart = roundUpToSlot(last.startMinutes + stepAfterLast, TIME_SLOT_STEP);
  }

  const hasExistingDur = existing && existing.durationMinutes !== null && existing.durationMinutes !== undefined && Number.isFinite(Number(existing.durationMinutes));
  const defaultDuration = hasExistingDur ? Number(existing.durationMinutes) : 60;

  const defaultRes = existing?.reservationMinutes ?? null;
  const defaultFixed = Boolean(existing?.isFixed || defaultRes !== null);
  const defaultCompleted = Boolean(existing?.completed);
  const selectedCat = preselectedCategory || existing?.category || 'explore';
  const defaultTravelMode = existing?.travelMode || 'auto';

  let verifiedLocationCoords = existing?.locationCoords
    ? { lat: Number(existing.locationCoords.lat), lng: Number(existing.locationCoords.lng) }
    : null;
  let initialLocationText = existing ? (existing.location || '') : '';

  const inp = 'w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-sky-400/40 transition-all';

  const timeSlots = getTimeSlotOptions();
  const startOptionsHtml = timeSlots
    .map((s) => `<option value="${s.value}" class="bg-slate-900" ${s.value === defaultStart ? 'selected' : ''}>${esc(s.label)}</option>`)
    .join('');

  const resOptionsHtml =
    `<option value="" class="bg-slate-900" ${defaultRes === null ? 'selected' : ''}>None (Flexible or Manual)</option>` +
    timeSlots
      .map((s) => `<option value="${s.value}" class="bg-slate-900" ${s.value === defaultRes ? 'selected' : ''}>${esc(s.label)}</option>`)
      .join('');

  const durValues = new Set(DURATION_OPTIONS.map((d) => d.value));
  const mergedDurations = durValues.has(defaultDuration)
    ? DURATION_OPTIONS
    : [...DURATION_OPTIONS, { value: defaultDuration, label: `${defaultDuration} min` }].sort((a, b) => a.value - b.value);

  const durationOptionsHtml = mergedDurations
    .map((d) => `<option value="${d.value}" class="bg-slate-900" ${d.value === defaultDuration ? 'selected' : ''}>${esc(d.label)}</option>`)
    .join('');

  const allCategories = getAllCategories();
  const categoryOptionsHtml = Object.entries(allCategories)
    .map(([k, v]) => `<option value="${esc(k)}" class="bg-slate-900" ${selectedCat === k ? 'selected' : ''}>${esc(v.label)}${v.isCustom ? ' ★' : ''}</option>`)
    .join('');

  openModal({
    title: existing ? 'Edit Itinerary Stop' : 'Add Itinerary Stop',
    bodyHtml: `
      <div class="space-y-4">
        <!-- Live Formatted Time Window Preview -->
        <div class="rounded-2xl bg-gradient-to-r from-orange-500/15 via-sky-500/12 to-indigo-500/15 border border-white/15 px-4 py-3 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-8 h-8 rounded-xl bg-black/40 border border-white/15 flex items-center justify-center text-orange-300 shrink-0">${ICONS.clock}</span>
            <div class="min-w-0">
              <div id="evPreviewLabel" class="text-[10px] font-bold uppercase tracking-widest text-white/55">${defaultDuration === 0 ? 'Point in Time · Milestone' : 'Scheduled Time Slot'}</div>
              <div id="evPreviewWindow" class="text-sm sm:text-base font-bold text-white tabular-nums truncate">${esc(formatTimeWindow(defaultStart, defaultDuration))}</div>
            </div>
          </div>
          <span id="evPreviewLockBadge" class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 border ${
            defaultFixed
              ? 'bg-amber-500/20 border-amber-400/45 text-amber-200'
              : 'bg-sky-500/15 border-sky-400/30 text-sky-200'
          }">${defaultRes !== null ? 'Reservation · Fixed' : (defaultFixed ? 'Fixed Time' : 'Flexible')}</span>
        </div>

        <!-- Start Time Slot & Duration Pickers -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-white/65 mb-1">Start Time Slot</label>
            <select id="evStartSlot" class="${inp} tabular-nums">${startOptionsHtml}</select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-white/65 mb-1">Duration</label>
            <select id="evDuration" class="${inp}">${durationOptionsHtml}</select>
          </div>
        </div>

        <!-- Reservation / Appointment Time & Fixed Time Lock Card -->
        <div class="rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] p-3.5 space-y-3">
          <div class="flex items-center gap-2 text-xs font-semibold text-amber-200">
            <span>${ICONS.calendarClock}</span>
            <span>Reservation / Appointment Time &amp; Lock</span>
          </div>

          <div>
            <label class="block text-[11px] font-medium text-white/65 mb-1">Reservation or Appointment Time <span class="text-white/40">(Automatically locks as Fixed Time)</span></label>
            <select id="evResTime" class="${inp} border-amber-400/30 tabular-nums">${resOptionsHtml}</select>
          </div>

          <label class="flex items-start gap-2.5 cursor-pointer select-none pt-0.5">
            <input id="evFixedToggle" type="checkbox" ${defaultFixed ? 'checked' : ''} class="mt-0.5 w-4 h-4 rounded accent-amber-400 cursor-pointer" />
            <div class="text-xs leading-snug">
              <span class="font-semibold text-white flex items-center gap-1.5">
                <span class="text-amber-300">${ICONS.lock}</span>
                <span>Mark as Fixed Time</span>
              </span>
              <p class="text-[11px] text-white/55 mt-0.5">Prevents this activity from automatically shifting when earlier stops move.</p>
            </div>
          </label>
        </div>

        <!-- Category Picker + Quick Custom Category Trigger -->
        <div>
          <div class="flex items-center justify-between gap-2 mb-1">
            <label class="block text-xs font-semibold text-white/65">Activity Category &amp; Live Animation</label>
            <button id="evQuickNewCatBtn" type="button" class="text-[11px] font-semibold text-sky-300 hover:text-sky-200 transition-colors cursor-pointer">+ Create Custom</button>
          </div>
          <div class="flex items-center gap-2.5">
            <span id="evCatPreviewBadge" class="cat-icon-badge w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"></span>
            <select id="evCat" class="${inp} flex-1">${categoryOptionsHtml}</select>
          </div>
        </div>

        <!-- Verified Location Input with Live Suggestions & Verify Button -->
        <div class="relative space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <label class="block text-xs font-semibold text-sky-300/90">Destination / Location <span class="text-white/40 font-normal">(Pick suggestion or Verify)</span></label>
            <select id="evTravelMode" title="Transit mode arriving at this stop" class="rounded-lg border border-white/15 bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-sky-200 focus:outline-none focus:ring-1 focus:ring-sky-400/50 cursor-pointer">
              <option value="auto" class="bg-slate-900" ${defaultTravelMode === 'auto' ? 'selected' : ''}>Transit: Auto</option>
              <option value="drive" class="bg-slate-900" ${defaultTravelMode === 'drive' ? 'selected' : ''}>Transit: Drive</option>
              <option value="walk" class="bg-slate-900" ${defaultTravelMode === 'walk' ? 'selected' : ''}>Transit: Walk</option>
            </select>
          </div>

          <div class="flex items-center gap-1.5">
            <input
              id="evLocation"
              autocomplete="off"
              placeholder="Type street address or place (e.g. 4050 University Ave, Riverside, CA)"
              class="${inp} border-sky-400/25 flex-1 min-w-0"
              value="${esc(initialLocationText)}"
            />
            <button
              id="evVerifyLocBtn"
              type="button"
              class="px-3 py-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/40 text-xs font-semibold text-sky-100 transition-all cursor-pointer shrink-0"
            >Verify</button>
          </div>

          <!-- Live Address Autocomplete Dropdown -->
          <div id="evLocationSuggestions" class="hidden rounded-2xl border border-sky-400/30 bg-[#141720]/98 backdrop-blur-2xl p-1.5 space-y-1 shadow-2xl shadow-black/70 max-h-52 overflow-y-auto animate-slideDown"></div>

          <!-- Verification Status Message -->
          <div id="evLocVerifyStatus" class="text-[11px] leading-snug ${verifiedLocationCoords && initialLocationText ? 'text-emerald-300' : 'text-white/45'}">
            ${verifiedLocationCoords && initialLocationText
              ? '✓ Exact map pin verified for accurate distance & travel time.'
              : 'Tip: Select a suggested address or click Verify to lock in the exact map pin.'}
          </div>
        </div>

        <!-- Activity Details -->
        <div>
          <label class="block text-xs font-semibold text-white/65 mb-1">Activity Details</label>
          <textarea id="evText" rows="3" placeholder="Describe the stop, restaurant, reservation confirmation, or notes..." class="${inp}">${esc(existing ? existing.text : '')}</textarea>
        </div>

        ${existing ? `
          <label class="flex items-center gap-2.5 cursor-pointer select-none pt-1">
            <input id="evCompletedToggle" type="checkbox" ${defaultCompleted ? 'checked' : ''} class="w-4 h-4 rounded accent-emerald-400 cursor-pointer" />
            <span class="text-xs font-medium text-emerald-200">Mark this activity as completed</span>
          </label>
        ` : ''}
      </div>
    `,
    footerButtons: [
      { label: 'Cancel', onClick: closeModal },
      {
        label: existing ? 'Save Stop' : 'Add Stop',
        variant: 'primary',
        onClick: () => {
          const startMinutes = Number(document.getElementById('evStartSlot').value);
          const rawDur = Number(document.getElementById('evDuration').value);
          const durationMinutes = Number.isFinite(rawDur) && rawDur >= 0 ? rawDur : 60;
          const resRaw = document.getElementById('evResTime').value;
          const reservationMinutes = resRaw === '' ? null : Number(resRaw);
          const isFixed = reservationMinutes !== null ? true : Boolean(document.getElementById('evFixedToggle').checked);
          const finalStart = reservationMinutes !== null ? reservationMinutes : startMinutes;
          const category = document.getElementById('evCat').value;
          const location = document.getElementById('evLocation').value.trim();
          const travelMode = document.getElementById('evTravelMode')?.value || 'auto';
          const text = document.getElementById('evText').value.trim();
          const completed = existing ? Boolean(document.getElementById('evCompletedToggle')?.checked) : false;

          if (!text) return showToast('Please enter activity details', 'error');

          const finalCoords = location ? verifiedLocationCoords : null;
          const snapshot = captureStartSnapshot(day);
          const formattedTime = formatTimeWindow(finalStart, durationMinutes);
          let targetId = existing?.id;

          if (existing) {
            existing.startMinutes = finalStart;
            existing.durationMinutes = durationMinutes;
            existing.time = formattedTime;
            existing.reservationMinutes = reservationMinutes;
            existing.isFixed = isFixed;
            existing.category = category;
            existing.location = location;
            existing.locationCoords = finalCoords;
            existing.travelMode = travelMode;
            existing.text = text;
            existing.completed = completed;
          } else {
            targetId = uid('ev');
            day.events.push({
              id: targetId,
              time: formattedTime,
              startMinutes: finalStart,
              durationMinutes,
              reservationMinutes,
              isFixed,
              completed: false,
              category,
              location,
              locationCoords: finalCoords,
              travelMode,
              text
            });
          }

          day.events.sort((a, b) => a.startMinutes - b.startMinutes);
          const idx = day.events.findIndex((e) => e.id === targetId);
          const shiftedCount = rippleFlexibleActivitiesFrom(day, Math.max(0, idx));

          const changedIds = getChangedEventIds(day, snapshot, [targetId]);
          if (changedIds.length > 0) markShiftedEvents(changedIds);

          closeModal();
          renderCarousel();
          renderItinerary();
          refreshTripTravelRoutes();
          scheduleCloudSave();

          if (shiftedCount > 0) {
            showToast(`${existing ? 'Stop updated' : 'Stop added'} · ${shiftedCount} flexible stop${shiftedCount === 1 ? '' : 's'} auto-adjusted`);
          } else {
            showToast(existing ? 'Stop updated' : 'Stop added');
          }
        }
      }
    ]
  });

  // Live Interactive Modal Wiring
  const startSel = document.getElementById('evStartSlot');
  const durSel = document.getElementById('evDuration');
  const resSel = document.getElementById('evResTime');
  const fixedChk = document.getElementById('evFixedToggle');
  const catSel = document.getElementById('evCat');
  const catBadge = document.getElementById('evCatPreviewBadge');
  const previewWin = document.getElementById('evPreviewWindow');
  const previewLabel = document.getElementById('evPreviewLabel');
  const previewLock = document.getElementById('evPreviewLockBadge');

  const locInp = document.getElementById('evLocation');
  const verifyBtn = document.getElementById('evVerifyLocBtn');
  const suggestionsBox = document.getElementById('evLocationSuggestions');
  const statusEl = document.getElementById('evLocVerifyStatus');

  let suggestTimer = null;
  let suggestReqId = 0;

  function setVerifyStatus(text, tone = 'muted') {
    if (!statusEl) return;
    const toneClass = tone === 'ok'
      ? 'text-emerald-300 font-medium'
      : tone === 'warn'
        ? 'text-amber-300 font-medium'
        : tone === 'error'
          ? 'text-rose-300 font-medium'
          : 'text-white/45';
    statusEl.className = `text-[11px] leading-snug ${toneClass}`;
    statusEl.innerHTML = text;
  }

  function renderSuggestions(list) {
    if (!suggestionsBox) return;
    if (!Array.isArray(list) || list.length === 0) {
      suggestionsBox.classList.add('hidden');
      suggestionsBox.innerHTML = '';
      return;
    }

    suggestionsBox.innerHTML = list.map((item, idx) => `
      <button
        type="button"
        data-loc-sug="${idx}"
        class="w-full text-left flex items-start gap-2.5 px-3 py-2 rounded-xl hover:bg-sky-500/20 border border-transparent hover:border-sky-400/35 transition-all cursor-pointer"
      >
        <span class="text-sky-300 mt-0.5 shrink-0">${ICONS.pin}</span>
        <div class="min-w-0 flex-1">
          <div class="text-xs font-semibold text-white truncate">${esc(item.label)}</div>
          ${item.sublabel ? `<div class="text-[10px] text-white/50 truncate">${esc(item.sublabel)}</div>` : ''}
        </div>
        ${item.exactHouseMatch ? `<span class="px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/35 text-[9px] font-bold text-emerald-200 shrink-0">Exact</span>` : ''}
      </button>
    `).join('');

    suggestionsBox.classList.remove('hidden');

    suggestionsBox.querySelectorAll('[data-loc-sug]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const picked = list[Number(btn.dataset.locSug)];
        if (!picked) return;
        locInp.value = picked.label;
        verifiedLocationCoords = { lat: picked.lat, lng: picked.lng };
        suggestionsBox.classList.add('hidden');
        setVerifyStatus(`✓ Verified address selected: ${esc(picked.label)}`, 'ok');
      });
    });
  }

  locInp?.addEventListener('input', () => {
    const val = locInp.value.trim();
    verifiedLocationCoords = null;
    clearTimeout(suggestTimer);

    if (val.length < 3 || /^https?:\/\//i.test(val)) {
      suggestionsBox?.classList.add('hidden');
      setVerifyStatus('Tip: Type an address to see verified suggestions or click Verify.', 'muted');
      return;
    }

    setVerifyStatus('Searching verified addresses…', 'muted');
    const reqId = ++suggestReqId;
    suggestTimer = setTimeout(async () => {
      const results = await searchAddressSuggestions(val, day.location || '');
      if (reqId !== suggestReqId) return;
      if (results.length > 0) {
        renderSuggestions(results);
        setVerifyStatus('Select a verified match below or click Verify.', 'muted');
      } else {
        suggestionsBox?.classList.add('hidden');
        setVerifyStatus('No instant matches yet — include city & ZIP, then click Verify.', 'warn');
      }
    }, 380);
  });

  verifyBtn?.addEventListener('click', async () => {
    const val = locInp?.value.trim() || '';
    if (!val) {
      setVerifyStatus('Enter an address or place name first.', 'warn');
      return;
    }
    suggestionsBox?.classList.add('hidden');
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Checking…';
    setVerifyStatus('Verifying exact map pin…', 'muted');

    const res = await verifyAddress(val, day.location || '');
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Verify';

    if (res.verified) {
      verifiedLocationCoords = { lat: res.lat, lng: res.lng };
      const applyBtnHtml = res.formatted && res.formatted.toLowerCase() !== val.toLowerCase()
        ? ` <button id="applyFormattedAddrBtn" type="button" class="underline text-sky-300 hover:text-white ml-1 cursor-pointer">Use "${esc(res.formatted)}"</button>`
        : '';
      setVerifyStatus(`✓ ${esc(res.message)}${applyBtnHtml}`, 'ok');
      document.getElementById('applyFormattedAddrBtn')?.addEventListener('click', () => {
        locInp.value = res.formatted;
        setVerifyStatus(`✓ Verified address: ${esc(res.formatted)}`, 'ok');
      });
    } else if (res.partial) {
      verifiedLocationCoords = { lat: res.lat, lng: res.lng };
      setVerifyStatus(`⚠ ${esc(res.message)}`, 'warn');
    } else {
      verifiedLocationCoords = null;
      setVerifyStatus(`✕ ${esc(res.message)}`, 'error');
    }
  });

  function refreshModalPreview() {
    const startVal = Number(startSel.value);
    const rawDur = Number(durSel.value);
    const durVal = Number.isFinite(rawDur) && rawDur >= 0 ? rawDur : 60;
    const hasRes = resSel.value !== '';
    const isLocked = hasRes || fixedChk.checked;

    if (previewLabel) {
      previewLabel.textContent = durVal === 0 ? 'Point in Time · Milestone' : 'Scheduled Time Slot';
    }
    previewWin.textContent = formatTimeWindow(startVal, durVal);
    previewLock.textContent = hasRes ? 'Reservation · Fixed' : (isLocked ? 'Fixed Time' : 'Flexible');
    previewLock.className = `px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 border ${
      isLocked
        ? 'bg-amber-500/20 border-amber-400/45 text-amber-200'
        : 'bg-sky-500/15 border-sky-400/30 text-sky-200'
    }`;

    const catMeta = getCategoryMeta(catSel.value);
    catBadge.className = `cat-icon-badge ${catMeta.anim || ''} w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${catMeta.color}`;
    catBadge.innerHTML = ICONS[catMeta.icon] || ICONS.stop;
  }

  resSel?.addEventListener('change', () => {
    if (resSel.value !== '') {
      startSel.value = resSel.value;
      fixedChk.checked = true;
    }
    refreshModalPreview();
  });

  startSel?.addEventListener('change', () => {
    if (resSel.value !== '') {
      resSel.value = startSel.value;
    }
    refreshModalPreview();
  });

  durSel?.addEventListener('change', refreshModalPreview);

  fixedChk?.addEventListener('change', () => {
    if (!fixedChk.checked && resSel.value !== '') {
      resSel.value = '';
      showToast('Reservation time cleared — stop is now flexible');
    }
    refreshModalPreview();
  });

  catSel?.addEventListener('change', refreshModalPreview);

  document.getElementById('evQuickNewCatBtn')?.addEventListener('click', () => {
    openCustomCategoriesModal({ dayId, eventId });
  });

  refreshModalPreview();
}

/**
 * ============================================================================
 * CUSTOM ACTIVITY CATEGORIES CREATOR & MANAGER MODAL
 * ============================================================================
 */
export function openCustomCategoriesModal(returnToEventContext = null) {
  if (!Array.isArray(appStore.state.customCategories)) {
    appStore.state.customCategories = [];
  }

  let selectedIcon = 'camera';
  let selectedTheme = 'rose';
  let selectedAnim = 'cat-anim-sparkle';

  const inp = 'w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-sky-400/40';

  const renderModalContent = () => {
    const customs = appStore.state.customCategories || [];
    const existingHtml = customs.length === 0
      ? `<div class="rounded-2xl border border-dashed border-white/12 bg-black/25 p-3.5 text-center text-xs text-white/45">No custom categories yet — build your first animated category below!</div>`
      : customs.map((cat) => {
          const theme = CUSTOM_CATEGORY_THEMES[cat.theme] || CUSTOM_CATEGORY_THEMES.cyan;
          return `
            <div class="flex items-center justify-between gap-2.5 rounded-2xl bg-white/[0.04] border border-white/10 px-3 py-2">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="cat-icon-badge ${esc(cat.anim || 'cat-anim-sparkle')} w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${theme.color}">
                  ${ICONS[cat.icon] || ICONS.star}
                </span>
                <div class="min-w-0">
                  <div class="text-xs sm:text-sm font-semibold text-white truncate">${esc(cat.label)}</div>
                  <div class="text-[10px] text-white/45">${esc(theme.label)}</div>
                </div>
              </div>
              <button type="button" data-del-custom-cat="${esc(cat.id)}" title="Delete Category" class="p-1.5 rounded-lg text-white/45 hover:text-rose-300 hover:bg-rose-500/20 cursor-pointer shrink-0">
                ${ICONS.trash}
              </button>
            </div>
          `;
        }).join('');

    const iconPickerHtml = CUSTOM_CATEGORY_ICON_OPTIONS.map((opt) => `
      <button type="button" data-pick-icon="${opt.key}" title="${esc(opt.label)}" class="flex flex-col items-center justify-center gap-1 p-2 rounded-xl border text-[10px] transition-all cursor-pointer ${
        selectedIcon === opt.key
          ? 'bg-sky-500/25 border-sky-400/60 text-white shadow-md scale-[1.04]'
          : 'bg-black/30 border-white/10 text-white/65 hover:bg-white/10 hover:text-white'
      }">
        <span>${ICONS[opt.key]}</span>
        <span class="truncate max-w-full">${esc(opt.label.split(' ')[0])}</span>
      </button>
    `).join('');

    const themePickerHtml = Object.entries(CUSTOM_CATEGORY_THEMES).map(([k, t]) => `
      <button type="button" data-pick-theme="${k}" class="px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${t.color} ${
        selectedTheme === k ? 'ring-2 ring-white/80 scale-[1.04]' : 'opacity-70 hover:opacity-100'
      }">${esc(t.label)}</button>
    `).join('');

    const animOptionsHtml = CUSTOM_CATEGORY_ANIM_OPTIONS
      .map((a) => `<option value="${a.key}" class="bg-slate-900" ${selectedAnim === a.key ? 'selected' : ''}>${esc(a.label)}</option>`)
      .join('');

    openModal({
      title: 'Custom Activity Categories',
      bodyHtml: `
        <div class="space-y-4">
          <div class="rounded-2xl bg-black/35 border border-white/15 p-3.5 flex items-center gap-3.5">
            <span id="customCatLiveIcon" class="cat-icon-badge ${selectedAnim} w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${(CUSTOM_CATEGORY_THEMES[selectedTheme] || CUSTOM_CATEGORY_THEMES.rose).color}">
              ${ICONS[selectedIcon]}
            </span>
            <div class="min-w-0 flex-1">
              <div class="text-[10px] font-bold uppercase tracking-widest text-sky-300">Live Category Preview</div>
              <div id="customCatLiveName" class="text-sm font-bold text-white truncate mt-0.5">Coffee &amp; Bakery</div>
              <div class="text-[11px] text-white/50">Shows live animation right inside your timeline</div>
            </div>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-xs font-semibold text-white/65 mb-1">Category Name</label>
              <input id="newCatName" placeholder="e.g. Coffee Stop, Photo Spot, Beach Time, Kids Play" class="${inp}" />
            </div>

            <div>
              <label class="block text-xs font-semibold text-white/65 mb-1.5">Pick an Icon</label>
              <div id="catIconGrid" class="grid grid-cols-4 sm:grid-cols-6 gap-1.5">${iconPickerHtml}</div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-white/65 mb-1.5">Glow Color Theme</label>
              <div id="catThemeRow" class="flex flex-wrap gap-1.5">${themePickerHtml}</div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-white/65 mb-1">Live Icon Animation</label>
              <select id="newCatAnim" class="${inp}">${animOptionsHtml}</select>
            </div>
          </div>

          <div class="pt-2 border-t border-white/10 space-y-2">
            <div class="text-[11px] font-bold uppercase tracking-wider text-white/50">Your Saved Custom Categories (${customs.length})</div>
            <div class="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">${existingHtml}</div>
          </div>
        </div>
      `,
      footerButtons: [
        {
          label: returnToEventContext ? 'Back to Stop' : 'Done',
          onClick: () => {
            closeModal();
            if (returnToEventContext) {
              openEventModal(returnToEventContext.dayId, returnToEventContext.eventId);
            }
          }
        },
        {
          label: '+ Create Category',
          variant: 'primary',
          onClick: () => {
            const label = document.getElementById('newCatName').value.trim();
            if (!label) return showToast('Please enter a category name', 'error');
            const newId = uid('cat');
            appStore.state.customCategories.push({
              id: newId,
              label,
              icon: selectedIcon,
              theme: selectedTheme,
              anim: selectedAnim
            });
            scheduleCloudSave();
            renderItinerary();
            showToast(`Created "${label}" category!`);
            if (returnToEventContext) {
              closeModal();
              openEventModal(returnToEventContext.dayId, returnToEventContext.eventId, newId);
            } else {
              renderModalContent();
            }
          }
        }
      ]
    });

    const nameInp = document.getElementById('newCatName');
    const animSel = document.getElementById('newCatAnim');
    const liveIcon = document.getElementById('customCatLiveIcon');
    const liveName = document.getElementById('customCatLiveName');

    const updateLivePreview = () => {
      const theme = CUSTOM_CATEGORY_THEMES[selectedTheme] || CUSTOM_CATEGORY_THEMES.rose;
      liveIcon.className = `cat-icon-badge ${selectedAnim} w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${theme.color}`;
      liveIcon.innerHTML = ICONS[selectedIcon] || ICONS.star;
      liveName.textContent = nameInp.value.trim() || 'Coffee & Bakery';
    };

    nameInp?.addEventListener('input', updateLivePreview);
    animSel?.addEventListener('change', () => {
      selectedAnim = animSel.value;
      updateLivePreview();
    });

    document.querySelectorAll('[data-pick-icon]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedIcon = btn.dataset.pickIcon;
        document.querySelectorAll('[data-pick-icon]').forEach((b) => {
          const active = b.dataset.pickIcon === selectedIcon;
          b.className = `flex flex-col items-center justify-center gap-1 p-2 rounded-xl border text-[10px] transition-all cursor-pointer ${
            active
              ? 'bg-sky-500/25 border-sky-400/60 text-white shadow-md scale-[1.04]'
              : 'bg-black/30 border-white/10 text-white/65 hover:bg-white/10 hover:text-white'
          }`;
        });
        updateLivePreview();
      });
    });

    document.querySelectorAll('[data-pick-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedTheme = btn.dataset.pickTheme;
        document.querySelectorAll('[data-pick-theme]').forEach((b) => {
          const key = b.dataset.pickTheme;
          const t = CUSTOM_CATEGORY_THEMES[key];
          const active = key === selectedTheme;
          b.className = `px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${t.color} ${
            active ? 'ring-2 ring-white/80 scale-[1.04]' : 'opacity-70 hover:opacity-100'
          }`;
        });
        updateLivePreview();
      });
    });

    document.querySelectorAll('[data-del-custom-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const delId = btn.dataset.delCustomCat;
        appStore.state.customCategories = appStore.state.customCategories.filter((c) => c.id !== delId);
        appStore.state.days.forEach((d) => {
          (d.events || []).forEach((ev) => {
            if (ev.category === delId) ev.category = 'stop';
          });
        });
        scheduleCloudSave();
        renderItinerary();
        showToast('Custom category removed');
        renderModalContent();
      });
    });
  };

  renderModalContent();
}

/**
 * ============================================================================
 * COPY ACTIVITY TO ANOTHER DAY MODAL
 * ============================================================================
 */
export function openCopyToDayModal(sourceDayId, eventId) {
  const days = appStore.state.days;
  const sourceDay = days.find((d) => d.id === sourceDayId);
  const ev = sourceDay?.events.find((e) => e.id === eventId);
  if (!sourceDay || !ev) return;

  const targetDays = days.filter((d) => d.id !== sourceDayId);
  if (targetDays.length === 0) {
    return showToast('Add another day first to copy this activity across days', 'error');
  }

  let selectedTargetDayId = targetDays[0].id;

  const dayCardsHtml = targetDays.map((d) => `
    <button
      type="button"
      data-copy-target-day="${esc(d.id)}"
      class="w-full text-left rounded-2xl border p-3.5 transition-all cursor-pointer ${
        d.id === selectedTargetDayId
          ? 'bg-gradient-to-r from-orange-500/20 to-sky-500/20 border-sky-400/55 shadow-md'
          : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/12'
      }"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="text-xs sm:text-sm font-semibold text-white truncate">${esc(d.title)}</div>
          <div class="text-[11px] text-white/55 truncate mt-0.5">${esc(d.location || '')} · ${d.events.length} stops</div>
        </div>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/35 border border-white/15 text-sky-200 shrink-0">${esc(d.shortDay)}</span>
      </div>
    </button>
  `).join('');

  openModal({
    title: 'Copy Activity to Another Day',
    bodyHtml: `
      <div class="space-y-4">
        <div class="rounded-2xl bg-black/35 border border-white/12 p-3.5">
          <div class="text-[10px] font-bold uppercase tracking-widest text-orange-300">Activity to Copy</div>
          <div class="text-xs font-bold text-white/80 mt-1">${esc(ev.time)}</div>
          <p class="text-xs sm:text-sm text-white/90 mt-0.5 line-clamp-2">${esc(ev.text)}</p>
        </div>

        <div class="space-y-2">
          <label class="block text-xs font-semibold text-white/65">Choose Destination Day</label>
          <div class="space-y-2 max-h-56 overflow-y-auto pr-0.5">${dayCardsHtml}</div>
        </div>

        <label class="flex items-start gap-2.5 cursor-pointer select-none">
          <input id="copyKeepFixedChk" type="checkbox" ${ev.isFixed ? 'checked' : ''} class="mt-0.5 w-4 h-4 rounded accent-amber-400 cursor-pointer" />
          <div class="text-xs">
            <span class="font-semibold text-white">Keep exact Fixed / Reservation Time (${esc(formatMinutesTo12h(ev.startMinutes))})</span>
            <p class="text-[11px] text-white/50 mt-0.5">Unchecked will automatically fit it into the next open slot on that day.</p>
          </div>
        </label>
      </div>
    `,
    footerButtons: [
      { label: 'Cancel', onClick: closeModal },
      {
        label: 'Copy to Day',
        variant: 'primary',
        onClick: () => {
          const targetDay = days.find((d) => d.id === selectedTargetDayId);
          if (!targetDay) return;
          const keepFixed = Boolean(document.getElementById('copyKeepFixedChk')?.checked);
          const cloned = copyEventToDay(sourceDay, targetDay, eventId, uid('ev'), keepFixed);
          if (cloned) {
            markShiftedEvents([cloned.id]);
            closeModal();
            renderCarousel();
            renderItinerary();
            refreshTripTravelRoutes();
            scheduleCloudSave();
            showToast(`Copied to ${targetDay.shortDay} · ${targetDay.shortDate || targetDay.location}`);
          }
        }
      }
    ]
  });

  document.querySelectorAll('[data-copy-target-day]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedTargetDayId = btn.dataset.copyTargetDay;
      document.querySelectorAll('[data-copy-target-day]').forEach((b) => {
        const active = b.dataset.copyTargetDay === selectedTargetDayId;
        b.className = `w-full text-left rounded-2xl border p-3.5 transition-all cursor-pointer ${
          active
            ? 'bg-gradient-to-r from-orange-500/20 to-sky-500/20 border-sky-400/55 shadow-md'
            : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/12'
        }`;
      });
    });
  });
}

/**
 * ============================================================================
 * TIMELINE QUICK ACTIONS & DRAG-AND-DROP MUTATION HANDLERS
 * ============================================================================
 */

export function deleteEvent(dayId, eventId) {
  const day = appStore.state.days.find((d) => d.id === dayId);
  const ev = day?.events.find((e) => e.id === eventId);
  if (!day || !ev) return;
  openConfirmDeleteModal({
    title: 'Delete Itinerary Stop',
    itemName: `${ev.time} · ${ev.text}`,
    detail: 'Do you want to remove this stop from the schedule?',
    onConfirm: () => {
      day.events = day.events.filter((e) => e.id !== eventId);
      renderCarousel();
      renderItinerary();
      refreshTripTravelRoutes();
      scheduleCloudSave();
      showToast('Stop removed');
    }
  });
}

export function moveEvent(dayId, eventId, dir) {
  const day = appStore.state.days.find((d) => d.id === dayId);
  if (!day) return;
  const idx = day.events.findIndex((e) => e.id === eventId);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= day.events.length) return;
  handleDragReorderEvent(dayId, eventId, target);
}

export function handleDragReorderEvent(dayId, eventId, targetIndex) {
  const day = appStore.state.days.find((d) => d.id === dayId);
  if (!day) return;
  const snapshot = captureStartSnapshot(day);
  const res = reorderEventInDay(day, eventId, targetIndex);
  if (!res.moved) return;

  const changedIds = getChangedEventIds(day, snapshot, [eventId]);
  markShiftedEvents(changedIds);
  renderItinerary();
  refreshTripTravelRoutes();
  scheduleCloudSave();

  if (res.shiftedCount > 0) {
    showToast(`Moved stop · ${res.shiftedCount} flexible stop${res.shiftedCount === 1 ? '' : 's'} auto-adjusted`);
  } else {
    showToast(`Moved to ${res.event.time}`);
  }
}

export function handleDragMoveToTimeSlot(dayId, eventId, newStartMinutes) {
  const day = appStore.state.days.find((d) => d.id === dayId);
  if (!day) return;
  const snapshot = captureStartSnapshot(day);
  const res = moveEventToTimeSlot(day, eventId, newStartMinutes);
  if (!res.moved) return;

  const changedIds = getChangedEventIds(day, snapshot, [eventId]);
  markShiftedEvents(changedIds);
  renderItinerary();
  refreshTripTravelRoutes();
  scheduleCloudSave();

  const label = formatMinutesTo12h(res.event.startMinutes);
  if (res.shiftedCount > 0) {
    showToast(`Rescheduled to ${label} · ${res.shiftedCount} flexible stop${res.shiftedCount === 1 ? '' : 's'} shifted`);
  } else {
    showToast(`Rescheduled to ${label}`);
  }
}

export function handleDragMoveAcrossDays(sourceDayId, targetDayId, eventId, targetIndex = null) {
  const sourceDay = appStore.state.days.find((d) => d.id === sourceDayId);
  const targetDay = appStore.state.days.find((d) => d.id === targetDayId);
  if (!sourceDay || !targetDay || sourceDay.id === targetDay.id) return;

  const snapshot = captureStartSnapshot(targetDay);
  const res = moveEventAcrossDays(sourceDay, targetDay, eventId, targetIndex);
  if (!res.moved) return;

  const changedIds = getChangedEventIds(targetDay, snapshot, [eventId]);
  markShiftedEvents(changedIds);
  renderCarousel();
  renderForecastStrip();
  renderItinerary();
  refreshTripTravelRoutes();
  scheduleCloudSave();

  showToast(`Moved to ${targetDay.shortDay} (${res.event.time})${res.shiftedCount > 0 ? ` · ${res.shiftedCount} shifted` : ''}`);
}

export function duplicateEvent(dayId, eventId) {
  const day = appStore.state.days.find((d) => d.id === dayId);
  if (!day) return;
  const snapshot = captureStartSnapshot(day);
  const res = duplicateEventInDay(day, eventId, uid('ev'));
  if (!res) return;

  const changedIds = getChangedEventIds(day, snapshot, [res.copy.id]);
  markShiftedEvents(changedIds);
  renderCarousel();
  renderItinerary();
  refreshTripTravelRoutes();
  scheduleCloudSave();

  showToast(`Duplicated stop (${res.copy.time})${res.shiftedCount > 0 ? ` · ${res.shiftedCount} shifted` : ''}`);
}

export function toggleEventCompleted(dayId, eventId) {
  const day = appStore.state.days.find((d) => d.id === dayId);
  const ev = day?.events.find((e) => e.id === eventId);
  if (!ev) return;
  ev.completed = !ev.completed;
  if (ev.completed) {
    appStore.justCompletedEventId = ev.id;
    setTimeout(() => {
      if (appStore.justCompletedEventId === ev.id) appStore.justCompletedEventId = null;
    }, 700);
  }
  renderItinerary();
  scheduleCloudSave();
  showToast(ev.completed ? 'Activity marked completed!' : 'Activity marked active');
}

export function toggleEventFixed(dayId, eventId) {
  const day = appStore.state.days.find((d) => d.id === dayId);
  const ev = day?.events.find((e) => e.id === eventId);
  if (!ev) return;

  if (ev.isFixed) {
    ev.isFixed = false;
    ev.reservationMinutes = null;
    showToast('Unlocked — activity is now flexible');
  } else {
    ev.isFixed = true;
    showToast(`Locked as Fixed Time (${formatMinutesTo12h(ev.startMinutes)})`);
  }
  renderItinerary();
  scheduleCloudSave();
}

export function toggleEventTravelMode(dayId, eventId, currentRenderedMode = 'driving') {
  const day = appStore.state.days.find((d) => d.id === dayId);
  const ev = day?.events.find((e) => e.id === eventId);
  if (!ev) return;

  const nextMode = currentRenderedMode === 'walking' ? 'drive' : 'walk';
  ev.travelMode = nextMode;
  renderItinerary();
  refreshTripTravelRoutes();
  scheduleCloudSave();
  showToast(`Switched leg to ${nextMode === 'walk' ? 'Walking' : 'Driving'} route`);
}

export function handleAutoFitDay(dayId) {
  const day = appStore.state.days.find((d) => d.id === dayId);
  if (!day) return;
  const snapshot = captureStartSnapshot(day);
  const changes = autoFitDaySchedule(day);
  const changedIds = getChangedEventIds(day, snapshot);
  if (changedIds.length > 0) markShiftedEvents(changedIds);

  renderItinerary();
  refreshTripTravelRoutes();
  scheduleCloudSave();

  if (changes > 0) {
    showToast(`Auto-fitted ${changes} flexible stop${changes === 1 ? '' : 's'} around Fixed Times & travel!`);
  } else {
    showToast('Schedule is already cleanly spaced (Fixed Times remain locked)');
  }
}

/**
 * Reset Current Trip Confirmation
 */
export function confirmResetPlanner() {
  const state = appStore.state;
  const isOriginal = state.id === 'trip-thanksgiving-default';
  openConfirmDeleteModal({
    title: 'Reset Current Trip',
    itemName: isOriginal ? 'Restore Default Thanksgiving Trip' : `Reset "${state.meta.title}"`,
    detail: 'This will restore the default itinerary, reservations, checklist, budget, and clear notes for the active trip (your other saved trips remain safe).',
    confirmLabel: 'Yes, Reset Trip',
    onConfirm: () => {
      const firstDay = state.days[0];
      const fresh = isOriginal
        ? createInitialState()
        : createNewDefaultTrip({
            title: state.meta.title,
            startLocation: firstDay?.location || 'San Diego, CA',
            startLocationFullName: firstDay?.locationFullName || firstDay?.location || 'San Diego, California, United States',
            startLocationCoords: firstDay?.locationCoords || { lat: 32.7157, lng: -117.1611 }
          });
      fresh.id = state.id;
      const idx = appStore.trips.findIndex((t) => t.id === appStore.activeTripId);
      if (idx >= 0) appStore.trips[idx] = fresh;
      syncActiveTripRef();
      appStore.activeCarouselIndex = 0;
      appStore.showAllDays = false;
      appStore.vaultTypeFilter = 'all';
      appStore.vaultStatusFilter = 'all';
      const track = document.getElementById('carouselTrack');
      if (track) track.dataset.dayIds = '';
      updateBackdropForDay(appStore.state.days[0]);
      renderAll();
      prefetchAllDaysWeather();
      prefetchAllCardPhotos();
      refreshTripTravelRoutes();
      scheduleCloudSave();
      showToast('Current trip reset to default');
    }
  });
}