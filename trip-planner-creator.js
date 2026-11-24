import {
  ICONS,
  LINK_ICON_META,
  CATEGORY_META,
  BUDGET_CATEGORY_META,
  appStore,
  uid,
  esc,
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
 * Add or Edit Itinerary Stop Modal
 */
export function openEventModal(dayId, eventId = null) {
  const day = appStore.state.days.find((d) => d.id === dayId);
  if (!day) return;
  const existing = eventId ? day.events.find((e) => e.id === eventId) : null;
  const inp = 'w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-400/40';
  const options = Object.entries(CATEGORY_META)
    .map(([k, v]) => `<option value="${k}" class="bg-slate-900" ${(existing?.category || 'stop') === k ? 'selected' : ''}>${v.label}</option>`)
    .join('');

  openModal({
    title: existing ? 'Edit Itinerary Stop' : 'Add Itinerary Stop',
    bodyHtml: `
      <div class="space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label class="block text-xs font-semibold text-white/60 mb-1">Time / Window</label><input id="evTime" placeholder="e.g. 2:30–4:00 PM" class="${inp}" value="${esc(existing ? existing.time : '')}" /></div>
          <div><label class="block text-xs font-semibold text-white/60 mb-1">Category Icon</label><select id="evCat" class="${inp}">${options}</select></div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-sky-300/90 mb-1">Location <span class="text-white/40 font-normal">(Optional · Opens in Maps)</span></label>
          <input id="evLocation" placeholder="e.g. The Mission Inn, Riverside, CA or paste a Maps link" class="${inp} border-sky-400/25" value="${esc(existing ? (existing.location || '') : '')}" />
        </div>
        <div><label class="block text-xs font-semibold text-white/60 mb-1">Activity Details</label><textarea id="evText" rows="3" placeholder="Describe the stop, restaurant, or activity..." class="${inp}">${esc(existing ? existing.text : '')}</textarea></div>
      </div>
    `,
    footerButtons: [
      { label: 'Cancel', onClick: closeModal },
      {
        label: existing ? 'Save Stop' : 'Add Stop',
        variant: 'primary',
        onClick: () => {
          const time = document.getElementById('evTime').value.trim();
          const text = document.getElementById('evText').value.trim();
          const category = document.getElementById('evCat').value;
          const location = document.getElementById('evLocation').value.trim();
          if (!time || !text) return showToast('Please enter both time and details', 'error');
          if (existing) {
            existing.time = time;
            existing.text = text;
            existing.category = category;
            existing.location = location;
            showToast('Stop updated');
          } else {
            day.events.push({ id: uid('ev'), time, text, category, location });
            showToast('Stop added');
          }
          closeModal();
          renderCarousel();
          renderItinerary();
          scheduleCloudSave();
        }
      }
    ]
  });
}

/**
 * Delete & Reorder Itinerary Stops
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
  const [moved] = day.events.splice(idx, 1);
  day.events.splice(target, 0, moved);
  renderItinerary();
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
      scheduleCloudSave();
      showToast('Current trip reset to default');
    }
  });
}