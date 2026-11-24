import {
  ICONS,
  LINK_ICON_META,
  BUDGET_CATEGORY_META,
  REAL_CARD_BACKDROPS,
  REAL_THEME_BACKDROPS,
  appStore,
  uid,
  esc,
  getStopMapUrl,
  getStopLocationLabel,
  getCategoryMeta,
  inferBudgetCategory,
  getItemFinalCost,
  formatTimeRange,
  formatDurationLabel,
  formatMinutesTo12h,
  formatMiles,
  ensureEventTimeFields,
  markRippledEvents,
  getLegTravelInfo,
  prefetchRoutesForDay,
  prefetchRoutesForTrip,
  getDayScheduleConflicts,
  getDayTravelTotals,
  getTripTravelTotals,
  rippleAdjustDay,
  autoFitFlexibleDay,
  showToast,
  openModal,
  closeModal,
  openConfirmDeleteModal,
  resolveSceneForDay,
  getCardPhotoUrl,
  scheduleCloudSave,
  getReadinessStats,
  renderHero,
  renderForecastStrip,
  renderCarousel,
  setActiveCarouselIndex
} from './trip-planner.js';

/**
 * Callback Registry (Connected by main.js so detail views can open creator modals cleanly)
 */
export const detailHooks = {
  openDayModal: () => {},
  confirmDeleteDay: () => {},
  openEventModal: () => {},
  deleteEvent: () => {},
  moveEvent: () => {},
  openCopyEventModal: () => {},
  openTravelOverrideModal: () => {},
  openChecklistCategoryModal: () => {},
  openBudgetModal: () => {},
  openLinkModal: () => {}
};

export function registerDetailHooks(overrides = {}) {
  Object.assign(detailHooks, overrides);
}

/**
 * ============================================================================
 * SMART SCHEDULE ACTIONS (Complete, Lock Time, Duplicate, Auto-Fit, Drag-Drop)
 * ============================================================================
 */
let droppedClearTimer = null;
let completedClearTimer = null;

function markDroppedEvent(eventId) {
  appStore.recentlyDroppedId = eventId;
  clearTimeout(droppedClearTimer);
  droppedClearTimer = setTimeout(() => {
    appStore.recentlyDroppedId = null;
  }, 550);
}

function markCompletedEvent(eventId) {
  appStore.recentlyCompletedId = eventId;
  clearTimeout(completedClearTimer);
  completedClearTimer = setTimeout(() => {
    appStore.recentlyCompletedId = null;
  }, 500);
}

export function toggleStopCompleted(dayId, eventId) {
  const day = appStore.state.days.find((d) => d.id === dayId);
  const ev = day?.events.find((e) => e.id === eventId);
  if (!ev) return;
  ev.completed = !ev.completed;
  if (ev.completed) markCompletedEvent(ev.id);
  renderItinerary();
  scheduleCloudSave();
  showToast(ev.completed ? 'Activity marked completed' : 'Activity marked active');
}

export function toggleStopFixedTime(dayId, eventId) {
  const day = appStore.state.days.find((d) => d.id === dayId);
  const ev = day?.events.find((e) => e.id === eventId);
  if (!ev) return;
  ev.fixedTime = !ev.fixedTime;
  renderItinerary();
  scheduleCloudSave();
  showToast(
    ev.fixedTime
      ? `Locked at ${ev.time} (won't auto-shift)`
      : 'Time unlocked (flexible for auto-adjust)'
  );
}

export function duplicateEvent(dayId, eventId) {
  const day = appStore.state.days.find((d) => d.id === dayId);
  if (!day) return;
  const idx = day.events.findIndex((e) => e.id === eventId);
  if (idx < 0) return;

  const src = day.events[idx];
  ensureEventTimeFields(src);
  const nextStart = Math.min(23 * 60 + 30, src.startMin + src.durationMin);
  const clone = {
    ...src,
    id: uid('ev'),
    startMin: nextStart,
    time: formatTimeRange(nextStart, src.durationMin),
    fixedTime: false,
    completed: false,
    travelFromPrevMin: null,
    travelFromPrevMiles: null
  };

  day.events.splice(idx + 1, 0, clone);
  markDroppedEvent(clone.id);

  if (appStore.autoAdjustTimes) {
    const rippled = rippleAdjustDay(day, idx + 2);
    markRippledEvents([clone.id, ...rippled]);
  }

  renderCarousel();
  renderItinerary();
  prefetchRoutesForDay(day);
  scheduleCloudSave();
  showToast('Activity duplicated');
}

export function runAutoFitForDay(dayId) {
  const day = appStore.state.days.find((d) => d.id === dayId);
  if (!day) return;
  const changed = autoFitFlexibleDay(day);
  if (changed.length > 0) {
    markRippledEvents(changed);
    renderItinerary();
    scheduleCloudSave();
    showToast(`Auto-adjusted ${changed.length} flexible ${changed.length === 1 ? 'activity' : 'activities'}`);
  } else {
    showToast('Fixed-time stops cannot be moved — adjust duration or unlock a time', 'error');
  }
}

/**
 * Commit a Drag-and-Drop Operation (Reorder, Time Slot Snap, or Cross-Day Move)
 */
function commitStopDrop({ sourceDayId, eventId, target }) {
  if (!target) return;
  const days = appStore.state.days;
  const sourceDay = days.find((d) => d.id === sourceDayId);
  if (!sourceDay) return;
  const srcIdx = sourceDay.events.findIndex((e) => e.id === eventId);
  if (srcIdx < 0) return;

  const targetDay = days.find((d) => d.id === target.dayId);
  if (!targetDay) return;

  const sameDay = sourceDay.id === targetDay.id;
  const [moved] = sourceDay.events.splice(srcIdx, 1);
  ensureEventTimeFields(moved);

  // Clear stale manual transit overrides if neighbors changed
  moved.travelFromPrevMin = null;
  moved.travelFromPrevMiles = null;

  let rippledIds = [];
  let toastMessage = '';

  if (target.kind === 'slot') {
    // Dropped directly onto a specific hourly Time Slot
    const slotMin = Math.max(0, Math.min(23 * 60 + 30, target.slotMin));
    moved.startMin = slotMin;
    moved.time = formatTimeRange(moved.startMin, moved.durationMin);

    // Find chronological insertion index inside targetDay
    let insertIdx = targetDay.events.findIndex((e) => {
      ensureEventTimeFields(e);
      return e.startMin > slotMin;
    });
    if (insertIdx === -1) insertIdx = targetDay.events.length;
    targetDay.events.splice(insertIdx, 0, moved);

    if (appStore.autoAdjustTimes) {
      rippledIds = rippleAdjustDay(targetDay, insertIdx + 1);
    }
    markRippledEvents([moved.id, ...rippledIds]);
    toastMessage = `Moved to ${formatMinutesTo12h(slotMin)}${!sameDay ? ` (${targetDay.shortDay})` : ''}${rippledIds.length ? ` · ${rippledIds.length} shifted` : ''}`;
  } else if (target.kind === 'card') {
    // Dropped before/after another activity card
    let insertIdx = targetDay.events.findIndex((e) => e.id === target.targetEventId);
    if (insertIdx === -1) {
      insertIdx = targetDay.events.length;
    } else if (target.position === 'after') {
      insertIdx += 1;
    }

    // Remember original anchor start time if moving to position 0 of a non-empty day
    const firstBeforeMove = targetDay.events[0] ? targetDay.events[0].startMin : moved.startMin;
    targetDay.events.splice(insertIdx, 0, moved);

    if (appStore.autoAdjustTimes) {
      if (!moved.fixedTime) {
        if (insertIdx === 0) {
          moved.startMin = sameDay ? Math.min(firstBeforeMove, moved.startMin) : firstBeforeMove;
          moved.time = formatTimeRange(moved.startMin, moved.durationMin);
        } else {
          const prev = targetDay.events[insertIdx - 1];
          ensureEventTimeFields(prev);
          const leg = getLegTravelInfo(targetDay, insertIdx);
          moved.startMin = Math.min(23 * 60 + 30, prev.startMin + prev.durationMin + (leg.minutes || 0));
          moved.time = formatTimeRange(moved.startMin, moved.durationMin);
        }
        rippledIds.push(moved.id);
      }

      const following = rippleAdjustDay(targetDay, Math.max(1, insertIdx + 1));
      following.forEach((id) => {
        if (!rippledIds.includes(id)) rippledIds.push(id);
      });
    }

    markRippledEvents(rippledIds);
    toastMessage = sameDay
      ? `Reordered${rippledIds.length ? ` · Auto-adjusted ${rippledIds.length} time${rippledIds.length === 1 ? '' : 's'}` : ''}`
      : `Moved to ${targetDay.shortDay} · ${targetDay.location || targetDay.shortDate}`;
  } else if (target.kind === 'day') {
    // Dropped onto Cross-Day Dock chip or empty Day container
    const insertIdx = targetDay.events.length;
    targetDay.events.splice(insertIdx, 0, moved);

    if (appStore.autoAdjustTimes && !moved.fixedTime) {
      if (insertIdx > 0) {
        const prev = targetDay.events[insertIdx - 1];
        ensureEventTimeFields(prev);
        const leg = getLegTravelInfo(targetDay, insertIdx);
        moved.startMin = Math.min(23 * 60 + 30, prev.startMin + prev.durationMin + (leg.minutes || 0));
        moved.time = formatTimeRange(moved.startMin, moved.durationMin);
        rippledIds.push(moved.id);
      }
      const following = rippleAdjustDay(targetDay, Math.max(1, insertIdx + 1));
      following.forEach((id) => {
        if (!rippledIds.includes(id)) rippledIds.push(id);
      });
    }

    markRippledEvents(rippledIds);
    toastMessage = `Moved to ${targetDay.shortDay} · ${targetDay.location || targetDay.title}`;
  }

  markDroppedEvent(moved.id);

  // If moved to another day while in Focused Day mode, jump straight to that day so the user sees it land
  if (!sameDay && !appStore.showAllDays) {
    const targetDayIdx = days.findIndex((d) => d.id === targetDay.id);
    if (targetDayIdx >= 0) {
      setActiveCarouselIndex(targetDayIdx);
      prefetchRoutesForTrip();
      scheduleCloudSave();
      if (toastMessage) showToast(toastMessage);
      return;
    }
  }

  renderCarousel();
  renderItinerary();
  prefetchRoutesForTrip();
  scheduleCloudSave();
  if (toastMessage) showToast(toastMessage);
}

/**
 * Unified Pointer Drag-and-Drop Controller (Desktop Mouse + Mobile Touch)
 */
function setupItineraryDragAndDrop(container) {
  container.querySelectorAll('.stop-drag-handle').forEach((handle) => {
    handle.addEventListener('pointerdown', (startEvent) => {
      if (startEvent.button !== 0 && startEvent.pointerType === 'mouse') return;

      const cardWrap = handle.closest('.stop-card-wrap');
      if (!cardWrap) return;

      const sourceDayId = cardWrap.dataset.dayId;
      const eventId = cardWrap.dataset.stopId;
      const sourceDay = appStore.state.days.find((d) => d.id === sourceDayId);
      const evObj = sourceDay?.events.find((e) => e.id === eventId);
      if (!evObj) return;

      startEvent.preventDefault();

      const startX = startEvent.clientX;
      const startY = startEvent.clientY;
      let isDragging = false;
      let ghostEl = null;
      let ghostBadgeEl = null;
      let activeTarget = null;
      let scrollRafId = null;
      let lastClientX = startX;
      let lastClientY = startY;

      const dockEl = document.getElementById('crossDayDropDock');
      const dockTargetsEl = document.getElementById('crossDayDropTargets');

      const clearHighlights = () => {
        document.querySelectorAll('.drop-before, .drop-after').forEach((el) => {
          el.classList.remove('drop-before', 'drop-after');
        });
        document.querySelectorAll('.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
        document.querySelectorAll('.is-day-drop-hover').forEach((el) => el.classList.remove('is-day-drop-hover'));
        document.querySelectorAll('.is-slot-hover').forEach((el) => el.classList.remove('is-slot-hover'));
      };

      const renderCrossDayDock = () => {
        if (!dockEl || !dockTargetsEl || appStore.state.days.length <= 1) return;
        dockTargetsEl.innerHTML = appStore.state.days.map((d, idx) => {
          const isCurrent = d.id === sourceDayId;
          return `
            <div
              data-drop-day-id="${esc(d.id)}"
              class="day-drop-chip px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
                isCurrent
                  ? 'bg-white/5 border-white/10 text-white/45'
                  : 'bg-white/10 border-white/20 text-white/90'
              }"
            >
              <span class="w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-white/30' : 'bg-sky-300'}"></span>
              <span>${esc(d.shortDay || `Day ${idx + 1}`)}</span>
              <span class="text-[10px] opacity-70">${esc(d.location || d.shortDate || '')}</span>
            </div>
          `;
        }).join('');
        dockEl.classList.remove('hidden');
      };

      const startDragSession = (e) => {
        isDragging = true;
        document.body.classList.add('is-dragging-stop');
        cardWrap.classList.add('is-dragging-source');
        renderCrossDayDock();

        const cat = getCategoryMeta(evObj.category);
        const rect = cardWrap.getBoundingClientRect();
        const ghostW = Math.min(Math.max(240, rect.width), window.innerWidth - 28);

        ghostEl = document.createElement('div');
        ghostEl.className = 'drag-ghost px-3.5 py-2.5';
        ghostEl.style.width = `${ghostW}px`;
        ghostEl.innerHTML = `
          <div class="flex items-center gap-2.5">
            <span class="w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${cat.color}">${ICONS[cat.icon] || ICONS.stop}</span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="text-[11px] font-bold text-orange-300">${esc(evObj.time)}</span>
                ${evObj.fixedTime ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 font-semibold">Fixed</span>` : ''}
              </div>
              <p class="text-xs font-medium text-white truncate">${esc(evObj.text)}</p>
            </div>
          </div>
          <div data-ghost-hint class="mt-1.5 pt-1.5 border-t border-white/10 text-[10px] font-semibold text-sky-300 truncate">
            Drag to reorder, drop on a time slot, or drop onto another day
          </div>
        `;
        document.body.appendChild(ghostEl);
        ghostBadgeEl = ghostEl.querySelector('[data-ghost-hint]');
        positionGhost(e.clientX, e.clientY);

        const autoScrollLoop = () => {
          if (!isDragging) return;
          const edge = 76;
          if (lastClientY < edge) {
            window.scrollBy(0, -Math.max(4, (edge - lastClientY) * 0.22));
          } else if (lastClientY > window.innerHeight - edge) {
            window.scrollBy(0, Math.max(4, (lastClientY - (window.innerHeight - edge)) * 0.22));
          }
          scrollRafId = requestAnimationFrame(autoScrollLoop);
        };
        scrollRafId = requestAnimationFrame(autoScrollLoop);
      };

      const positionGhost = (cx, cy) => {
        if (!ghostEl) return;
        const w = ghostEl.offsetWidth || 260;
        const h = ghostEl.offsetHeight || 68;
        const clampedX = Math.max(10, Math.min(window.innerWidth - w - 10, cx - w / 2));
        const clampedY = Math.max(10, Math.min(window.innerHeight - h - 10, cy - h * 0.55));
        ghostEl.style.left = `${clampedX}px`;
        ghostEl.style.top = `${clampedY}px`;
      };

      const hitTestTarget = (cx, cy) => {
        clearHighlights();
        activeTarget = null;
        const el = document.elementFromPoint(cx, cy);
        if (!el) return;

        // 1. Cross-Day Drop Dock Chip
        const chip = el.closest('[data-drop-day-id]');
        if (chip && chip.dataset.dropDayId !== sourceDayId) {
          chip.classList.add('is-drop-target');
          const tDay = appStore.state.days.find((d) => d.id === chip.dataset.dropDayId);
          activeTarget = { kind: 'day', dayId: chip.dataset.dropDayId };
          if (ghostBadgeEl) ghostBadgeEl.textContent = `Drop to move to ${tDay?.shortDay || 'Day'} · ${tDay?.location || ''}`;
          return;
        }

        // 2. Another Stop Card (Reorder Before / After — Same Day or Across Days)
        const stopEl = el.closest('.stop-card-wrap[data-stop-id]');
        if (stopEl && stopEl.dataset.stopId !== eventId) {
          const rect = stopEl.getBoundingClientRect();
          const position = cy < rect.top + rect.height / 2 ? 'before' : 'after';
          stopEl.classList.add(position === 'before' ? 'drop-before' : 'drop-after');
          activeTarget = {
            kind: 'card',
            dayId: stopEl.dataset.dayId,
            targetEventId: stopEl.dataset.stopId,
            position
          };
          if (ghostBadgeEl) {
            const label = stopEl.dataset.dayId !== sourceDayId ? 'Move to other day & ' : '';
            ghostBadgeEl.textContent = `${label}Place ${position} stop${appStore.autoAdjustTimes ? ' · Auto-adjust times' : ''}`;
          }
          return;
        }

        // 3. Time Slot Zone (Time Slots Mode)
        const slotEl = el.closest('.time-slot-zone[data-slot-day][data-slot-min]');
        if (slotEl) {
          slotEl.classList.add('is-slot-hover');
          const slotMin = Number(slotEl.dataset.slotMin);
          activeTarget = {
            kind: 'slot',
            dayId: slotEl.dataset.slotDay,
            slotMin
          };
          if (ghostBadgeEl) {
            ghostBadgeEl.textContent = `Snap to ${formatMinutesTo12h(slotMin)}${appStore.autoAdjustTimes ? ' · Ripple following flexible stops' : ''}`;
          }
          return;
        }

        // 4. Whole Day Article Drop (All Days view — e.g. empty day or bottom area)
        const dayArticle = el.closest('.day-article-drop[data-day-drop]');
        if (dayArticle && dayArticle.dataset.dayDrop !== sourceDayId) {
          dayArticle.classList.add('is-day-drop-hover');
          const tDay = appStore.state.days.find((d) => d.id === dayArticle.dataset.dayDrop);
          activeTarget = { kind: 'day', dayId: dayArticle.dataset.dayDrop };
          if (ghostBadgeEl) ghostBadgeEl.textContent = `Move to ${tDay?.shortDay || 'Day'} · ${tDay?.location || ''}`;
          return;
        }

        if (ghostBadgeEl) {
          ghostBadgeEl.textContent = 'Drag over another stop, time slot, or day to drop';
        }
      };

      const onPointerMove = (e) => {
        lastClientX = e.clientX;
        lastClientY = e.clientY;
        const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
        if (!isDragging && dist > 6) {
          startDragSession(e);
        }
        if (isDragging) {
          e.preventDefault();
          positionGhost(e.clientX, e.clientY);
          hitTestTarget(e.clientX, e.clientY);
        }
      };

      const cleanup = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerCancel);
        if (scrollRafId) cancelAnimationFrame(scrollRafId);
        clearHighlights();
        document.body.classList.remove('is-dragging-stop');
        cardWrap.classList.remove('is-dragging-source');
        if (ghostEl) {
          ghostEl.remove();
          ghostEl = null;
        }
        if (dockEl) dockEl.classList.add('hidden');
      };

      const onPointerUp = () => {
        const finalTarget = activeTarget;
        const wasDragging = isDragging;
        cleanup();
        if (wasDragging && finalTarget) {
          commitStopDrop({ sourceDayId, eventId, target: finalTarget });
        }
      };

      const onPointerCancel = () => {
        cleanup();
      };

      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerCancel);
    });
  });
}

/**
 * Sync Toolbar Buttons & Whole-Trip Telemetry Bar
 */
export function renderScheduleControls() {
  const modeTimelineBtn = document.getElementById('scheduleModeTimelineBtn');
  const modeSlotsBtn = document.getElementById('scheduleModeSlotsBtn');
  const viewSingleBtn = document.getElementById('viewSingleBtn');
  const viewAllBtn = document.getElementById('viewAllBtn');
  const autoBtn = document.getElementById('autoAdjustToggleBtn');
  const autoDot = document.getElementById('autoAdjustDot');
  const autoLabel = document.getElementById('autoAdjustLabel');
  const telemetryEl = document.getElementById('tripScheduleTelemetry');

  if (modeTimelineBtn && modeSlotsBtn) {
    const isTimeline = appStore.scheduleViewMode !== 'slots';
    modeTimelineBtn.className = isTimeline
      ? 'px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-orange-500/80 to-sky-500/80 text-white shadow cursor-pointer'
      : 'px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium text-white/60 hover:text-white cursor-pointer';
    modeSlotsBtn.className = !isTimeline
      ? 'px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-orange-500/80 to-sky-500/80 text-white shadow cursor-pointer'
      : 'px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium text-white/60 hover:text-white cursor-pointer';
  }

  if (viewSingleBtn && viewAllBtn) {
    viewSingleBtn.className = !appStore.showAllDays
      ? 'px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold bg-white/20 text-white shadow cursor-pointer'
      : 'px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium text-white/60 hover:text-white cursor-pointer';
    viewAllBtn.className = appStore.showAllDays
      ? 'px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold bg-white/20 text-white shadow cursor-pointer'
      : 'px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium text-white/60 hover:text-white cursor-pointer';
  }

  if (autoBtn && autoDot && autoLabel) {
    const on = appStore.autoAdjustTimes;
    autoBtn.className = on
      ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 backdrop-blur-xl text-sky-200 transition-all cursor-pointer'
      : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/8 hover:bg-white/15 border border-white/15 backdrop-blur-xl text-white/65 transition-all cursor-pointer';
    autoDot.className = on
      ? 'w-2 h-2 rounded-full bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.9)]'
      : 'w-2 h-2 rounded-full bg-white/30';
    autoLabel.textContent = on ? 'Auto-Adjust: ON' : 'Auto-Adjust: OFF';
  }

  if (telemetryEl) {
    const tripStats = getTripTravelTotals();
    const completionPct = tripStats.totalCount > 0 ? Math.round((tripStats.completedCount / tripStats.totalCount) * 100) : 0;
    telemetryEl.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div class="flex flex-wrap items-center gap-2 sm:gap-3">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-500/15 border border-sky-400/30 text-sky-200 font-semibold tabular-nums">
            <span class="text-sky-300">${ICONS.route}</span>
            <span>Trip Travel:</span>
            <span class="text-white">${tripStats.totalMinutes > 0 ? formatDurationLabel(tripStats.totalMinutes) : '0m'}</span>
            <span class="text-white/40">·</span>
            <span class="text-sky-100">${formatMiles(tripStats.totalMiles)}</span>
          </div>

          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 font-semibold tabular-nums">
            <span class="text-emerald-300">${ICONS.check}</span>
            <span>${tripStats.completedCount} / ${tripStats.totalCount} Done</span>
            <span class="text-[10px] text-emerald-300/80">(${completionPct}%)</span>
          </div>

          ${tripStats.conflictCount > 0 ? `
            <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-200 font-semibold tabular-nums">
              <span class="text-rose-300">${ICONS.alert}</span>
              <span>${tripStats.conflictCount} Tight Timing ${tripStats.conflictCount === 1 ? 'Warning' : 'Warnings'}</span>
            </div>
          ` : `
            <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.05] border border-white/10 text-white/65 font-medium">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>No schedule conflicts</span>
            </div>
          `}
        </div>

        <div class="text-[11px] text-white/45 hidden md:flex items-center gap-1.5">
          <span class="text-white/60">${ICONS.grip}</span>
          <span>Drag handle to reorder, drop on time slots, or move across days</span>
        </div>
      </div>
    `;
  }
}

/**
 * Helper: Render One Interactive Activity Card (Shared by Timeline & Time Slots Modes)
 */
function renderStopCardHtml(day, ev, eIdx, conflictsMap, { showTimelineNode = true } = {}) {
  ensureEventTimeFields(ev);
  const cat = getCategoryMeta(ev.category);
  const mapUrl = getStopMapUrl(ev.location);
  const conflict = conflictsMap.get(ev.id);
  const isRippled = appStore.recentlyRippledIds.has(ev.id);
  const isDropped = appStore.recentlyDroppedId === ev.id;
  const isJustCompleted = appStore.recentlyCompletedId === ev.id;

  const leg = eIdx > 0 ? getLegTravelInfo(day, eIdx) : null;
  const showTransitConnector = eIdx > 0 && leg && (leg.source === 'manual' || leg.source === 'auto' || leg.source === 'pending' || (leg.fromLabel && leg.toLabel && leg.source !== 'same'));

  const transitPillHtml = showTransitConnector ? `
    <div class="mb-2.5 ${showTimelineNode ? 'pl-5 sm:pl-6' : 'pl-1'}">
      <button
        type="button"
        data-action="edit-travel"
        data-day="${esc(day.id)}"
        data-event="${esc(ev.id)}"
        title="Click to edit travel time, distance, or mode (drive/walk)"
        class="transit-connector-pill inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer ${
          conflict
            ? 'bg-rose-500/15 border-rose-400/40 text-rose-200'
            : leg.source === 'manual'
              ? 'bg-orange-500/15 border-orange-400/35 text-orange-200 hover:bg-orange-500/25'
              : 'bg-sky-500/12 border-sky-400/25 text-sky-200 hover:bg-sky-500/22'
        }"
      >
        <span class="${conflict ? 'text-rose-300' : 'text-sky-300'}">${leg.mode === 'walk' ? ICONS.walk : ICONS.drive}</span>
        ${leg.source === 'pending'
          ? `<span class="opacity-80">Calculating route...</span>`
          : `<span class="font-semibold tabular-nums">${formatDurationLabel(leg.minutes)}</span>
             ${leg.miles > 0 ? `<span class="opacity-50">·</span><span class="tabular-nums">${formatMiles(leg.miles)}</span>` : ''}
             <span class="text-[10px] opacity-65">${leg.mode === 'walk' ? 'walk' : 'drive'}${leg.source === 'manual' ? ' · custom' : ''}</span>`
        }
      </button>
    </div>
  ` : '';

  const conflictBannerHtml = conflict ? `
    <div class="conflict-banner mt-2.5 rounded-xl bg-rose-500/15 border border-rose-400/45 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-rose-100">
      <div class="flex items-start gap-2 min-w-0 flex-1">
        <span class="text-rose-300 shrink-0 mt-0.5">${ICONS.alert}</span>
        <div class="min-w-0 leading-snug">
          <strong class="text-rose-200">Not enough time:</strong>
          Arrives at <span class="font-bold tabular-nums">${formatMinutesTo12h(conflict.earliestArrival)}</span>
          (<span class="font-bold text-orange-200">+${conflict.overlapMin}m late</span>${conflict.travelMin > 0 ? ` incl. ${formatDurationLabel(conflict.travelMin)} travel` : ''}).
        </div>
      </div>
      <button
        type="button"
        data-action="autofit-day"
        data-day="${esc(day.id)}"
        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-orange-500/85 to-sky-500/85 hover:from-orange-400 hover:to-sky-400 text-white text-[10px] font-bold shadow cursor-pointer shrink-0"
      >
        ${ICONS.bolt}
        <span>Auto-Fit</span>
      </button>
    </div>
  ` : '';

  return `
    ${transitPillHtml}
    <div
      class="stop-card-wrap group relative ${showTimelineNode ? 'pl-4 sm:pl-6' : ''} ${isDropped ? 'is-just-dropped' : ''}"
      data-day-id="${esc(day.id)}"
      data-stop-id="${esc(ev.id)}"
    >
      ${showTimelineNode ? `
        <span class="absolute -left-[10px] top-4 w-3.5 h-3.5 rounded-full border-2 border-[#16171d] transition-transform duration-200 group-hover:scale-125 ${
          ev.completed
            ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.75)]'
            : ev.fixedTime
              ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.75)]'
              : 'bg-gradient-to-br from-orange-400 to-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.6)]'
        }"></span>
      ` : ''}

      <div class="stop-card-surface rounded-2xl border p-3 sm:p-4 transition-all duration-200 ${
        ev.completed
          ? 'border-emerald-400/25 bg-emerald-500/[0.05] opacity-80'
          : conflict
            ? 'border-rose-400/40 bg-rose-500/[0.06]'
            : ev.fixedTime
              ? 'border-amber-400/25 bg-amber-500/[0.04] hover:bg-amber-500/[0.08] hover:border-amber-300/40'
              : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20'
      }">
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
          <div class="flex items-start gap-2 sm:gap-2.5 min-w-0 flex-1">
            <!-- Dedicated Touch & Mouse Drag Handle -->
            <button
              type="button"
              class="stop-drag-handle mt-1 p-1 -ml-1 rounded-lg text-white/35 hover:text-sky-300 hover:bg-white/10 shrink-0 transition-colors"
              title="Drag to reorder, snap to a time slot, or move to another day"
              aria-label="Drag activity"
            >
              ${ICONS.grip}
            </button>

            <!-- Complete Activity Toggle -->
            <button
              type="button"
              data-action="toggle-complete"
              data-day="${esc(day.id)}"
              data-event="${esc(ev.id)}"
              title="${ev.completed ? 'Mark as not completed' : 'Mark activity as completed'}"
              class="stop-check-btn mt-1 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all cursor-pointer ${isJustCompleted ? 'is-just-completed' : ''} ${
                ev.completed
                  ? 'bg-emerald-400 border-emerald-300 text-slate-950 shadow-[0_0_12px_rgba(52,211,153,0.6)]'
                  : 'border-white/30 bg-black/30 hover:border-emerald-400 text-transparent hover:text-emerald-300/60'
              }"
            >
              ${ICONS.check}
            </button>

            <!-- Category Icon Badge -->
            <span title="${esc(cat.label)}" class="w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${cat.color}">
              ${ICONS[cat.icon] || ICONS.stop}
            </span>

            <!-- Activity Content -->
            <div class="min-w-0 flex-1">
              <!-- Time Badge + Duration + Fixed/Flex Lock + Category Tag -->
              <div class="flex flex-wrap items-center gap-1.5 mb-1">
                <button
                  type="button"
                  data-action="edit-event"
                  data-day="${esc(day.id)}"
                  data-event="${esc(ev.id)}"
                  title="Edit time & details"
                  class="time-badge ${isRippled ? 'is-time-rippled' : ''} inline-flex items-center gap-1 px-1.5 py-0.5 -ml-1.5 rounded-lg text-xs font-bold tracking-tight text-orange-300 hover:bg-white/10 transition-colors cursor-pointer tabular-nums"
                >
                  <span>${esc(ev.time)}</span>
                  <span class="text-[10px] font-semibold text-white/50">(${formatDurationLabel(ev.durationMin)})</span>
                </button>

                <button
                  type="button"
                  data-action="toggle-fixed"
                  data-day="${esc(day.id)}"
                  data-event="${esc(ev.id)}"
                  title="${ev.fixedTime ? 'Fixed Time: Will NOT auto-shift when other activities move. Click to unlock.' : 'Flexible Time: Auto-shifts to make room. Click to lock as Fixed Time.'}"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all cursor-pointer ${
                    ev.fixedTime
                      ? 'bg-amber-500/20 border-amber-400/45 text-amber-200 hover:bg-amber-500/30 shadow-sm shadow-amber-500/10'
                      : 'bg-white/[0.06] border-white/12 text-white/55 hover:text-white hover:border-white/25'
                  }"
                >
                  ${ev.fixedTime ? ICONS.lock : ICONS.unlock}
                  <span>${ev.fixedTime ? 'Fixed' : 'Flex'}</span>
                </button>

                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cat.color} opacity-85">
                  ${esc(cat.label)}
                </span>
              </div>

              <p class="text-sm leading-relaxed break-words transition-colors ${
                ev.completed ? 'line-through text-white/45' : 'text-white/90'
              }">${esc(ev.text)}</p>

              <!-- Location Maps Pill + Optional Add Travel Trigger -->
              <div class="mt-2 flex flex-wrap items-center gap-2">
                ${mapUrl ? `
                  <a
                    href="${esc(mapUrl)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open ${esc(ev.location)} in Google Maps"
                    class="inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-full text-[11px] font-medium bg-sky-500/15 hover:bg-sky-500/30 border border-sky-400/30 hover:border-sky-300/60 text-sky-200 hover:text-white transition-all duration-200"
                  >
                    <span class="text-sky-300 shrink-0">${ICONS.pin}</span>
                    <span class="truncate">${esc(getStopLocationLabel(ev.location))}</span>
                    <span class="opacity-65 shrink-0">${ICONS.link}</span>
                  </a>
                ` : ''}

                ${eIdx > 0 && !showTransitConnector ? `
                  <button
                    type="button"
                    data-action="edit-travel"
                    data-day="${esc(day.id)}"
                    data-event="${esc(ev.id)}"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.05] hover:bg-sky-500/20 border border-white/10 hover:border-sky-400/30 text-white/50 hover:text-sky-200 transition-colors cursor-pointer"
                  >
                    ${ICONS.route}
                    <span>+ Travel</span>
                  </button>
                ` : ''}
              </div>
            </div>
          </div>

          <!-- Inline Action Buttons: Move, Duplicate, Copy to Day, Edit, Delete -->
          <div class="flex flex-wrap items-center gap-1 self-end sm:self-start shrink-0 transition-opacity duration-200 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
            <button type="button" data-action="move-event" data-dir="-1" data-day="${esc(day.id)}" data-event="${esc(ev.id)}" ${eIdx === 0 ? 'disabled' : ''} title="Move Up" class="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-25 cursor-pointer">${ICONS.arrowUp}</button>
            <button type="button" data-action="move-event" data-dir="1" data-day="${esc(day.id)}" data-event="${esc(ev.id)}" ${eIdx === day.events.length - 1 ? 'disabled' : ''} title="Move Down" class="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-25 cursor-pointer">${ICONS.arrowDown}</button>
            <button type="button" data-action="duplicate-event" data-day="${esc(day.id)}" data-event="${esc(ev.id)}" title="Duplicate Activity" class="p-1.5 rounded-lg text-white/55 hover:text-emerald-300 hover:bg-emerald-400/15 cursor-pointer">${ICONS.duplicate}</button>
            <button type="button" data-action="copy-to-day" data-day="${esc(day.id)}" data-event="${esc(ev.id)}" title="Copy Activity to Another Day" class="p-1.5 rounded-lg text-white/55 hover:text-amber-300 hover:bg-amber-400/15 cursor-pointer">${ICONS.copyToDay}</button>
            <button type="button" data-action="edit-event" data-day="${esc(day.id)}" data-event="${esc(ev.id)}" title="Edit Stop" class="p-1.5 rounded-lg text-white/60 hover:text-sky-300 hover:bg-sky-400/15 cursor-pointer">${ICONS.edit}</button>
            <button type="button" data-action="delete-event" data-day="${esc(day.id)}" data-event="${esc(ev.id)}" title="Delete Stop" class="p-1.5 rounded-lg text-white/50 hover:text-rose-300 hover:bg-rose-500/15 cursor-pointer">${ICONS.trash}</button>
          </div>
        </div>

        ${conflictBannerHtml}
      </div>
    </div>
  `;
}

/**
 * Helper: Render Hourly Time Slots View for a Day (Drag Any Stop Directly Onto an Hour)
 */
function renderTimeSlotsBodyHtml(day, conflictsMap) {
  let minHour = 7;
  let maxHour = 22;

  day.events.forEach((ev) => {
    ensureEventTimeFields(ev);
    const h = Math.floor(ev.startMin / 60);
    if (h < minHour) minHour = Math.max(0, h);
    if (h > maxHour) maxHour = Math.min(23, h);
  });

  const hours = [];
  for (let h = minHour; h <= maxHour; h++) hours.push(h);

  return `
    <div class="space-y-2">
      ${hours.map((h) => {
        const slotMin = h * 60;
        const slotEvents = day.events
          .map((ev, idx) => ({ ev, idx }))
          .filter(({ ev }) => Math.floor(ev.startMin / 60) === h);

        return `
          <div
            class="time-slot-zone group/slot rounded-2xl border p-2.5 sm:p-3 ${
              slotEvents.length > 0
                ? 'border-white/12 bg-white/[0.03]'
                : 'border-dashed border-white/10 bg-black/20 hover:border-sky-400/35 hover:bg-sky-500/[0.05]'
            }"
            data-slot-day="${esc(day.id)}"
            data-slot-min="${slotMin}"
          >
            <div class="flex flex-col sm:flex-row sm:items-start gap-2.5 sm:gap-3">
              <div class="flex items-center justify-between sm:block sm:w-20 shrink-0 pt-0.5">
                <span class="text-xs font-bold tracking-tight tabular-nums ${slotEvents.length > 0 ? 'text-sky-300' : 'text-white/45'}">
                  ${formatMinutesTo12h(slotMin)}
                </span>
                ${slotEvents.length === 0 ? `
                  <button
                    type="button"
                    data-action="add-event-at-slot"
                    data-day="${esc(day.id)}"
                    data-slot-min="${slotMin}"
                    class="sm:hidden px-2 py-0.5 rounded-lg bg-white/8 hover:bg-sky-500/25 text-[10px] font-semibold text-white/65 hover:text-white cursor-pointer"
                  >+ Add</button>
                ` : ''}
              </div>

              <div class="flex-1 min-w-0 space-y-2.5">
                ${slotEvents.length > 0
                  ? slotEvents.map(({ ev, idx }) => renderStopCardHtml(day, ev, idx, conflictsMap, { showTimelineNode: false })).join('')
                  : `
                    <div class="flex items-center justify-between gap-2 py-0.5">
                      <span class="text-[11px] text-white/35">Drop an activity here to snap to ${formatMinutesTo12h(slotMin)}</span>
                      <button
                        type="button"
                        data-action="add-event-at-slot"
                        data-day="${esc(day.id)}"
                        data-slot-min="${slotMin}"
                        class="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/8 hover:bg-sky-500/25 text-[11px] font-semibold text-white/65 hover:text-white opacity-0 group-hover/slot:opacity-100 transition-opacity cursor-pointer"
                      >
                        ${ICONS.plus}
                        <span>Add here</span>
                      </button>
                    </div>
                  `
                }
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Render Detailed Editable Itinerary Timeline (Drag-and-Drop, Auto-Adjust, Transit, Warnings)
 */
export function renderItinerary() {
  const state = appStore.state;
  const container = document.getElementById('itineraryContainer');
  const activeDayPill = document.getElementById('activeDayPill');

  renderScheduleControls();

  if (state.days.length === 0) {
    activeDayPill.textContent = '0 Days';
    container.innerHTML = `<div class="rounded-3xl bg-[#16171d]/75 backdrop-blur-2xl border border-dashed border-white/15 p-10 text-center text-sm text-white/60">Click "Add Day" to start building your itinerary.</div>`;
    return;
  }

  const visibleDays = appStore.showAllDays ? state.days : [state.days[appStore.activeCarouselIndex]];
  activeDayPill.textContent = appStore.showAllDays
    ? `All ${state.days.length} Days`
    : `${state.days[appStore.activeCarouselIndex]?.shortDay} · ${state.days[appStore.activeCarouselIndex]?.shortDate}`;

  const isSlotsMode = appStore.scheduleViewMode === 'slots';

  container.innerHTML = visibleDays.map((day) => {
    const conflictsMap = getDayScheduleConflicts(day);
    const dayStats = getDayTravelTotals(day);

    return `
      <article
        data-day-drop="${esc(day.id)}"
        class="day-article-drop group/day rounded-3xl bg-[#16171d]/75 backdrop-blur-2xl border border-white/12 shadow-2xl shadow-black/40 overflow-hidden animate-fadeUp transition-all duration-200"
      >
        <!-- Glass Day Header + Day Travel & Progress Telemetry -->
        <div class="px-4 sm:px-7 py-4 sm:py-5 bg-white/[0.04] border-b border-white/10 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-base sm:text-xl font-bold text-white tracking-tight break-words">${esc(day.title)}</h3>
                ${day.tag ? `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-400/15 border border-sky-400/25 text-sky-300 shrink-0">${esc(day.tag)}</span>` : ''}
              </div>
              <p class="text-xs sm:text-sm text-white/60 mt-0.5 break-words">${esc(day.subtitle)}</p>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button type="button" data-action="add-event" data-day="${esc(day.id)}" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white transition-colors cursor-pointer">
                ${ICONS.plus}
                <span>Add Stop</span>
              </button>
              <button type="button" data-action="edit-day" data-day="${esc(day.id)}" title="Edit Day" class="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/75 hover:text-white transition-all duration-200 opacity-100 sm:opacity-0 sm:group-hover/day:opacity-100 cursor-pointer">
                ${ICONS.edit}
              </button>
              <button type="button" data-action="delete-day" data-day="${esc(day.id)}" title="Delete Day" class="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 transition-all duration-200 opacity-100 sm:opacity-0 sm:group-hover/day:opacity-100 cursor-pointer">
                ${ICONS.trash}
              </button>
            </div>
          </div>

          <!-- Per-Day Travel Time, Distance, Completion & Conflict Pills -->
          <div class="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/30 border border-white/10 text-sky-200 font-semibold tabular-nums">
                <span class="text-sky-300">${ICONS.drive}</span>
                <span>Day Travel: ${dayStats.totalMinutes > 0 ? formatDurationLabel(dayStats.totalMinutes) : '0m'} · ${formatMiles(dayStats.totalMiles)}</span>
              </span>

              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/30 border border-white/10 text-emerald-200 font-semibold tabular-nums">
                <span class="text-emerald-300">${ICONS.check}</span>
                <span>${dayStats.completedCount}/${dayStats.totalCount} Done</span>
              </span>

              ${dayStats.conflictCount > 0 ? `
                <button
                  type="button"
                  data-action="autofit-day"
                  data-day="${esc(day.id)}"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/45 text-rose-200 font-semibold cursor-pointer transition-colors"
                >
                  <span class="text-rose-300">${ICONS.alert}</span>
                  <span>${dayStats.conflictCount} Tight ${dayStats.conflictCount === 1 ? 'Timing' : 'Timings'} · Auto-Fit</span>
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Schedule Body (Timeline OR Time Slots) -->
        <div class="p-4 sm:p-7 space-y-5">
          ${isSlotsMode
            ? renderTimeSlotsBodyHtml(day, conflictsMap)
            : `
              <div class="relative pl-3.5 sm:pl-5 space-y-3 before:content-[''] before:absolute before:left-[9px] sm:before:left-[13px] before:top-3 before:bottom-3 before:w-[2px] before:bg-gradient-to-b before:from-orange-400/75 before:via-sky-400/50 before:to-white/10">
                ${day.events.length === 0
                  ? `<p class="text-xs text-white/45 pl-4 py-4">No stops yet. Click "+ Add Stop" or drop an activity from another day here.</p>`
                  : day.events.map((ev, eIdx) => renderStopCardHtml(day, ev, eIdx, conflictsMap, { showTimelineNode: true })).join('')
                }
              </div>
            `
          }

          ${day.noteBody ? `
            <div class="group/note rounded-2xl bg-orange-500/10 border border-orange-400/25 p-3.5 sm:p-4 flex items-start justify-between gap-3">
              <div class="flex items-start gap-2.5 min-w-0 text-xs sm:text-sm text-orange-100/90 leading-relaxed break-words">
                <span class="text-orange-300 shrink-0 mt-0.5">${ICONS.info}</span>
                <div class="min-w-0"><strong class="font-bold text-orange-200">${esc(day.noteTitle || 'Tip')}:</strong> ${esc(day.noteBody)}</div>
              </div>
              <button type="button" data-action="edit-day" data-day="${esc(day.id)}" title="Edit Note" class="p-1.5 rounded-lg text-orange-200/70 hover:text-white hover:bg-white/10 shrink-0 transition-opacity duration-200 opacity-100 sm:opacity-0 sm:group-hover/note:opacity-100 cursor-pointer">${ICONS.edit}</button>
            </div>
          ` : ''}
        </div>
      </article>
    `;
  }).join('');

  // Bind all card & day action buttons
  container.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const { action, day, event, dir, slotMin } = btn.dataset;
      if (action === 'edit-day') detailHooks.openDayModal(day);
      if (action === 'delete-day') detailHooks.confirmDeleteDay(day);
      if (action === 'add-event') detailHooks.openEventModal(day, null);
      if (action === 'add-event-at-slot') detailHooks.openEventModal(day, null, Number(slotMin));
      if (action === 'edit-event') detailHooks.openEventModal(day, event);
      if (action === 'delete-event') detailHooks.deleteEvent(day, event);
      if (action === 'move-event') detailHooks.moveEvent(day, event, Number(dir));
      if (action === 'toggle-complete') toggleStopCompleted(day, event);
      if (action === 'toggle-fixed') toggleStopFixedTime(day, event);
      if (action === 'duplicate-event') duplicateEvent(day, event);
      if (action === 'copy-to-day') detailHooks.openCopyEventModal(day, event);
      if (action === 'edit-travel') detailHooks.openTravelOverrideModal(day, event);
      if (action === 'autofit-day') runAutoFitForDay(day);
    });
  });

  // Initialize Pointer Drag-and-Drop on all handles
  setupItineraryDragAndDrop(container);
}

/**
 * Render Trip Readiness Checklist
 */
export function renderChecklist() {
  const state = appStore.state;
  const { done, total, percent } = getReadinessStats();
  document.getElementById('checkCount').textContent = `${done} of ${total} complete`;
  document.getElementById('progressBadge').textContent = `${percent}%`;
  document.getElementById('progressBar').style.width = `${percent}%`;
  renderHero();

  const container = document.getElementById('checklistContainer');
  if (state.checklists.length === 0) {
    container.innerHTML = `<div class="rounded-2xl border border-dashed border-white/12 bg-black/20 p-5 text-center text-xs text-white/50">No checklist categories yet. Click "+ New Checklist" above to create one.</div>`;
    return;
  }

  container.innerHTML = state.checklists.map((group) => `
    <div class="space-y-2">
      <div class="group/cat flex items-center justify-between gap-2">
        <h4 class="text-[11px] font-bold uppercase tracking-wider text-white/50 truncate">${esc(group.title)}</h4>
        <div class="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover/cat:opacity-100 transition-opacity duration-200">
          <button type="button" data-edit-cat="${esc(group.id)}" title="Rename category" class="p-1 rounded-lg text-white/45 hover:text-sky-300 hover:bg-sky-400/15 cursor-pointer">${ICONS.edit}</button>
          <button type="button" data-del-cat="${esc(group.id)}" title="Delete category" class="p-1 rounded-lg text-white/40 hover:text-rose-300 hover:bg-rose-500/15 cursor-pointer">${ICONS.trash}</button>
        </div>
      </div>
      <div class="space-y-1">
        ${group.items.length === 0
          ? `<p class="text-[11px] text-white/40 px-2 py-1">No items yet. Add one below.</p>`
          : group.items.map((item) => `
          <div class="group flex items-start gap-2.5 p-2 rounded-xl hover:bg-white/[0.06] transition-colors">
            <button type="button" data-check-group="${esc(group.id)}" data-check-id="${esc(item.id)}" class="mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
              item.done
                ? 'bg-gradient-to-br from-orange-400 to-sky-400 border-transparent text-slate-950'
                : 'border-white/25 bg-black/30 hover:border-sky-400'
            }">${item.done ? ICONS.check : ''}</button>
            <span data-check-group="${esc(group.id)}" data-check-id="${esc(item.id)}" class="flex-1 min-w-0 break-words text-xs sm:text-sm leading-snug cursor-pointer select-none transition-colors ${
              item.done ? 'line-through text-white/35' : 'text-white/85'
            }">${esc(item.text)}</span>
            <button type="button" data-del-check-group="${esc(group.id)}" data-del-check-id="${esc(item.id)}" title="Remove item" class="p-1 rounded-lg text-white/40 hover:text-rose-300 hover:bg-rose-500/15 transition-opacity cursor-pointer shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">${ICONS.trash}</button>
          </div>
        `).join('')}
      </div>
      <form data-add-check-form="${esc(group.id)}" class="flex items-center gap-1.5 pt-1">
        <input type="text" placeholder="Add to ${esc(group.title.toLowerCase())}..." class="flex-1 min-w-0 rounded-xl border border-white/10 bg-black/35 px-3 py-1.5 text-xs text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-sky-400/40" />
        <button type="submit" class="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0">Add</button>
      </form>
    </div>
  `).join('');

  container.querySelectorAll('[data-edit-cat]').forEach((btn) => {
    btn.addEventListener('click', () => detailHooks.openChecklistCategoryModal(btn.dataset.editCat));
  });

  container.querySelectorAll('[data-del-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = state.checklists.find((g) => g.id === btn.dataset.delCat);
      if (!group) return;
      openConfirmDeleteModal({
        title: 'Delete Checklist Category',
        itemName: group.title,
        detail: `This will remove "${group.title}" and all ${group.items.length} item${group.items.length === 1 ? '' : 's'} inside it.`,
        confirmLabel: 'Yes, Delete Category',
        onConfirm: () => {
          state.checklists = state.checklists.filter((g) => g.id !== group.id);
          renderChecklist();
          scheduleCloudSave();
          showToast('Category removed');
        }
      });
    });
  });

  container.querySelectorAll('[data-check-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const group = state.checklists.find((g) => g.id === el.dataset.checkGroup);
      const item = group?.items.find((i) => i.id === el.dataset.checkId);
      if (item) {
        item.done = !item.done;
        renderChecklist();
        scheduleCloudSave();
      }
    });
  });

  container.querySelectorAll('[data-del-check-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = state.checklists.find((g) => g.id === btn.dataset.delCheckGroup);
      const item = group?.items.find((i) => i.id === btn.dataset.delCheckId);
      if (!group || !item) return;
      openConfirmDeleteModal({
        title: 'Delete Checklist Item',
        itemName: item.text,
        detail: 'Do you want to remove this item from your trip readiness checklist?',
        onConfirm: () => {
          group.items = group.items.filter((i) => i.id !== item.id);
          renderChecklist();
          scheduleCloudSave();
          showToast('Checklist item removed');
        }
      });
    });
  });

  container.querySelectorAll('[data-add-check-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const val = input.value.trim();
      if (!val) return;
      const group = state.checklists.find((g) => g.id === form.dataset.addCheckForm);
      if (group) {
        group.items.push({ id: uid('c'), text: val, done: false });
        renderChecklist();
        scheduleCloudSave();
        showToast('Added to checklist');
      }
    });
  });
}

/**
 * Render Budget Estimator (Mobile 2-Col Cost Inputs, Desktop 1-Row Layout & Itemized Drawers)
 */
export function updateRowDiffBadge(row) {
  const badgeEl = document.querySelector(`[data-diff-badge="${row.id}"]`);
  if (!badgeEl) return;
  const estVal = Number(row.estimated) || 0;
  const finVal = getItemFinalCost(row);
  if (finVal === null) {
    badgeEl.innerHTML = '';
    return;
  }
  badgeEl.classList.remove('hidden');
  const diff = finVal - estVal;
  if (diff === 0) {
    badgeEl.innerHTML = `<span class="text-[10px] font-semibold text-sky-300">Exact match</span>`;
  } else if (diff < 0) {
    badgeEl.innerHTML = `<span class="text-[10px] font-semibold text-emerald-300">−$${Math.abs(diff).toFixed(2)} saved</span>`;
  } else {
    badgeEl.innerHTML = `<span class="text-[10px] font-semibold text-rose-300">+$${diff.toFixed(2)} over</span>`;
  }
}

export function updateBudgetTotals(animateFinal = false) {
  const state = appStore.state;
  const estTotal = state.budget.items.reduce((acc, i) => acc + (Number(i.estimated) || 0), 0);
  const itemsWithFinal = state.budget.items.filter((i) => getItemFinalCost(i) !== null);
  const finTotal = itemsWithFinal.reduce((acc, i) => acc + (getItemFinalCost(i) || 0), 0);

  const fmtEst = `$${estTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtFin = `$${finTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  document.getElementById('estimatedTotal').textContent = fmtEst;
  const finalEl = document.getElementById('finalTotal');
  finalEl.textContent = fmtFin;
  if (animateFinal) {
    finalEl.classList.remove('animate-budgetPop');
    void finalEl.offsetWidth;
    finalEl.classList.add('animate-budgetPop');
  }
  document.getElementById('heroBudgetMini').innerHTML = `${fmtEst} <span class="text-[11px] font-medium text-white/60">est.</span>`;
  document.getElementById('heroFinalMini').innerHTML = `${fmtFin} <span class="text-[11px] font-medium text-sky-300/80">final</span>`;

  const diffEl = document.getElementById('budgetDiffBadge');
  if (itemsWithFinal.length === 0) {
    diffEl.className = 'text-[11px] text-white/50 mt-0.5';
    diffEl.textContent = 'Enter final costs to compare';
  } else {
    const diff = finTotal - estTotal;
    const absFmt = `$${Math.abs(diff).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (diff === 0) {
      diffEl.className = 'text-[11px] font-semibold text-sky-300 mt-0.5';
      diffEl.textContent = 'Right on estimated budget';
    } else if (diff < 0) {
      diffEl.className = 'text-[11px] font-semibold text-emerald-300 mt-0.5';
      diffEl.textContent = `${absFmt} under estimate`;
    } else {
      diffEl.className = 'text-[11px] font-semibold text-rose-300 mt-0.5';
      diffEl.textContent = `${absFmt} over estimate`;
    }
  }
}

export function renderBudget() {
  const state = appStore.state;
  const travelers = [
    { key: 'adults', label: 'Adults', sub: '18+ yrs' },
    { key: 'kids', label: 'Kids', sub: '3–17 yrs' },
    { key: 'infants', label: 'Infants', sub: 'Under 3' }
  ];

  const tContainer = document.getElementById('travelersContainer');
  tContainer.innerHTML = travelers.map((t) => `
    <div class="rounded-2xl bg-black/35 border border-white/10 p-2.5 text-center">
      <div class="text-[11px] font-semibold text-white/90">${t.label}</div>
      <div class="text-[10px] text-white/45 mb-2">${t.sub}</div>
      <div class="flex items-center justify-center gap-1.5">
        <button type="button" data-step-key="${t.key}" data-step-dir="-1" class="w-7 h-7 sm:w-6 sm:h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center cursor-pointer">−</button>
        <span class="w-5 text-sm font-bold text-white tabular-nums">${state.budget[t.key]}</span>
        <button type="button" data-step-key="${t.key}" data-step-dir="1" class="w-7 h-7 sm:w-6 sm:h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center cursor-pointer">+</button>
      </div>
    </div>
  `).join('');

  tContainer.querySelectorAll('[data-step-key]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.stepKey;
      const min = key === 'adults' ? 1 : 0;
      state.budget[key] = Math.max(min, Math.min(20, state.budget[key] + Number(btn.dataset.stepDir)));
      renderBudget();
      scheduleCloudSave();
    });
  });

  const rContainer = document.getElementById('budgetRowsContainer');
  if (state.budget.items.length === 0) {
    rContainer.innerHTML = `<div class="rounded-2xl border border-dashed border-white/12 bg-black/20 p-4 text-center text-xs text-white/50">No expenses yet. Click "+ Cost" to add one.</div>`;
  } else {
    rContainer.innerHTML = state.budget.items.map((item) => {
      const catKey = inferBudgetCategory(item);
      const catMeta = BUDGET_CATEGORY_META[catKey] || BUDGET_CATEGORY_META.custom;
      const entries = Array.isArray(item.finalEntries) ? item.finalEntries : [];
      const estVal = Number(item.estimated) || 0;
      const finVal = getItemFinalCost(item);
      const hasFinal = finVal !== null;
      const isExpanded = appStore.expandedBudgetIds.has(item.id);
      const diff = hasFinal ? finVal - estVal : null;
      const pctUsed = estVal > 0 && hasFinal ? Math.min(100, Math.round((finVal / estVal) * 100)) : 0;
      const isOver = hasFinal && estVal > 0 && finVal > estVal;

      const diffBadge = hasFinal
        ? diff === 0
          ? `<span class="text-[10px] font-semibold text-sky-300">Exact match</span>`
          : diff < 0
            ? `<span class="text-[10px] font-semibold text-emerald-300">−$${Math.abs(diff).toFixed(2)} saved</span>`
            : `<span class="text-[10px] font-semibold text-rose-300">+$${diff.toFixed(2)} over</span>`
        : '';

      return `
        <div class="group rounded-2xl border ${isExpanded ? 'border-sky-400/35 bg-white/[0.06] shadow-lg shadow-sky-950/30' : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15'} p-3 sm:p-2.5 transition-all duration-300 space-y-2.5 sm:space-y-2">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-2">
            <div class="flex items-center gap-2.5 sm:gap-2 min-w-0 flex-1">
              <span title="${esc(catMeta.label)}" class="w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 shadow-md transition-transform duration-300 group-hover:scale-105 ${catMeta.style}">
                ${ICONS[catMeta.icon]}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between sm:justify-start gap-1">
                  <span class="text-xs sm:text-sm font-medium text-white/95 truncate">${esc(item.label)}</span>
                  <div class="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button type="button" data-edit-budget="${esc(item.id)}" title="Edit expense & category" class="p-1 rounded-lg text-white/55 hover:text-sky-300 hover:bg-sky-400/15 cursor-pointer">${ICONS.edit}</button>
                    <button type="button" data-del-budget="${esc(item.id)}" title="Remove cost" class="p-1 rounded-lg text-white/45 hover:text-rose-300 hover:bg-rose-500/15 cursor-pointer">${ICONS.trash}</button>
                  </div>
                </div>
                ${item.note ? `<p class="text-[10px] text-white/45 truncate">${esc(item.note)}</p>` : ''}
              </div>
            </div>

            <div class="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-1.5 shrink-0">
              <div>
                <span class="block sm:hidden text-[10px] font-bold uppercase tracking-wider text-white/45 mb-1">Estimated</span>
                <div class="relative">
                  <span class="absolute left-2.5 sm:left-2 top-1/2 -translate-y-1/2 text-xs sm:text-[11px] text-white/40">$</span>
                  <input type="number" inputmode="decimal" min="0" step="1" value="${estVal}" data-budget-est="${esc(item.id)}" aria-label="Estimated cost for ${esc(item.label)}" class="w-full sm:w-[70px] rounded-xl border border-white/10 bg-black/40 pl-6 sm:pl-5 pr-2 sm:pr-1.5 py-1.5 text-xs font-semibold text-right text-white focus:outline-none focus:ring-2 focus:ring-orange-400/40 tabular-nums" />
                </div>
              </div>

              <div>
                <span class="block sm:hidden text-[10px] font-bold uppercase tracking-wider text-sky-300/80 mb-1">Final</span>
                ${entries.length > 0 ? `
                  <button
                    type="button"
                    data-toggle-breakdown="${esc(item.id)}"
                    title="Click to view or add itemized final costs"
                    class="w-full sm:w-[74px] rounded-xl border border-sky-400/40 bg-gradient-to-r from-sky-500/20 to-indigo-500/20 hover:from-sky-500/30 hover:to-indigo-500/30 px-2.5 sm:px-2 py-2 sm:py-1.5 text-xs font-bold text-right text-sky-100 tabular-nums transition-all duration-200 hover:scale-[1.03] active:scale-95 cursor-pointer shadow-sm shadow-sky-500/15"
                  >$${finVal.toFixed(0)}</button>
                ` : `
                  <div class="relative">
                    <span class="absolute left-2.5 sm:left-2 top-1/2 -translate-y-1/2 text-xs sm:text-[11px] text-sky-300/60">$</span>
                    <input type="number" inputmode="decimal" min="0" step="1" placeholder="—" value="${hasFinal ? finVal : ''}" data-budget-final="${esc(item.id)}" aria-label="Final cost for ${esc(item.label)}" class="w-full sm:w-[74px] rounded-xl border border-sky-400/20 bg-sky-500/10 pl-6 sm:pl-5 pr-2 sm:pr-1.5 py-1.5 text-xs font-semibold text-right text-sky-100 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-sky-400/50 tabular-nums" />
                  </div>
                `}
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2 sm:pl-10">
            <button
              type="button"
              data-toggle-breakdown="${esc(item.id)}"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 sm:py-0.5 rounded-full text-[10px] font-semibold transition-all duration-200 cursor-pointer ${
                entries.length > 0
                  ? 'bg-sky-400/15 hover:bg-sky-400/25 border border-sky-400/30 text-sky-200'
                  : 'bg-white/[0.06] hover:bg-white/15 border border-white/10 text-white/60 hover:text-white'
              }"
            >
              <span class="text-sky-300">${ICONS.receipt}</span>
              <span>${entries.length > 0 ? `${entries.length} Final Detail${entries.length === 1 ? '' : 's'}` : '+ Final Details'}</span>
              <span class="transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}">${ICONS.chevronDown}</span>
            </button>
            <div data-diff-badge="${esc(item.id)}" class="shrink-0">${diffBadge}</div>
          </div>

          ${isExpanded ? `
            <div class="mt-2 rounded-2xl bg-black/40 border border-sky-400/20 p-3 space-y-2.5 animate-slideDown">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-[10px] font-bold uppercase tracking-wider text-sky-300">Itemized Final Cost Breakdown</span>
                <span class="text-[11px] font-bold text-white tabular-nums">
                  ${hasFinal ? `$${finVal.toFixed(2)}` : '$0.00'} <span class="text-white/40 font-normal">/ $${estVal.toFixed(0)} est.</span>
                </span>
              </div>

              ${estVal > 0 && hasFinal ? `
                <div class="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div class="h-full rounded-full transition-all duration-500 ${isOver ? 'bg-gradient-to-r from-orange-400 to-rose-500' : 'bg-gradient-to-r from-emerald-400 to-sky-400'}" style="width: ${pctUsed}%;"></div>
                </div>
              ` : ''}

              <div class="space-y-1.5">
                ${entries.length === 0 ? `
                  <p class="text-[11px] text-white/45 leading-relaxed">
                    Split this final cost into individual receipts or bookings below (e.g. ${esc(catMeta.placeholder.replace(/^e\.g\.\s*/i, ''))}).
                  </p>
                ` : entries.map((entry, idx) => `
                  <div class="group/sub flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 px-2.5 py-1.5 animate-rowEnter" style="animation-delay: ${idx * 35}ms;">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-orange-400 to-sky-400 shrink-0"></span>
                      <span class="text-xs text-white/90 truncate">${esc(entry.detail)}</span>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                      <span class="text-xs font-bold text-sky-200 tabular-nums">$${(Number(entry.amount) || 0).toFixed(2)}</span>
                      <button type="button" data-del-entry-item="${esc(item.id)}" data-del-entry-id="${esc(entry.id)}" title="Remove detail" class="p-1 rounded-lg text-white/40 hover:text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer">${ICONS.close}</button>
                    </div>
                  </div>
                `).join('')}
              </div>

              <form data-add-entry-form="${esc(item.id)}" class="flex flex-wrap sm:flex-nowrap items-center gap-1.5 pt-1">
                <input
                  type="text"
                  name="detail"
                  placeholder="${esc(catMeta.placeholder)}"
                  class="w-full sm:flex-1 sm:min-w-[110px] rounded-xl border border-white/15 bg-black/50 px-2.5 py-1.5 text-xs text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                />
                <div class="relative flex-1 sm:flex-none sm:w-[82px]">
                  <span class="absolute left-2.5 sm:left-2 top-1/2 -translate-y-1/2 text-xs sm:text-[11px] text-sky-300/70">$</span>
                  <input
                    type="number"
                    inputmode="decimal"
                    name="amount"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    class="w-full rounded-xl border border-sky-400/25 bg-sky-500/10 pl-6 sm:pl-5 pr-2 py-1.5 text-xs font-semibold text-right text-sky-100 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-sky-400/50 tabular-nums"
                  />
                </div>
                <button
                  type="submit"
                  class="px-3 sm:px-2.5 py-2 sm:py-1.5 rounded-xl bg-gradient-to-r from-orange-500/90 to-sky-500/90 hover:from-orange-400 hover:to-sky-400 text-white text-xs font-semibold shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                >+ Add</button>
              </form>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  rContainer.querySelectorAll('[data-budget-est]').forEach((inp) => {
    inp.addEventListener('input', () => {
      const row = state.budget.items.find((i) => i.id === inp.dataset.budgetEst);
      if (row) {
        row.estimated = Math.max(0, Number(inp.value) || 0);
        updateRowDiffBadge(row);
        updateBudgetTotals();
        scheduleCloudSave();
      }
    });
  });

  rContainer.querySelectorAll('[data-budget-final]').forEach((inp) => {
    inp.addEventListener('input', () => {
      const row = state.budget.items.find((i) => i.id === inp.dataset.budgetFinal);
      if (row) {
        row.final = inp.value === '' ? null : Math.max(0, Number(inp.value) || 0);
        updateRowDiffBadge(row);
        updateBudgetTotals(true);
        scheduleCloudSave();
      }
    });
  });

  rContainer.querySelectorAll('[data-toggle-breakdown]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.toggleBreakdown;
      if (appStore.expandedBudgetIds.has(id)) {
        appStore.expandedBudgetIds.delete(id);
      } else {
        appStore.expandedBudgetIds.add(id);
      }
      renderBudget();
    });
  });

  rContainer.querySelectorAll('[data-add-entry-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const row = state.budget.items.find((i) => i.id === form.dataset.addEntryForm);
      if (!row) return;
      const detailInp = form.querySelector('input[name="detail"]');
      const amountInp = form.querySelector('input[name="amount"]');
      const detail = detailInp.value.trim();
      const amountRaw = amountInp.value.trim();
      if (!detail || amountRaw === '') {
        return showToast('Enter both a detail name and cost amount', 'error');
      }
      const amount = Math.max(0, Number(amountRaw) || 0);
      if (!Array.isArray(row.finalEntries)) row.finalEntries = [];
      if (row.finalEntries.length === 0 && row.final !== null && row.final !== '' && Number(row.final) > 0) {
        row.finalEntries.push({ id: uid('fe'), detail: 'Previous Final Entry', amount: Number(row.final) });
      }
      row.finalEntries.push({ id: uid('fe'), detail, amount });
      row.final = getItemFinalCost(row);
      appStore.expandedBudgetIds.add(row.id);
      renderBudget();
      updateBudgetTotals(true);
      scheduleCloudSave();
      showToast(`Added "${detail}" ($${amount.toFixed(2)})`);
    });
  });

  rContainer.querySelectorAll('[data-del-entry-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = state.budget.items.find((i) => i.id === btn.dataset.delEntryItem);
      if (!row || !Array.isArray(row.finalEntries)) return;
      row.finalEntries = row.finalEntries.filter((e) => e.id !== btn.dataset.delEntryId);
      row.final = row.finalEntries.length > 0 ? getItemFinalCost(row) : null;
      renderBudget();
      updateBudgetTotals(true);
      scheduleCloudSave();
      showToast('Final cost detail removed');
    });
  });

  rContainer.querySelectorAll('[data-edit-budget]').forEach((btn) => {
    btn.addEventListener('click', () => detailHooks.openBudgetModal(btn.dataset.editBudget));
  });

  rContainer.querySelectorAll('[data-del-budget]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = state.budget.items.find((i) => i.id === btn.dataset.delBudget);
      if (!item) return;
      openConfirmDeleteModal({
        title: 'Delete Budget Expense',
        itemName: `${item.label} ($${Number(item.estimated) || 0} est.)`,
        detail: 'Do you want to remove this expense from your budget estimator?',
        onConfirm: () => {
          state.budget.items = state.budget.items.filter((i) => i.id !== item.id);
          appStore.expandedBudgetIds.delete(item.id);
          renderBudget();
          scheduleCloudSave();
          showToast('Budget item removed');
        }
      });
    });
  });

  updateBudgetTotals();
}

/**
 * Render Personal Trip Notes
 */
export function renderNotes() {
  const el = document.getElementById('notesInput');
  el.value = appStore.state.notes;
  document.getElementById('notesMeta').textContent = `${appStore.state.notes.length} characters`;
}

/**
 * Render Official Links & Visitor Info Cards
 */
export function renderLinks() {
  const state = appStore.state;
  const container = document.getElementById('linksContainer');
  if (state.links.length === 0) {
    container.innerHTML = `<div class="rounded-2xl border border-dashed border-white/12 bg-black/20 p-4 text-center text-xs text-white/50">No links yet. Click "+ Link" to add a destination website, hours, and tips.</div>`;
    return;
  }

  container.innerHTML = state.links.map((lk) => {
    const meta = LINK_ICON_META[lk.icon] || LINK_ICON_META.web;
    return `
      <div class="group/link relative rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-sky-400/35 p-3 transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-black/20">
        <div class="flex items-start gap-2.5">
          <a href="${esc(lk.url)}" target="_blank" rel="noopener noreferrer" title="Open ${esc(lk.label)}" class="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 shadow-md transition-transform duration-200 group-hover/link:scale-105 ${meta.style}">
            ${ICONS[meta.icon]}
          </a>

          <div class="min-w-0 flex-1 space-y-1.5">
            <div class="flex items-start justify-between gap-1.5">
              <a href="${esc(lk.url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white hover:text-sky-300 transition-colors leading-snug min-w-0">
                <span class="truncate">${esc(lk.label)}</span>
                <span class="opacity-60 shrink-0">${ICONS.link}</span>
              </a>
              <div class="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover/link:opacity-100 transition-opacity duration-200">
                <button type="button" data-edit-link="${esc(lk.id)}" title="Edit link details" class="p-1 rounded-lg text-white/55 hover:text-sky-300 hover:bg-sky-400/15 cursor-pointer">${ICONS.edit}</button>
                <button type="button" data-del-link="${esc(lk.id)}" title="Remove link" class="p-1 rounded-lg text-white/45 hover:text-rose-300 hover:bg-rose-500/15 cursor-pointer">${ICONS.trash}</button>
              </div>
            </div>

            ${(lk.location || lk.hours) ? `
              <div class="flex flex-col gap-1 text-[11px] text-white/70">
                ${lk.location ? `
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="text-sky-300/85 shrink-0">${ICONS.pin}</span>
                    <span class="truncate">${esc(lk.location)}</span>
                  </div>
                ` : ''}
                ${lk.hours ? `
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="text-amber-300/85 shrink-0">${ICONS.clock}</span>
                    <span class="truncate">${esc(lk.hours)}</span>
                  </div>
                ` : ''}
              </div>
            ` : ''}

            ${lk.info ? `
              <p class="text-[11px] text-white/55 leading-relaxed bg-black/25 border border-white/8 rounded-xl px-2.5 py-1.5 break-words">
                ${esc(lk.info)}
              </p>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-edit-link]').forEach((btn) => {
    btn.addEventListener('click', () => detailHooks.openLinkModal(btn.dataset.editLink));
  });

  container.querySelectorAll('[data-del-link]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const linkObj = state.links.find((l) => l.id === btn.dataset.delLink);
      if (!linkObj) return;
      openConfirmDeleteModal({
        title: 'Delete Official Link',
        itemName: linkObj.label,
        detail: 'Do you want to remove this link from your official links panel?',
        onConfirm: () => {
          state.links = state.links.filter((l) => l.id !== linkObj.id);
          renderLinks();
          scheduleCloudSave();
          showToast('Link removed');
        }
      });
    });
  });
}

/**
 * Master Render Function (Refreshes All Dashboard Sections)
 */
export function renderAll() {
  renderHero();
  renderForecastStrip();
  renderCarousel();
  renderItinerary();
  renderChecklist();
  renderBudget();
  renderNotes();
  renderLinks();
}

/**
 * ============================================================================
 * GLASSMORPHISM SPATIAL PDF ENGINE
 * ============================================================================
 */
function loadImageForCanvas(url, timeoutMs = 4500) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    let settled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    img.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

async function createSpatialBackdropDataUrl(primaryUrl, fallbackUrl) {
  const canvas = document.createElement('canvas');
  canvas.width = 1224;
  canvas.height = 1584;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0d1018';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let img = await loadImageForCanvas(primaryUrl);
  if (!img && fallbackUrl && fallbackUrl !== primaryUrl) {
    img = await loadImageForCanvas(fallbackUrl);
  }

  if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
    const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const dx = (canvas.width - drawW) / 2;
    const dy = (canvas.height - drawH) / 2;

    ctx.save();
    if ('filter' in ctx) {
      ctx.filter = 'blur(2.5px) saturate(1.12) contrast(1.04)';
    }
    ctx.drawImage(img, dx - 12, dy - 12, drawW + 24, drawH + 24);
    ctx.restore();
  } else {
    const fallbackGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    fallbackGrad.addColorStop(0, '#131b2e');
    fallbackGrad.addColorStop(0.45, '#171d2c');
    fallbackGrad.addColorStop(1, '#090c14');
    ctx.fillStyle = fallbackGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const scrim = ctx.createLinearGradient(0, 0, 0, canvas.height);
  scrim.addColorStop(0, 'rgba(6, 9, 16, 0.50)');
  scrim.addColorStop(0.42, 'rgba(8, 11, 18, 0.42)');
  scrim.addColorStop(0.82, 'rgba(10, 13, 20, 0.78)');
  scrim.addColorStop(1, 'rgba(8, 10, 16, 0.92)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const warmGlow = ctx.createRadialGradient(canvas.width * 0.14, canvas.height * 0.1, 20, canvas.width * 0.14, canvas.height * 0.1, 520);
  warmGlow.addColorStop(0, 'rgba(251, 146, 60, 0.22)');
  warmGlow.addColorStop(1, 'rgba(251, 146, 60, 0)');
  ctx.fillStyle = warmGlow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const skyGlow = ctx.createRadialGradient(canvas.width * 0.88, canvas.height * 0.24, 20, canvas.width * 0.88, canvas.height * 0.24, 560);
  skyGlow.addColorStop(0, 'rgba(56, 189, 248, 0.20)');
  skyGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = skyGlow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', 0.86);
}

async function createRoundedThumbDataUrl(url, fallbackUrl, w = 240, h = 136, radius = 22) {
  let img = await loadImageForCanvas(url, 3200);
  if (!img && fallbackUrl && fallbackUrl !== url) {
    img = await loadImageForCanvas(fallbackUrl, 3200);
  }
  if (!img || !img.naturalWidth) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(w - radius, 0);
  ctx.quadraticCurveTo(w, 0, w, radius);
  ctx.lineTo(w, h - radius);
  ctx.quadraticCurveTo(w, h, w - radius, h);
  ctx.lineTo(radius, h);
  ctx.quadraticCurveTo(0, h, 0, h - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.clip();

  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(0,0,0,0.08)');
  grad.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.32)';
  ctx.lineWidth = 3;
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

function setPdfAlpha(doc, alpha) {
  if (doc.GState && doc.setGState) {
    doc.setGState(new doc.GState({ opacity: alpha }));
  }
}

function drawGlassCard(doc, x, y, w, h, r = 14, opts = {}) {
  const {
    fillRgb = [18, 21, 30],
    fillAlpha = 0.72,
    tintAlpha = 0.05,
    borderRgb = [255, 255, 255],
    borderAlpha = 0.20,
    borderWidth = 0.85,
    topSheen = true
  } = opts;

  setPdfAlpha(doc, fillAlpha);
  doc.setFillColor(fillRgb[0], fillRgb[1], fillRgb[2]);
  doc.roundedRect(x, y, w, h, r, r, 'F');

  if (tintAlpha > 0) {
    setPdfAlpha(doc, tintAlpha);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, w, h, r, r, 'F');
  }

  if (topSheen && w > 40) {
    setPdfAlpha(doc, 0.22);
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.75);
    doc.line(x + r, y + 0.6, x + w - r, y + 0.6);
  }

  setPdfAlpha(doc, borderAlpha);
  doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
  doc.setLineWidth(borderWidth);
  doc.roundedRect(x, y, w, h, r, r, 'S');

  setPdfAlpha(doc, 1);
}

function drawGradientBar(doc, x, y, w, h, steps = 28) {
  if (w <= 0) return;
  const segW = w / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / Math.max(1, steps - 1);
    const r = Math.round(251 + (56 - 251) * t);
    const g = Math.round(146 + (189 - 146) * t);
    const b = Math.round(60 + (248 - 60) * t);
    doc.setFillColor(r, g, b);
    doc.rect(x + i * segW, y, segW + 0.5, h, 'F');
  }
}

function drawGlassPill(doc, x, y, text, opts = {}) {
  const {
    bgRgb = [255, 255, 255],
    bgAlpha = 0.14,
    borderRgb = [255, 255, 255],
    borderAlpha = 0.26,
    textRgb = [255, 255, 255],
    fontSize = 7.5,
    padX = 8,
    height = 16
  } = opts;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  const textW = doc.getTextWidth(text);
  const pillW = textW + padX * 2;

  setPdfAlpha(doc, bgAlpha);
  doc.setFillColor(bgRgb[0], bgRgb[1], bgRgb[2]);
  doc.roundedRect(x, y, pillW, height, height / 2, height / 2, 'F');

  setPdfAlpha(doc, borderAlpha);
  doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
  doc.setLineWidth(0.6);
  doc.roundedRect(x, y, pillW, height, height / 2, height / 2, 'S');

  setPdfAlpha(doc, 1);
  doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
  doc.text(text, x + padX, y + height / 2 + fontSize * 0.34);

  return pillW;
}

function pdfSafeText(str) {
  return String(str ?? '')
    .replace(/·/g, '•')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/−/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

export async function buildTripPdfDocument(onProgress = () => {}) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error('PDF library not loaded');
  }

  const state = appStore.state;
  const activeDay = state.days[appStore.activeCarouselIndex] || state.days[0];
  const themeKey = resolveSceneForDay(activeDay);
  const activeBgUrl = appStore.currentBackdropUrl || activeDay?.resolvedBgPhoto || REAL_THEME_BACKDROPS[themeKey] || REAL_THEME_BACKDROPS.lights;
  const fallbackBgUrl = REAL_THEME_BACKDROPS[themeKey] || REAL_THEME_BACKDROPS.lights;

  onProgress(18, 'Capturing your live landscape backdrop...', 1);
  const backdropDataUrl = await createSpatialBackdropDataUrl(activeBgUrl, fallbackBgUrl);

  onProgress(38, 'Styling destination spotlight glass cards...', 2);
  const dayThumbs = await Promise.all(
    state.days.map((d) => {
      const fallbackCard = REAL_CARD_BACKDROPS[resolveSceneForDay(d)] || REAL_CARD_BACKDROPS.desert;
      return createRoundedThumbDataUrl(getCardPhotoUrl(d), fallbackCard);
    })
  );

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentW = pageW - margin * 2;
  let y = 36;

  const paintPageBackdrop = (isFirstPage = false) => {
    doc.addImage(backdropDataUrl, 'JPEG', 0, 0, pageW, pageH, 'spatial-backdrop', 'FAST');

    if (!isFirstPage) {
      drawGlassCard(doc, margin, 22, contentW, 24, 12, {
        fillRgb: [12, 16, 24],
        fillAlpha: 0.62,
        borderAlpha: 0.16,
        topSheen: false
      });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(125, 211, 252);
      doc.text('SPATIAL TRIPOS', margin + 12, 36.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(226, 232, 240);
      doc.text(pdfSafeText(state.meta.title || 'Trip Itinerary'), margin + 88, 36.5, { maxWidth: contentW - 140 });
    }
  };

  const ensureSpace = (needed = 70) => {
    if (y + needed > pageH - 46) {
      doc.addPage();
      paintPageBackdrop(false);
      y = 60;
      return true;
    }
    return false;
  };

  // ==================== PAGE 1: SPATIAL GLASS HERO ====================
  paintPageBackdrop(true);
  onProgress(60, 'Rendering frosted glass itinerary & timeline...', 2);

  const estTotalNum = state.budget.items.reduce((acc, i) => acc + (Number(i.estimated) || 0), 0);
  const finTotalNum = state.budget.items.reduce((acc, i) => acc + (getItemFinalCost(i) || 0), 0);
  const estTotalFmt = `$${estTotalNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const finTotalFmt = `$${finTotalNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const readiness = getReadinessStats();
  const tripTravel = getTripTravelTotals();

  const subText = pdfSafeText(state.meta.subtitle || '');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const subLines = doc.splitTextToSize(subText, contentW - 44).slice(0, 3);
  const heroH = 128 + subLines.length * 12;

  drawGlassCard(doc, margin, y, contentW, heroH, 18, {
    fillRgb: [16, 19, 28],
    fillAlpha: 0.72,
    tintAlpha: 0.07,
    borderAlpha: 0.28
  });

  drawGradientBar(doc, margin + 20, y + 1, contentW - 40, 2.5);

  let heroPillX = margin + 20;
  heroPillX += drawGlassPill(doc, heroPillX, y + 16, 'SPATIAL TRIPOS • TRAVEL PLAN', {
    bgRgb: [56, 189, 248],
    bgAlpha: 0.18,
    borderRgb: [125, 211, 252],
    borderAlpha: 0.42,
    textRgb: [186, 230, 253],
    fontSize: 7.2
  }) + 8;

  if (activeDay?.location) {
    heroPillX += drawGlassPill(doc, heroPillX, y + 16, pdfSafeText(`${activeDay.location} • ${activeDay.temp || '72°F'}`), {
      bgRgb: [251, 146, 60],
      bgAlpha: 0.18,
      borderRgb: [253, 186, 116],
      borderAlpha: 0.42,
      textRgb: [254, 215, 170],
      fontSize: 7.2
    }) + 8;
  }

  if (tripTravel.totalMinutes > 0 || tripTravel.totalMiles > 0) {
    drawGlassPill(doc, heroPillX, y + 16, pdfSafeText(`TRAVEL • ${formatDurationLabel(tripTravel.totalMinutes)} • ${formatMiles(tripTravel.totalMiles)}`), {
      bgRgb: [52, 211, 153],
      bgAlpha: 0.16,
      borderRgb: [110, 231, 183],
      borderAlpha: 0.38,
      textRgb: [167, 243, 208],
      fontSize: 7.0
    });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.setTextColor(255, 255, 255);
  doc.text(pdfSafeText(state.meta.title || 'Trip Itinerary'), margin + 20, y + 58, { maxWidth: contentW - 40 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(215, 224, 238);
  doc.text(subLines, margin + 20, y + 76);

  const kpiY = y + 84 + subLines.length * 12;
  const kpiGap = 8;
  const kpiW = (contentW - 40 - kpiGap * 3) / 4;
  const kpiH = 38;
  const kpis = [
    { label: 'TRIP LENGTH', val: state.meta.tripLength || '-', accent: [251, 146, 60] },
    { label: 'DEPARTURE', val: state.meta.firstDeparture || '-', accent: [56, 189, 248] },
    { label: 'ESTIMATED TOTAL', val: estTotalFmt, accent: [251, 191, 36] },
    { label: `READY • ${readiness.percent}%`, val: `${finTotalFmt} final`, accent: [52, 211, 153] }
  ];

  kpis.forEach((k, idx) => {
    const kx = margin + 20 + idx * (kpiW + kpiGap);
    drawGlassCard(doc, kx, kpiY, kpiW, kpiH, 9, {
      fillRgb: [8, 11, 18],
      fillAlpha: 0.55,
      tintAlpha: 0.04,
      borderAlpha: 0.16,
      topSheen: false
    });
    doc.setFillColor(k.accent[0], k.accent[1], k.accent[2]);
    doc.circle(kx + 10, kpiY + 11.5, 2.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(148, 163, 184);
    doc.text(pdfSafeText(k.label), kx + 16, kpiY + 13.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(pdfSafeText(k.val), kx + 9, kpiY + 29, { maxWidth: kpiW - 16 });
  });

  y += heroH + 14;

  // Frosted Forecast & Day Overview Strip
  if (state.days.length > 0) {
    const maxStripDays = Math.min(state.days.length, 5);
    const stripGap = 8;
    const cardW = (contentW - stripGap * (maxStripDays - 1)) / maxStripDays;
    const stripH = 54;
    ensureSpace(stripH + 16);

    for (let i = 0; i < maxStripDays; i++) {
      const d = state.days[i];
      const cx = margin + i * (cardW + stripGap);
      const isFocus = i === appStore.activeCarouselIndex;
      drawGlassCard(doc, cx, y, cardW, stripH, 11, {
        fillRgb: isFocus ? [30, 38, 54] : [16, 19, 28],
        fillAlpha: isFocus ? 0.78 : 0.64,
        tintAlpha: isFocus ? 0.09 : 0.04,
        borderRgb: isFocus ? [125, 211, 252] : [255, 255, 255],
        borderAlpha: isFocus ? 0.45 : 0.18
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text(pdfSafeText(d.temp || '72°F'), cx + 10, y + 20);

      doc.setFillColor(isFocus ? 56 : 251, isFocus ? 189 : 146, isFocus ? 248 : 60);
      doc.circle(cx + cardW - 12, y + 15, 2.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(186, 230, 253);
      doc.text(pdfSafeText(`${d.shortDay || `DAY ${i + 1}`} • ${d.shortDate || ''}`), cx + 10, y + 34, { maxWidth: cardW - 18 });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(203, 213, 225);
      doc.text(pdfSafeText(d.location || ''), cx + 10, y + 45, { maxWidth: cardW - 18 });
    }

    y += stripH + 18;
  }

  // ==================== DAY-BY-DAY FROSTED GLASS ITINERARY ====================
  state.days.forEach((day, dIdx) => {
    ensureSpace(125);
    const dayStats = getDayTravelTotals(day);

    const thumbData = dayThumbs[dIdx];
    const headerH = 62;
    drawGlassCard(doc, margin, y, contentW, headerH, 14, {
      fillRgb: [18, 23, 35],
      fillAlpha: 0.80,
      tintAlpha: 0.07,
      borderRgb: [125, 211, 252],
      borderAlpha: 0.28
    });

    drawGradientBar(doc, margin + 1, y + 10, 3, headerH - 20, 10);

    const textMaxW = thumbData ? contentW - 126 : contentW - 30;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(255, 255, 255);
    doc.text(pdfSafeText(day.title || `Day ${dIdx + 1}`), margin + 16, y + 22, { maxWidth: textMaxW });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    doc.text(pdfSafeText(day.subtitle || ''), margin + 16, y + 35, { maxWidth: textMaxW });

    let pillX = margin + 16;
    if (day.location) {
      pillX += drawGlassPill(doc, pillX, y + 41, pdfSafeText(`${day.location} • ${day.temp || ''}`), {
        bgRgb: [56, 189, 248],
        bgAlpha: 0.18,
        borderRgb: [125, 211, 252],
        borderAlpha: 0.35,
        textRgb: [186, 230, 253],
        fontSize: 6.8,
        height: 14,
        padX: 7
      }) + 6;
    }
    if (day.tag) {
      pillX += drawGlassPill(doc, pillX, y + 41, pdfSafeText(day.tag), {
        bgRgb: [255, 255, 255],
        bgAlpha: 0.12,
        borderRgb: [255, 255, 255],
        borderAlpha: 0.22,
        textRgb: [241, 245, 249],
        fontSize: 6.8,
        height: 14,
        padX: 7
      }) + 6;
    }
    if (dayStats.totalMinutes > 0 || dayStats.totalMiles > 0) {
      drawGlassPill(doc, pillX, y + 41, pdfSafeText(`Travel: ${formatDurationLabel(dayStats.totalMinutes)} • ${formatMiles(dayStats.totalMiles)}`), {
        bgRgb: [52, 211, 153],
        bgAlpha: 0.15,
        borderRgb: [110, 231, 183],
        borderAlpha: 0.32,
        textRgb: [167, 243, 208],
        fontSize: 6.6,
        height: 14,
        padX: 7
      });
    }

    if (thumbData) {
      try {
        doc.addImage(thumbData, 'PNG', margin + contentW - 98, y + 7, 86, 48);
      } catch (e) {}
    }

    y += headerH + 8;

    day.events.forEach((ev, eIdx) => {
      const cat = getCategoryMeta(ev.category);
      const evText = pdfSafeText(`${ev.completed ? '[Done] ' : ''}${ev.text || ''}`);
      const evMapUrl = getStopMapUrl(ev.location);
      const evLocLabel = evMapUrl ? pdfSafeText(`Map: ${getStopLocationLabel(ev.location)}`) : '';
      const leg = eIdx > 0 ? getLegTravelInfo(day, eIdx) : null;
      const legLabel = leg && (leg.minutes > 0 || leg.miles > 0)
        ? pdfSafeText(`Transit: ${formatDurationLabel(leg.minutes)}${leg.miles > 0 ? ` • ${formatMiles(leg.miles)}` : ''} (${leg.mode})`)
        : '';

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      const textLines = doc.splitTextToSize(evText, contentW - 144);
      const extraLines = (evMapUrl ? 12 : 0) + (legLabel ? 11 : 0);
      const rowH = Math.max(30, textLines.length * 11.5 + 14 + extraLines);

      ensureSpace(rowH + 6);

      const railX = margin + 10;
      setPdfAlpha(doc, 0.38);
      doc.setDrawColor(125, 211, 252);
      doc.setLineWidth(1.2);
      if (eIdx < day.events.length - 1) {
        doc.line(railX, y + 14, railX, y + rowH + 6);
      }
      setPdfAlpha(doc, 1);
      doc.setFillColor(cat.rgb[0], cat.rgb[1], cat.rgb[2]);
      doc.circle(railX, y + 14, 3.2, 'F');

      drawGlassCard(doc, margin + 22, y, contentW - 22, rowH, 10, {
        fillRgb: [16, 20, 30],
        fillAlpha: 0.64,
        tintAlpha: 0.04,
        borderRgb: ev.fixedTime ? [251, 191, 36] : [255, 255, 255],
        borderAlpha: ev.fixedTime ? 0.30 : 0.14,
        topSheen: false
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(253, 186, 116);
      doc.text(pdfSafeText(`${ev.time || ''}${ev.fixedTime ? ' [Fixed]' : ''}`), margin + 32, y + 14, { maxWidth: 96 });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.3);
      doc.setTextColor(cat.rgb[0], cat.rgb[1], cat.rgb[2]);
      doc.text(pdfSafeText(cat.label.toUpperCase()), margin + 32, y + 23.5, { maxWidth: 96 });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      doc.setTextColor(241, 245, 249);
      doc.text(textLines, margin + 132, y + 14);

      let metaY = y + 14 + textLines.length * 11.5 + 1;
      if (legLabel) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(148, 163, 184);
        doc.text(legLabel, margin + 132, metaY);
        metaY += 11;
      }

      if (evMapUrl) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.6);
        doc.setTextColor(125, 211, 252);
        const locTrunc = doc.splitTextToSize(evLocLabel, contentW - 148)[0] || evLocLabel;
        doc.text(locTrunc, margin + 132, metaY);
        doc.link(margin + 130, metaY - 8, Math.min(doc.getTextWidth(locTrunc) + 6, contentW - 144), 11, { url: evMapUrl });
      }

      y += rowH + 5;
    });

    if (day.noteBody) {
      const noteFull = pdfSafeText(`${day.noteTitle || 'Tip'}: ${day.noteBody}`);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.3);
      const noteLines = doc.splitTextToSize(noteFull, contentW - 44);
      const boxH = noteLines.length * 11 + 16;
      ensureSpace(boxH + 12);

      drawGlassCard(doc, margin + 22, y + 2, contentW - 22, boxH, 10, {
        fillRgb: [46, 26, 14],
        fillAlpha: 0.72,
        tintAlpha: 0.04,
        borderRgb: [251, 146, 60],
        borderAlpha: 0.42,
        topSheen: false
      });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.3);
      doc.setTextColor(254, 215, 170);
      doc.text(noteLines, margin + 34, y + 14);
      y += boxH + 16;
    } else {
      y += 12;
    }
  });

  // ==================== BUDGET COMPARISON GLASS MODULE ====================
  onProgress(78, 'Crafting glass budget, checklist & links...', 3);
  const budgetHeaderH = 62;
  ensureSpace(160);

  const estimatedRowsH = state.budget.items.reduce((sum, it) => {
    const subCount = Array.isArray(it.finalEntries) ? it.finalEntries.length : 0;
    return sum + (it.note ? 28 : 20) + (subCount * 12);
  }, 0);
  const totalBudgetCardH = budgetHeaderH + estimatedRowsH + 54;

  if (y + totalBudgetCardH <= pageH - 46) {
    drawGlassCard(doc, margin, y, contentW, totalBudgetCardH, 16, {
      fillRgb: [16, 19, 28],
      fillAlpha: 0.76,
      tintAlpha: 0.06,
      borderAlpha: 0.24
    });
  } else {
    drawGlassCard(doc, margin, y, contentW, 56, 14, {
      fillRgb: [16, 19, 28],
      fillAlpha: 0.76,
      tintAlpha: 0.06,
      borderAlpha: 0.24
    });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(56, 189, 248);
  doc.text('UTILITIES • FINANCE', margin + 18, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('Budget Estimator (Estimated vs. Final)', margin + 18, y + 34);

  drawGlassPill(
    doc,
    margin + contentW - 196,
    y + 18,
    pdfSafeText(`${state.budget.adults} Adults • ${state.budget.kids} Kids • ${state.budget.infants} Infant`),
    {
      bgRgb: [255, 255, 255],
      bgAlpha: 0.12,
      borderAlpha: 0.22,
      textRgb: [226, 232, 240],
      fontSize: 7,
      height: 16
    }
  );

  y += 50;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(148, 163, 184);
  doc.text('EXPENSE & DETAILS', margin + 18, y);
  doc.text('ESTIMATED', margin + contentW - 104, y, { align: 'right' });
  doc.setTextColor(125, 211, 252);
  doc.text('FINAL', margin + contentW - 18, y, { align: 'right' });

  setPdfAlpha(doc, 0.16);
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.7);
  doc.line(margin + 18, y + 5, margin + contentW - 18, y + 5);
  setPdfAlpha(doc, 1);
  y += 16;

  state.budget.items.forEach((item) => {
    const finVal = getItemFinalCost(item);
    const hasFin = finVal !== null;
    const subEntries = Array.isArray(item.finalEntries) ? item.finalEntries : [];
    const baseRowH = item.note ? 28 : 20;
    const rowH = baseRowH + subEntries.length * 12;
    if (ensureSpace(rowH + 12)) {
      drawGlassCard(doc, margin, y - 6, contentW, rowH + 8, 8, {
        fillRgb: [16, 19, 28],
        fillAlpha: 0.72,
        borderAlpha: 0.15,
        topSheen: false
      });
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(248, 250, 252);
    doc.text(pdfSafeText(item.label || ''), margin + 18, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(226, 232, 240);
    doc.text(`$${(Number(item.estimated) || 0).toFixed(2)}`, margin + contentW - 104, y, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    if (hasFin) {
      doc.setTextColor(125, 211, 252);
      doc.text(`$${finVal.toFixed(2)}`, margin + contentW - 18, y, { align: 'right' });
    } else {
      doc.setTextColor(100, 116, 139);
      doc.text('-', margin + contentW - 18, y, { align: 'right' });
    }

    let subY = y + 10.5;
    if (item.note) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.6);
      doc.setTextColor(148, 163, 184);
      doc.text(pdfSafeText(item.note), margin + 18, subY, { maxWidth: contentW - 210 });
      subY += 11.5;
    }

    if (subEntries.length > 0) {
      subEntries.forEach((entry) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.4);
        doc.setTextColor(186, 230, 253);
        doc.text(pdfSafeText(`• ${entry.detail}`), margin + 28, subY, { maxWidth: contentW - 160 });
        doc.setFont('helvetica', 'bold');
        doc.text(`$${(Number(entry.amount) || 0).toFixed(2)}`, margin + contentW - 18, subY, { align: 'right' });
        subY += 12;
      });
    }
    y += rowH;
  });

  ensureSpace(46);
  setPdfAlpha(doc, 0.22);
  doc.setDrawColor(255, 255, 255);
  doc.line(margin + 18, y, margin + contentW - 18, y);
  setPdfAlpha(doc, 1);

  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(226, 232, 240);
  doc.text('Estimated Total', margin + 18, y);
  doc.text(estTotalFmt, margin + contentW - 18, y, { align: 'right' });

  y += 16;
  doc.setFontSize(11);
  doc.setTextColor(253, 186, 116);
  doc.text('Final Cost', margin + 18, y);
  doc.setTextColor(125, 211, 252);
  doc.text(finTotalFmt, margin + contentW - 18, y, { align: 'right' });

  y += 28;

  // ==================== READINESS CHECKLIST GLASS MODULE ====================
  ensureSpace(100);
  drawGlassCard(doc, margin, y, contentW, 46, 14, {
    fillRgb: [16, 19, 28],
    fillAlpha: 0.78,
    tintAlpha: 0.06,
    borderAlpha: 0.24
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(56, 189, 248);
  doc.text('READINESS CHECKLIST', margin + 16, y + 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(`Trip Checklist (${readiness.done} of ${readiness.total} complete)`, margin + 16, y + 30);

  const barW = 140;
  const barX = margin + contentW - barW - 16;
  const barY = y + 20;
  setPdfAlpha(doc, 0.16);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(barX, barY, barW, 7, 3.5, 3.5, 'F');
  setPdfAlpha(doc, 1);
  if (readiness.percent > 0) {
    drawGradientBar(doc, barX, barY, Math.max(8, (barW * readiness.percent) / 100), 7, 16);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(186, 230, 253);
  doc.text(`${readiness.percent}%`, barX + barW, barY - 4, { align: 'right' });

  y += 54;

  state.checklists.forEach((grp) => {
    const rowsCount = Math.ceil(grp.items.length / 2);
    const grpH = 26 + rowsCount * 16 + 10;
    ensureSpace(Math.min(grpH, 90));

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(253, 186, 116);
    doc.text(pdfSafeText(grp.title.toUpperCase()), margin + 6, y + 8);
    y += 14;

    const colW = (contentW - 10) / 2;
    for (let i = 0; i < grp.items.length; i += 2) {
      ensureSpace(22);
      const pair = [grp.items[i], grp.items[i + 1]].filter(Boolean);
      pair.forEach((it, colIdx) => {
        const ix = margin + colIdx * (colW + 10);
        drawGlassCard(doc, ix, y, colW, 18, 7, {
          fillRgb: [14, 18, 28],
          fillAlpha: 0.66,
          tintAlpha: 0.03,
          borderAlpha: it.done ? 0.28 : 0.14,
          borderRgb: it.done ? [56, 189, 248] : [255, 255, 255],
          topSheen: false
        });

        if (it.done) {
          doc.setFillColor(56, 189, 248);
          doc.roundedRect(ix + 7, y + 4.5, 9, 9, 2.5, 2.5, 'F');
          doc.setDrawColor(15, 23, 42);
          doc.setLineWidth(1.3);
          doc.line(ix + 9.2, y + 9.2, ix + 11, y + 11);
          doc.line(ix + 11, y + 11, ix + 14.2, y + 7);
        } else {
          setPdfAlpha(doc, 0.35);
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(0.8);
          doc.roundedRect(ix + 7, y + 4.5, 9, 9, 2.5, 2.5, 'S');
          setPdfAlpha(doc, 1);
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(it.done ? 148 : 241, it.done ? 163 : 245, it.done ? 184 : 249);
        const labelTrunc = doc.splitTextToSize(pdfSafeText(it.text), colW - 26)[0] || '';
        doc.text(labelTrunc, ix + 21, y + 11.5);
      });
      y += 22;
    }
    y += 8;
  });

  // ==================== PERSONAL TRIP NOTES GLASS CARD ====================
  if (state.notes.trim()) {
    const noteLines = doc.splitTextToSize(pdfSafeText(state.notes.trim()), contentW - 36);
    const noteCardH = noteLines.length * 12 + 42;
    ensureSpace(Math.min(noteCardH + 12, 130));

    drawGlassCard(doc, margin, y, contentW, noteCardH, 14, {
      fillRgb: [16, 19, 28],
      fillAlpha: 0.76,
      tintAlpha: 0.06,
      borderAlpha: 0.22
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(56, 189, 248);
    doc.text('PERSONAL NOTES', margin + 18, y + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(255, 255, 255);
    doc.text('Trip Notes & Confirmations', margin + 18, y + 30);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);
    doc.setTextColor(226, 232, 240);
    doc.text(noteLines, margin + 18, y + 44);
    y += noteCardH + 14;
  }

  // ==================== OFFICIAL LINKS & VISITOR INFO (CLICKABLE) ====================
  if (state.links.length > 0) {
    ensureSpace(75);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(56, 189, 248);
    doc.text('NETWORK • WEB', margin + 6, y + 8);
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('Official Links & Visitor Info', margin + 6, y + 22);
    y += 30;

    state.links.forEach((lk) => {
      const metaLine = pdfSafeText([lk.location, lk.hours].filter(Boolean).join('  •  '));
      const infoLines = lk.info ? doc.splitTextToSize(pdfSafeText(lk.info), contentW - 36) : [];
      const cardH = 34 + (metaLine ? 12 : 0) + (infoLines.length * 10.5) + (infoLines.length ? 4 : 0);
      ensureSpace(cardH + 8);

      drawGlassCard(doc, margin, y, contentW, cardH, 11, {
        fillRgb: [16, 20, 30],
        fillAlpha: 0.72,
        tintAlpha: 0.05,
        borderAlpha: 0.18,
        topSheen: false
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(255, 255, 255);
      doc.text(pdfSafeText(lk.label || ''), margin + 14, y + 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(125, 211, 252);
      const urlStr = pdfSafeText(lk.url || '');
      doc.text(urlStr, margin + 14, y + 26, { maxWidth: contentW - 28 });
      if (lk.url) {
        doc.link(margin + 10, y + 4, contentW - 20, 26, { url: lk.url });
      }

      let innerY = y + 37;
      if (metaLine) {
        doc.setFontSize(7.8);
        doc.setTextColor(253, 186, 116);
        doc.text(metaLine, margin + 14, innerY, { maxWidth: contentW - 28 });
        innerY += 12;
      }
      if (infoLines.length) {
        doc.setFontSize(7.8);
        doc.setTextColor(203, 213, 225);
        doc.text(infoLines, margin + 14, innerY);
      }

      y += cardH + 7;
    });
  }

  // ==================== PAGE NUMBERS & SPATIAL FOOTER ====================
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    setPdfAlpha(doc, 0.55);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    doc.text('Plan With Joy • Travel With Ease • Spatial TripOS', margin, pageH - 20);
    doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 20, { align: 'right' });
    setPdfAlpha(doc, 1);
  }

  onProgress(100, 'Your Glassmorphism Trip PDF is Ready!', 3);
  return doc;
}

/**
 * Animated Save Trip PDF Modal Flow with Live Theme Preview & Re-Download
 */
export async function openSavePdfFlow() {
  const state = appStore.state;
  const activeDay = state.days[appStore.activeCarouselIndex] || state.days[0];
  const themeKey = resolveSceneForDay(activeDay);
  const previewBgUrl = appStore.currentBackdropUrl || activeDay?.resolvedBgPhoto || REAL_THEME_BACKDROPS[themeKey] || REAL_THEME_BACKDROPS.lights;
  let generatedDoc = null;
  let generatedFileName = 'Trip_Plan.pdf';

  openModal({
    title: 'Save Trip · Glassmorphism PDF',
    bodyHtml: `
      <div class="py-2 space-y-5 text-center">
        <div class="relative mx-auto w-full h-28 rounded-2xl overflow-hidden border border-white/20 shadow-xl">
          <img src="${esc(previewBgUrl)}" alt="PDF Background Theme" class="w-full h-full object-cover object-center scale-105" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30"></div>
          <div class="absolute inset-0 flex flex-col items-center justify-center px-4">
            <div class="w-12 h-12 rounded-2xl bg-black/45 backdrop-blur-xl border border-white/25 flex items-center justify-center shadow-lg mb-1.5">
              <div id="pdfSpinner" class="w-6 h-6 rounded-full border-2 border-white/20 border-t-sky-400 border-r-orange-400 animate-spin"></div>
              <div id="pdfDoneIcon" class="hidden text-emerald-400 scale-125">${ICONS.check}</div>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/15 border border-white/25 backdrop-blur-md text-sky-100">
              Active Backdrop + Frosted Glass Theme
            </span>
          </div>
        </div>

        <div>
          <h4 id="pdfStatusTitle" class="text-base font-semibold text-white">Capturing your live landscape backdrop...</h4>
          <p id="pdfStatusSub" class="text-xs text-white/60 mt-1">Compositing translucent glass cards, photos, budget &amp; links</p>
        </div>

        <div class="relative h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div id="pdfProgressBar" class="relative h-full rounded-full bg-gradient-to-r from-orange-400 via-amber-300 to-sky-400 transition-all duration-500 ease-out" style="width: 12%;">
            <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2 text-[11px] text-white/50 pt-1">
          <div id="pdfStep1" class="rounded-xl bg-white/10 border border-white/20 py-2 px-2 text-white font-medium transition-all">1. Backdrop</div>
          <div id="pdfStep2" class="rounded-xl bg-white/5 border border-white/10 py-2 px-2 transition-all">2. Glass Cards</div>
          <div id="pdfStep3" class="rounded-xl bg-white/5 border border-white/10 py-2 px-2 transition-all">3. PDF Ready</div>
        </div>
      </div>
    `,
    footerButtons: [
      {
        id: 'pdfRedownloadBtn',
        label: 'Download Again',
        variant: 'primary',
        onClick: () => {
          if (generatedDoc) {
            generatedDoc.save(generatedFileName);
            showToast('Downloading PDF again!');
          }
        }
      },
      { label: 'Close', onClick: closeModal }
    ]
  });

  const redownloadBtn = document.getElementById('pdfRedownloadBtn');
  if (redownloadBtn) redownloadBtn.classList.add('hidden');

  const updateProgress = (pct, titleText, activeStep) => {
    const bar = document.getElementById('pdfProgressBar');
    const statusTitle = document.getElementById('pdfStatusTitle');
    const step2 = document.getElementById('pdfStep2');
    const step3 = document.getElementById('pdfStep3');
    if (bar) bar.style.width = `${pct}%`;
    if (statusTitle && titleText) statusTitle.textContent = titleText;
    if (activeStep >= 2 && step2) {
      step2.className = 'rounded-xl bg-white/10 border border-white/20 py-2 px-2 text-white font-medium transition-all';
    }
    if (activeStep >= 3 && step3) {
      step3.className = 'rounded-xl bg-emerald-500/20 border border-emerald-400/40 py-2 px-2 text-emerald-200 font-semibold transition-all';
    }
  };

  try {
    await new Promise((r) => setTimeout(r, 260));
    generatedDoc = await buildTripPdfDocument(updateProgress);
    const safeName = (state.meta.title || 'Trip_Plan').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
    generatedFileName = `${safeName || 'Trip_Plan'}_Glass.pdf`;
    generatedDoc.save(generatedFileName);

    const spinner = document.getElementById('pdfSpinner');
    const doneIcon = document.getElementById('pdfDoneIcon');
    const statusSub = document.getElementById('pdfStatusSub');
    if (spinner) spinner.classList.add('hidden');
    if (doneIcon) doneIcon.classList.remove('hidden');
    if (statusSub) statusSub.textContent = `Downloaded as ${generatedFileName}`;
    if (redownloadBtn) redownloadBtn.classList.remove('hidden');
    showToast('Glassmorphism Trip PDF saved!');
  } catch (err) {
    updateProgress(100, 'Ready to Print / Save PDF', 3);
    const statusSub = document.getElementById('pdfStatusSub');
    if (statusSub) statusSub.textContent = 'Use your browser print dialog to save as PDF.';
    window.print();
  }
}