import {
  ICONS,
  LINK_ICON_META,
  CUSTOM_CATEGORY_THEMES,
  CUSTOM_CATEGORY_ICON_KEYS,
  BUDGET_CATEGORY_META,
  appStore,
  uid,
  esc,
  getAllCategories,
  getCategoryMeta,
  inferBudgetCategory,
  getItemFinalCost,
  formatTimeRange,
  formatDurationLabel,
  formatMinutesTo12h,
  formatMinutesToInput,
  parseInputTimeToMinutes,
  ensureEventTimeFields,
  markRippledEvents,
  getLegTravelInfo,
  prefetchRoutesForDay,
  prefetchRoutesForTrip,
  rippleAdjustDay,
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
  syncLiveWeatherForActiveDay,
  prefetchAllDaysWeather,
  renderHero,
  renderForecastStrip,
  renderCarousel
} from './trip-planner.js';

import {
  renderItinerary,
  renderChecklist,
  renderBudget,
  updateBudgetTotals,
  renderLinks,
  renderAll
} from './trip-planner-detail.js';

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
        startLocation: 'San Diego'
      }
    : {
        title: state.meta.title,
        subtitle: state.meta.subtitle,
        tripLength: state.meta.tripLength,
        firstDeparture: state.meta.firstDeparture,
        hotelPlan: state.meta.hotelPlan,
        startLocation: state.days[0]?.location || ''
      };

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
            <div>
              <label class="block text-xs font-semibold text-sky-300/90 mb-1">Starting Destination (Day 1 Live Weather &amp; Backdrop)</label>
              <input id="hLoc" placeholder="e.g. San Diego, Big Bear, Santa Barbara, Tokyo" class="${inp} border-sky-400/30" value="${esc(defaults.startLocation)}" />
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
        onClick: () => {
          const title = document.getElementById('hTitle').value.trim();
          if (!title) return showToast('Please enter a trip title', 'error');
          const subtitle = document.getElementById('hSub').value.trim();
          const tripLength = document.getElementById('hLen').value.trim() || defaults.tripLength;
          const firstDeparture = document.getElementById('hDep').value.trim() || defaults.firstDeparture;
          const hotelPlan = document.getElementById('hHotel').value.trim() || defaults.hotelPlan;

          if (isCreate) {
            const startLocation = document.getElementById('hLoc')?.value.trim() || 'San Diego';
            const newTrip = createNewDefaultTrip({
              title,
              subtitle,
              tripLength,
              firstDeparture,
              hotelPlan,
              startLocation
            });
            appStore.trips.push(newTrip);
            closeModal();
            switchToTrip(newTrip.id, true);
            showToast(`Created "${title}"!`);
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
        <p class="text-xs text-white/60">Select any previous or active trip to open its itinerary, checklist, budget, and backdrop.</p>
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
        detail: 'This will permanently remove this trip and all of its days, budget, and notes.',
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
            <input id="bEst" type="number" inputmode="decimal" min="0" step="0.01" value="${existing ? (Number(existing.estimated) || 0) : 100}" class="${inp}" />
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
              <input id="bNewEntryAmount" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" class="w-full rounded-xl border border-sky-400/25 bg-sky-500/10 pl-6 pr-2 py-2 text-xs font-semibold text-right text-sky-100 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-sky-400/50 tabular-nums" />
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
 * Add or Edit Trip Day Modal (with Scene Presets & Custom Photo Links)
 */
export function openDayModal(dayId = null) {
  const state = appStore.state;
  const existing = dayId ? state.days.find((d) => d.id === dayId) : null;
  const inp = 'w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-400/40';
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

  openModal({
    title: existing ? 'Edit Day Details' : 'Add New Day',
    bodyHtml: `
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-2.5">
          <div><label class="block text-xs font-semibold text-white/60 mb-1">Day Code</label><input id="dShort" placeholder="TUE" class="${inp}" value="${esc(existing ? existing.shortDay : `DAY ${state.days.length + 1}`)}" /></div>
          <div><label class="block text-xs font-semibold text-white/60 mb-1">Date</label><input id="dDate" placeholder="Dec 1" class="${inp}" value="${esc(existing ? existing.shortDate : '')}" /></div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div><label class="block text-xs font-semibold text-white/60 mb-1">Location (Live Temp)</label><input id="dLoc" placeholder="e.g. Palm Springs, Big Bear" class="${inp}" value="${esc(existing ? existing.location : '')}" /></div>
          <div><label class="block text-xs font-semibold text-white/60 mb-1">Landscape &amp; 3D Scene</label><select id="dScene" class="${inp}">${sceneOptions}</select></div>
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
        onClick: () => {
          const title = document.getElementById('dTitle').value.trim();
          if (!title) return showToast('Please enter a day title', 'error');
          const selectedScene = document.getElementById('dScene').value;
          const customCardUrl = document.getElementById('dCustomCardUrl')?.value.trim() || '';
          const customBgUrl = document.getElementById('dCustomBgUrl')?.value.trim() || '';

          if (selectedScene === 'custom' && !customCardUrl && !customBgUrl) {
            return showToast('Please paste at least one custom photo link', 'error');
          }

          const locVal = document.getElementById('dLoc').value.trim() || 'California';
          const payload = {
            shortDay: document.getElementById('dShort').value.trim() || `DAY ${state.days.length + 1}`,
            shortDate: document.getElementById('dDate').value.trim(),
            location: locVal,
            landmark: locVal,
            cardLandmark: `${locVal} sightseeing`,
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
            Object.assign(existing, payload);
            showToast('Day updated & syncing live temperature...');
          } else {
            state.days.push({ id: uid('day'), temp: '--°F', ...payload, events: [] });
            appStore.activeCarouselIndex = state.days.length - 1;
            showToast('New day added & syncing live temperature...');
          }
          closeModal();
          updateBackdropForDay(state.days[appStore.activeCarouselIndex]);
          prefetchCardPhotoForDay(state.days[appStore.activeCarouselIndex]).then(() => renderCarousel());
          renderForecastStrip();
          renderCarousel();
          renderItinerary();
          syncLiveWeatherForActiveDay();
          scheduleCloudSave();
        }
      }
    ]
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
 * Upgraded Add or Edit Itinerary Stop Modal
 * (Start Time, Duration Chips, Fixed Time Lock, Custom Categories & Travel Mode)
 */
export function openEventModal(dayId, eventId = null, presetStartMin = null) {
  const day = appStore.state.days.find((d) => d.id === dayId);
  if (!day) return;
  const existing = eventId ? day.events.find((e) => e.id === eventId) : null;
  if (existing) ensureEventTimeFields(existing);

  // Suggest smart default start time if adding a new stop
  let defaultStartMin = 9 * 60;
  if (existing) {
    defaultStartMin = existing.startMin;
  } else if (Number.isFinite(presetStartMin)) {
    defaultStartMin = presetStartMin;
  } else if (day.events.length > 0) {
    const last = day.events[day.events.length - 1];
    ensureEventTimeFields(last);
    defaultStartMin = Math.min(22 * 60 + 30, last.startMin + last.durationMin + 15);
  }

  let currentDuration = existing ? existing.durationMin : 60;
  let isFixed = existing ? Boolean(existing.fixedTime) : false;
  let travelMode = existing?.travelMode === 'walk' ? 'walk' : 'drive';

  const inp = 'w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-400/40';
  const allCats = getAllCategories();
  const selectedCat = existing?.category && allCats[existing.category] ? existing.category : 'stop';
  const catOptions = Object.entries(allCats)
    .map(([k, v]) => `<option value="${esc(k)}" class="bg-slate-900" ${selectedCat === k ? 'selected' : ''}>${esc(v.label)}${v.builtin ? '' : ' ★'}</option>`)
    .join('');

  const durPresets = [15, 30, 45, 60, 90, 120, 180];

  openModal({
    title: existing ? 'Edit Itinerary Stop' : 'Add Itinerary Stop',
    bodyHtml: `
      <div class="space-y-4">
        <!-- Smart Time Window & Live Preview -->
        <div class="rounded-2xl border border-white/12 bg-black/35 p-3.5 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-[10px] font-bold uppercase tracking-widest text-sky-300">Schedule Timing</span>
            <span id="evTimePreview" class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/20 border border-orange-400/35 text-orange-200 tabular-nums">
              ${esc(formatTimeRange(defaultStartMin, currentDuration))} (${formatDurationLabel(currentDuration)})
            </span>
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="block text-xs font-semibold text-white/60 mb-1">Start Time</label>
              <input id="evStartTime" type="time" class="${inp}" value="${formatMinutesToInput(defaultStartMin)}" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-white/60 mb-1">Duration (minutes)</label>
              <input id="evDuration" type="number" inputmode="numeric" min="10" max="720" step="5" class="${inp} tabular-nums" value="${currentDuration}" />
            </div>
          </div>

          <!-- Quick Duration Chips -->
          <div class="flex flex-wrap items-center gap-1.5">
            ${durPresets.map((m) => `
              <button
                type="button"
                data-dur-chip="${m}"
                class="px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                  currentDuration === m
                    ? 'bg-sky-500/25 border-sky-400/50 text-sky-200'
                    : 'bg-white/[0.05] hover:bg-white/15 border-white/10 text-white/65 hover:text-white'
                }"
              >${formatDurationLabel(m)}</button>
            `).join('')}
          </div>

          <!-- Fixed Time Lock Toggle -->
          <button
            id="evFixedToggleBtn"
            type="button"
            class="w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all cursor-pointer ${
              isFixed
                ? 'bg-amber-500/15 border-amber-400/45 text-amber-100'
                : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-white/80'
            }"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span id="evFixedIcon" class="${isFixed ? 'text-amber-300' : 'text-white/50'} shrink-0">${isFixed ? ICONS.lock : ICONS.unlock}</span>
              <div class="min-w-0">
                <div id="evFixedTitle" class="text-xs font-semibold">${isFixed ? 'Fixed Time (Locked)' : 'Flexible Time (Auto-Adjusts)'}</div>
                <div class="text-[11px] text-white/50">Lock reservations or timed tickets so they never shift automatically.</div>
              </div>
            </div>
            <span id="evFixedPill" class="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
              isFixed ? 'bg-amber-400/25 text-amber-200' : 'bg-white/10 text-white/55'
            }">${isFixed ? 'LOCKED' : 'FLEX'}</span>
          </button>
        </div>

        <!-- Category & Travel Mode -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-semibold text-white/60">Category</label>
              <button id="evManageCatsLink" type="button" class="text-[11px] font-semibold text-sky-300 hover:text-sky-200 cursor-pointer">+ Custom</button>
            </div>
            <select id="evCat" class="${inp}">${catOptions}</select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-white/60 mb-1">Travel Mode to Stop</label>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" data-ev-mode="drive" class="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                travelMode === 'drive' ? 'bg-sky-500/25 border-sky-400/50 text-sky-100' : 'bg-black/35 border-white/10 text-white/60 hover:text-white'
              }">${ICONS.drive}<span>Drive</span></button>
              <button type="button" data-ev-mode="walk" class="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                travelMode === 'walk' ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-100' : 'bg-black/35 border-white/10 text-white/60 hover:text-white'
              }">${ICONS.walk}<span>Walk</span></button>
            </div>
          </div>
        </div>

        <!-- Location -->
        <div>
          <label class="block text-xs font-semibold text-sky-300/90 mb-1">Location <span class="text-white/40 font-normal">(Maps Link + Auto Travel Time &amp; Distance)</span></label>
          <input id="evLocation" placeholder="e.g. The Mission Inn, Riverside, CA or paste a Maps link" class="${inp} border-sky-400/25" value="${esc(existing ? (existing.location || '') : '')}" />
        </div>

        <!-- Activity Details -->
        <div>
          <label class="block text-xs font-semibold text-white/60 mb-1">Activity Details</label>
          <textarea id="evText" rows="3" placeholder="Describe the stop, restaurant, reservation, or activity..." class="${inp}">${esc(existing ? existing.text : '')}</textarea>
        </div>
      </div>
    `,
    footerButtons: [
      { label: 'Cancel', onClick: closeModal },
      {
        label: existing ? 'Save Stop' : 'Add Stop',
        variant: 'primary',
        onClick: () => {
          const text = document.getElementById('evText').value.trim();
          if (!text) return showToast('Please enter activity details', 'error');

          const startMin = parseInputTimeToMinutes(document.getElementById('evStartTime').value, defaultStartMin);
          const durationMin = Math.max(10, Math.min(720, Math.round(Number(document.getElementById('evDuration').value) || 60)));
          const time = formatTimeRange(startMin, durationMin);
          const category = document.getElementById('evCat').value;
          const location = document.getElementById('evLocation').value.trim();

          let targetIdx = -1;
          let targetId = '';

          if (existing) {
            const locChanged = (existing.location || '').trim() !== location;
            const modeChanged = (existing.travelMode || 'drive') !== travelMode;
            existing.startMin = startMin;
            existing.durationMin = durationMin;
            existing.time = time;
            existing.fixedTime = isFixed;
            existing.category = category;
            existing.location = location;
            existing.travelMode = travelMode;
            if (locChanged || modeChanged) {
              existing.travelFromPrevMin = null;
              existing.travelFromPrevMiles = null;
            }
            targetIdx = day.events.findIndex((e) => e.id === existing.id);
            targetId = existing.id;
            showToast('Stop updated');
          } else {
            const newEv = {
              id: uid('ev'),
              time,
              startMin,
              durationMin,
              fixedTime: isFixed,
              completed: false,
              category,
              location,
              travelMode,
              travelFromPrevMin: null,
              travelFromPrevMiles: null,
              text
            };

            // Insert chronologically when created on a Time Slot, otherwise append cleanly
            if (Number.isFinite(presetStartMin)) {
              let insertIdx = day.events.findIndex((e) => {
                ensureEventTimeFields(e);
                return e.startMin > startMin;
              });
              if (insertIdx === -1) insertIdx = day.events.length;
              day.events.splice(insertIdx, 0, newEv);
              targetIdx = insertIdx;
            } else {
              day.events.push(newEv);
              targetIdx = day.events.length - 1;
            }
            targetId = newEv.id;
            showToast('Stop added');
          }

          if (appStore.autoAdjustTimes && targetIdx >= 0) {
            const rippled = rippleAdjustDay(day, targetIdx + 1);
            if (rippled.length > 0) markRippledEvents([targetId, ...rippled]);
          }

          closeModal();
          renderCarousel();
          renderItinerary();
          prefetchRoutesForDay(day);
          scheduleCloudSave();
        }
      }
    ]
  });

  // Live Interactive Modal Bindings
  const startInp = document.getElementById('evStartTime');
  const durInp = document.getElementById('evDuration');
  const previewEl = document.getElementById('evTimePreview');
  const fixedBtn = document.getElementById('evFixedToggleBtn');

  const syncTimePreview = () => {
    const sMin = parseInputTimeToMinutes(startInp.value, defaultStartMin);
    const dMin = Math.max(10, Math.min(720, Math.round(Number(durInp.value) || 60)));
    if (previewEl) previewEl.textContent = `${formatTimeRange(sMin, dMin)} (${formatDurationLabel(dMin)})`;
    document.querySelectorAll('[data-dur-chip]').forEach((chip) => {
      const active = Number(chip.dataset.durChip) === dMin;
      chip.className = `px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
        active
          ? 'bg-sky-500/25 border-sky-400/50 text-sky-200'
          : 'bg-white/[0.05] hover:bg-white/15 border-white/10 text-white/65 hover:text-white'
      }`;
    });
  };

  startInp?.addEventListener('input', syncTimePreview);
  durInp?.addEventListener('input', syncTimePreview);

  document.querySelectorAll('[data-dur-chip]').forEach((chip) => {
    chip.addEventListener('click', () => {
      currentDuration = Number(chip.dataset.durChip);
      if (durInp) durInp.value = String(currentDuration);
      syncTimePreview();
    });
  });

  fixedBtn?.addEventListener('click', () => {
    isFixed = !isFixed;
    fixedBtn.className = `w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all cursor-pointer ${
      isFixed
        ? 'bg-amber-500/15 border-amber-400/45 text-amber-100'
        : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-white/80'
    }`;
    const iconEl = document.getElementById('evFixedIcon');
    const titleEl = document.getElementById('evFixedTitle');
    const pillEl = document.getElementById('evFixedPill');
    if (iconEl) {
      iconEl.className = `${isFixed ? 'text-amber-300' : 'text-white/50'} shrink-0`;
      iconEl.innerHTML = isFixed ? ICONS.lock : ICONS.unlock;
    }
    if (titleEl) titleEl.textContent = isFixed ? 'Fixed Time (Locked)' : 'Flexible Time (Auto-Adjusts)';
    if (pillEl) {
      pillEl.className = `px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
        isFixed ? 'bg-amber-400/25 text-amber-200' : 'bg-white/10 text-white/55'
      }`;
      pillEl.textContent = isFixed ? 'LOCKED' : 'FLEX';
    }
  });

  document.querySelectorAll('[data-ev-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      travelMode = btn.dataset.evMode;
      document.querySelectorAll('[data-ev-mode]').forEach((b) => {
        const isDrive = b.dataset.evMode === 'drive';
        const active = b.dataset.evMode === travelMode;
        b.className = `flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
          active
            ? (isDrive ? 'bg-sky-500/25 border-sky-400/50 text-sky-100' : 'bg-emerald-500/25 border-emerald-400/50 text-emerald-100')
            : 'bg-black/35 border-white/10 text-white/60 hover:text-white'
        }`;
      });
    });
  });

  document.getElementById('evManageCatsLink')?.addEventListener('click', () => {
    openCustomCategoriesModal(() => openEventModal(dayId, eventId, presetStartMin));
  });
}

/**
 * Copy Activity to Another Day Modal
 */
export function openCopyEventModal(sourceDayId, eventId) {
  const days = appStore.state.days;
  const sourceDay = days.find((d) => d.id === sourceDayId);
  const srcEvent = sourceDay?.events.find((e) => e.id === eventId);
  if (!sourceDay || !srcEvent) return;
  ensureEventTimeFields(srcEvent);

  const inp = 'w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-400/40';
  const defaultTargetDay = days.find((d) => d.id !== sourceDayId) || sourceDay;
  const dayOptions = days.map((d, idx) => `
    <option value="${esc(d.id)}" class="bg-slate-900" ${d.id === defaultTargetDay.id ? 'selected' : ''}>
      ${esc(d.title || `Day ${idx + 1}`)}${d.location ? ` · ${esc(d.location)}` : ''}${d.id === sourceDayId ? ' (Current Day)' : ''}
    </option>
  `).join('');

  let timingMode = 'append';

  openModal({
    title: 'Copy Activity to Another Day',
    bodyHtml: `
      <div class="space-y-4">
        <div class="rounded-2xl border border-white/12 bg-white/[0.04] p-3.5 space-y-1">
          <div class="text-[10px] font-bold uppercase tracking-wider text-orange-300">${esc(srcEvent.time)} · ${formatDurationLabel(srcEvent.durationMin)}</div>
          <p class="text-sm font-medium text-white">${esc(srcEvent.text)}</p>
          ${srcEvent.location ? `<p class="text-xs text-sky-300/85">${esc(srcEvent.location)}</p>` : ''}
        </div>

        <div>
          <label class="block text-xs font-semibold text-white/60 mb-1">Destination Day</label>
          <select id="copyTargetDay" class="${inp}">${dayOptions}</select>
        </div>

        <div class="space-y-2">
          <label class="block text-xs font-semibold text-white/60">Placement Timing</label>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" data-copy-timing="append" class="py-2 px-3 rounded-xl border text-xs font-semibold bg-sky-500/25 border-sky-400/50 text-sky-100 cursor-pointer">
              Auto-Fit at End
            </button>
            <button type="button" data-copy-timing="keep" class="py-2 px-3 rounded-xl border text-xs font-semibold bg-black/35 border-white/10 text-white/65 hover:text-white cursor-pointer">
              Keep Original Time
            </button>
          </div>
        </div>
      </div>
    `,
    footerButtons: [
      { label: 'Cancel', onClick: closeModal },
      {
        label: 'Copy Activity',
        variant: 'primary',
        onClick: () => {
          const targetDayId = document.getElementById('copyTargetDay').value;
          const targetDay = days.find((d) => d.id === targetDayId);
          if (!targetDay) return;

          let startMin = srcEvent.startMin;
          if (timingMode === 'append' && targetDay.events.length > 0) {
            const last = targetDay.events[targetDay.events.length - 1];
            ensureEventTimeFields(last);
            startMin = Math.min(23 * 60 + 15, last.startMin + last.durationMin + 15);
          }

          const clone = {
            ...srcEvent,
            id: uid('ev'),
            startMin,
            time: formatTimeRange(startMin, srcEvent.durationMin),
            completed: false,
            fixedTime: timingMode === 'keep' ? Boolean(srcEvent.fixedTime) : false,
            travelFromPrevMin: null,
            travelFromPrevMiles: null
          };

          let insertIdx = targetDay.events.length;
          if (timingMode === 'keep') {
            insertIdx = targetDay.events.findIndex((e) => {
              ensureEventTimeFields(e);
              return e.startMin > startMin;
            });
            if (insertIdx === -1) insertIdx = targetDay.events.length;
          }
          targetDay.events.splice(insertIdx, 0, clone);

          if (appStore.autoAdjustTimes) {
            const rippled = rippleAdjustDay(targetDay, insertIdx + 1);
            markRippledEvents([clone.id, ...rippled]);
          }

          closeModal();
          renderCarousel();
          renderItinerary();
          prefetchRoutesForDay(targetDay);
          scheduleCloudSave();
          showToast(`Copied to ${targetDay.shortDay || targetDay.title}`);
        }
      }
    ]
  });

  document.querySelectorAll('[data-copy-timing]').forEach((btn) => {
    btn.addEventListener('click', () => {
      timingMode = btn.dataset.copyTiming;
      document.querySelectorAll('[data-copy-timing]').forEach((b) => {
        const active = b.dataset.copyTiming === timingMode;
        b.className = `py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
          active
            ? 'bg-sky-500/25 border-sky-400/50 text-sky-100'
            : 'bg-black/35 border-white/10 text-white/65 hover:text-white'
        }`;
      });
    });
  });
}

/**
 * Travel Time, Distance & Mode Override Modal (Click any Transit Connector Pill)
 */
export function openTravelOverrideModal(dayId, eventId) {
  const day = appStore.state.days.find((d) => d.id === dayId);
  if (!day) return;
  const idx = day.events.findIndex((e) => e.id === eventId);
  if (idx <= 0) return;

  const ev = day.events[idx];
  const leg = getLegTravelInfo(day, idx);
  let selectedMode = ev.travelMode === 'walk' ? 'walk' : 'drive';
  const inp = 'w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-400/40';

  openModal({
    title: 'Travel Time & Distance',
    bodyHtml: `
      <div class="space-y-4">
        <div class="rounded-2xl border border-white/12 bg-white/[0.04] p-3.5 space-y-1 text-xs">
          <div class="text-[10px] font-bold uppercase tracking-wider text-sky-300">Route Segment</div>
          <div class="text-white/90 font-medium">${esc(leg.fromLabel || 'Previous stop')} → ${esc(leg.toLabel || ev.text)}</div>
          <div class="text-white/50">
            ${leg.source === 'manual' ? 'Currently using custom travel override.' : leg.source === 'auto' ? `Auto-calculated: ${formatDurationLabel(leg.minutes)} · ${leg.miles} mi` : 'Add locations or enter a custom travel estimate below.'}
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-white/60 mb-1.5">Travel Mode</label>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" data-tr-mode="drive" class="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              selectedMode === 'drive' ? 'bg-sky-500/25 border-sky-400/50 text-sky-100' : 'bg-black/35 border-white/10 text-white/60 hover:text-white'
            }">${ICONS.drive}<span>Driving</span></button>
            <button type="button" data-tr-mode="walk" class="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              selectedMode === 'walk' ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-100' : 'bg-black/35 border-white/10 text-white/60 hover:text-white'
            }">${ICONS.walk}<span>Walking</span></button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-white/60 mb-1">Travel Time (min)</label>
            <input id="trMinutes" type="number" inputmode="numeric" min="0" max="600" placeholder="Auto" class="${inp} tabular-nums" value="${ev.travelFromPrevMin !== null ? ev.travelFromPrevMin : (leg.minutes || '')}" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-white/60 mb-1">Distance (miles)</label>
            <input id="trMiles" type="number" inputmode="decimal" min="0" step="0.1" placeholder="Auto" class="${inp} tabular-nums" value="${ev.travelFromPrevMiles !== null ? ev.travelFromPrevMiles : (leg.miles || '')}" />
          </div>
        </div>
      </div>
    `,
    footerButtons: [
      {
        label: 'Use Auto-Route',
        onClick: () => {
          ev.travelMode = selectedMode;
          ev.travelFromPrevMin = null;
          ev.travelFromPrevMiles = null;
          closeModal();
          renderItinerary();
          prefetchRoutesForDay(day);
          scheduleCloudSave();
          showToast('Reset to auto-calculated travel route');
        }
      },
      {
        label: 'Save Travel',
        variant: 'primary',
        onClick: () => {
          const minRaw = document.getElementById('trMinutes').value.trim();
          const miRaw = document.getElementById('trMiles').value.trim();
          ev.travelMode = selectedMode;
          ev.travelFromPrevMin = minRaw === '' ? null : Math.max(0, Math.round(Number(minRaw) || 0));
          ev.travelFromPrevMiles = miRaw === '' ? null : Math.max(0, Number(miRaw) || 0);

          if (appStore.autoAdjustTimes) {
            const rippled = rippleAdjustDay(day, idx);
            if (rippled.length > 0) markRippledEvents(rippled);
          }

          closeModal();
          renderItinerary();
          scheduleCloudSave();
          showToast('Travel leg updated');
        }
      }
    ]
  });

  document.querySelectorAll('[data-tr-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedMode = btn.dataset.trMode;
      document.querySelectorAll('[data-tr-mode]').forEach((b) => {
        const isDrive = b.dataset.trMode === 'drive';
        const active = b.dataset.trMode === selectedMode;
        b.className = `flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
          active
            ? (isDrive ? 'bg-sky-500/25 border-sky-400/50 text-sky-100' : 'bg-emerald-500/25 border-emerald-400/50 text-emerald-100')
            : 'bg-black/35 border-white/10 text-white/60 hover:text-white'
        }`;
      });
    });
  });
}

/**
 * Custom Activity Categories Manager Modal (Create, Preview & Delete)
 */
export function openCustomCategoriesModal(onCloseCallback = null) {
  if (!Array.isArray(appStore.state.customCategories)) {
    appStore.state.customCategories = [];
  }

  let selectedIcon = 'star';
  let selectedTheme = 'violet';
  const inp = 'w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-sky-400/40';

  const renderModalContent = () => {
    const customs = appStore.state.customCategories;
    const theme = CUSTOM_CATEGORY_THEMES[selectedTheme] || CUSTOM_CATEGORY_THEMES.violet;

    const existingListHtml = customs.length === 0
      ? `<div class="rounded-xl border border-dashed border-white/12 bg-black/25 px-3 py-3 text-center text-xs text-white/45">No custom categories yet — create your first one below!</div>`
      : customs.map((cat) => {
          const meta = getCategoryMeta(cat.id);
          return `
            <div class="flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2 animate-rowEnter">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${meta.color}">${ICONS[meta.icon] || ICONS.star}</span>
                <span class="text-xs sm:text-sm font-semibold text-white truncate">${esc(meta.label)}</span>
              </div>
              <button type="button" data-del-custom-cat="${esc(cat.id)}" title="Delete category" class="p-1.5 rounded-lg text-white/45 hover:text-rose-300 hover:bg-rose-500/20 cursor-pointer shrink-0">${ICONS.trash}</button>
            </div>
          `;
        }).join('');

    openModal({
      title: 'Custom Activity Categories',
      bodyHtml: `
        <div class="space-y-4">
          <div class="space-y-2">
            <div class="text-[10px] font-bold uppercase tracking-widest text-sky-300">Your Custom Categories (${customs.length})</div>
            <div class="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">${existingListHtml}</div>
          </div>

          <div class="rounded-2xl border border-white/12 bg-black/35 p-4 space-y-3.5">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-semibold text-white">Create New Category</span>
              <span id="catPreviewBadge" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${theme.color}">
                <span>${ICONS[selectedIcon]}</span>
                <span id="catPreviewLabel">New Category</span>
              </span>
            </div>

            <div>
              <label class="block text-xs font-semibold text-white/60 mb-1">Category Name</label>
              <input id="customCatName" placeholder="e.g. Coffee & Cafe, Photo Spot, Kids Play, Shopping" class="${inp}" />
            </div>

            <div>
              <label class="block text-xs font-semibold text-white/60 mb-1.5">Choose Color Glow</label>
              <div class="flex flex-wrap items-center gap-2">
                ${Object.entries(CUSTOM_CATEGORY_THEMES).map(([key, t]) => `
                  <button
                    type="button"
                    data-cat-theme="${key}"
                    title="${esc(t.label)}"
                    class="w-7 h-7 rounded-full ${t.swatch} border-2 transition-transform cursor-pointer ${
                      selectedTheme === key ? 'border-white scale-115 shadow-lg' : 'border-transparent opacity-70 hover:opacity-100'
                    }"
                  ></button>
                `).join('')}
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-white/60 mb-1.5">Choose Icon</label>
              <div class="grid grid-cols-8 gap-1.5">
                ${CUSTOM_CATEGORY_ICON_KEYS.map((iconKey) => `
                  <button
                    type="button"
                    data-cat-icon="${iconKey}"
                    class="h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                      selectedIcon === iconKey
                        ? `${theme.color} scale-105`
                        : 'bg-white/[0.04] border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                    }"
                  >${ICONS[iconKey]}</button>
                `).join('')}
              </div>
            </div>

            <button
              id="createCustomCatBtn"
              type="button"
              class="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-sky-500 hover:from-orange-400 hover:to-sky-400 text-white text-xs sm:text-sm font-semibold shadow-lg transition-all cursor-pointer"
            >+ Save Custom Category</button>
          </div>
        </div>
      `,
      footerButtons: [
        {
          label: 'Done',
          onClick: () => {
            closeModal();
            if (typeof onCloseCallback === 'function') onCloseCallback();
          }
        }
      ]
    });

    const nameInp = document.getElementById('customCatName');
    const previewBadge = document.getElementById('catPreviewBadge');
    const previewLabel = document.getElementById('catPreviewLabel');

    const updatePreview = () => {
      const t = CUSTOM_CATEGORY_THEMES[selectedTheme] || CUSTOM_CATEGORY_THEMES.violet;
      if (previewBadge) {
        previewBadge.className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${t.color}`;
        previewBadge.innerHTML = `<span>${ICONS[selectedIcon]}</span><span id="catPreviewLabel">${esc(nameInp?.value.trim() || 'New Category')}</span>`;
      } else if (previewLabel) {
        previewLabel.textContent = nameInp?.value.trim() || 'New Category';
      }
    };

    nameInp?.addEventListener('input', updatePreview);

    document.querySelectorAll('[data-cat-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedTheme = btn.dataset.catTheme;
        document.querySelectorAll('[data-cat-theme]').forEach((b) => {
          const active = b.dataset.catTheme === selectedTheme;
          b.classList.toggle('border-white', active);
          b.classList.toggle('scale-115', active);
          b.classList.toggle('shadow-lg', active);
          b.classList.toggle('border-transparent', !active);
          b.classList.toggle('opacity-70', !active);
        });
        updatePreview();
      });
    });

    document.querySelectorAll('[data-cat-icon]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedIcon = btn.dataset.catIcon;
        const t = CUSTOM_CATEGORY_THEMES[selectedTheme] || CUSTOM_CATEGORY_THEMES.violet;
        document.querySelectorAll('[data-cat-icon]').forEach((b) => {
          const active = b.dataset.catIcon === selectedIcon;
          b.className = `h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
            active
              ? `${t.color} scale-105`
              : 'bg-white/[0.04] border-white/10 text-white/60 hover:text-white hover:bg-white/10'
          }`;
        });
        updatePreview();
      });
    });

    document.getElementById('createCustomCatBtn')?.addEventListener('click', () => {
      const label = nameInp?.value.trim() || '';
      if (!label) return showToast('Enter a category name', 'error');
      const t = CUSTOM_CATEGORY_THEMES[selectedTheme] || CUSTOM_CATEGORY_THEMES.violet;
      appStore.state.customCategories.push({
        id: uid('cat'),
        label,
        icon: selectedIcon,
        themeKey: selectedTheme,
        color: t.color,
        rgb: t.rgb
      });
      renderItinerary();
      scheduleCloudSave();
      showToast(`Created "${label}" category`);
      renderModalContent();
    });

    document.querySelectorAll('[data-del-custom-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const delId = btn.dataset.delCustomCat;
        appStore.state.customCategories = appStore.state.customCategories.filter((c) => c.id !== delId);
        // Safely reset any stop using the deleted category back to 'stop'
        appStore.state.days.forEach((d) => {
          d.events.forEach((e) => {
            if (e.category === delId) e.category = 'stop';
          });
        });
        renderItinerary();
        scheduleCloudSave();
        showToast('Custom category removed');
        renderModalContent();
      });
    });
  };

  renderModalContent();
}

/**
 * Delete & Reorder Itinerary Stops (With Auto-Adjust Ripple Support)
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
      prefetchRoutesForDay(day);
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

  const anchorStart = day.events[Math.min(idx, target)].startMin;
  const [moved] = day.events.splice(idx, 1);
  moved.travelFromPrevMin = null;
  moved.travelFromPrevMiles = null;
  day.events.splice(target, 0, moved);

  if (appStore.autoAdjustTimes) {
    const rippled = [];
    const firstAffected = Math.min(idx, target);
    const firstEv = day.events[firstAffected];
    ensureEventTimeFields(firstEv);

    if (!firstEv.fixedTime) {
      if (firstAffected === 0) {
        firstEv.startMin = anchorStart;
      } else {
        const prev = day.events[firstAffected - 1];
        ensureEventTimeFields(prev);
        const leg = getLegTravelInfo(day, firstAffected);
        firstEv.startMin = Math.min(23 * 60 + 30, prev.startMin + prev.durationMin + (leg.minutes || 0));
      }
      firstEv.time = formatTimeRange(firstEv.startMin, firstEv.durationMin);
      rippled.push(firstEv.id);
    }

    const following = rippleAdjustDay(day, Math.max(1, firstAffected + 1), { packAll: true });
    following.forEach((id) => {
      if (!rippled.includes(id)) rippled.push(id);
    });
    if (rippled.length > 0) markRippledEvents(rippled);
  }

  renderItinerary();
  prefetchRoutesForDay(day);
  scheduleCloudSave();
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
    detail: 'This will restore the default itinerary, checklist, budget, and clear notes for the active trip (your other saved trips remain safe).',
    confirmLabel: 'Yes, Reset Trip',
    onConfirm: () => {
      const fresh = isOriginal
        ? createInitialState()
        : createNewDefaultTrip({ title: state.meta.title, startLocation: state.days[0]?.location || 'San Diego' });
      fresh.id = state.id;
      const idx = appStore.trips.findIndex((t) => t.id === appStore.activeTripId);
      if (idx >= 0) appStore.trips[idx] = fresh;
      syncActiveTripRef();
      appStore.activeCarouselIndex = 0;
      appStore.showAllDays = false;
      const track = document.getElementById('carouselTrack');
      if (track) track.dataset.dayIds = '';
      updateBackdropForDay(appStore.state.days[0]);
      renderAll();
      prefetchAllDaysWeather();
      prefetchAllCardPhotos();
      prefetchRoutesForTrip();
      scheduleCloudSave();
      showToast('Current trip reset to default');
    }
  });
}