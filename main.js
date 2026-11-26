import {
  appStore,
  registerPlannerHooks,
  renderStaticIcons,
  updateClock,
  setWeatherPanelExpanded,
  setBookiPanelExpanded,
  setNotesPanelExpanded,
  refreshWeatherDayNightAuto,
  syncLiveWeatherForActiveDay,
  setActiveCarouselIndex,
  renderCarousel,
  updateBackdropForDay,
  prefetchAllDaysWeather,
  prefetchAllCardPhotos,
  refreshTripTravelRoutes,
  initCloudSync,
  extractPlainTextFromRichHtml,
  showToast,
  copyTextToClipboard,
  closeModal
} from './trip-planner.js';

import {
  registerDetailHooks,
  scrollToTimelineEvent,
  renderItinerary,
  renderAll,
  initRichNotesEditor,
  openSavePdfFlow
} from './trip-planner-detail.js';

import {
  registerMapifyHooks,
  invalidateMapifySize
} from './trip-mapify.js';

import {
  openHeroModal,
  openTripsModal,
  openReservationModal,
  cycleReservationStatus,
  handleDragReorderReservation,
  deleteReservation,
  openChecklistCategoryModal,
  openChecklistItemModal,
  openBudgetModal,
  openDayModal,
  confirmDeleteDay,
  openEventModal,
  openCustomCategoriesModal,
  openCopyToDayModal,
  deleteEvent,
  moveEvent,
  handleDragReorderEvent,
  handleDragMoveToTimeSlot,
  handleDragMoveAcrossDays,
  duplicateEvent,
  toggleEventCompleted,
  toggleEventFixed,
  toggleEventTravelMode,
  handleAutoFitDay,
  confirmResetPlanner
} from './trip-planner-creator.js';

/**
 * Connect Cross-Module Callbacks (Prevents Circular Imports)
 */
registerPlannerHooks({
  renderAll,
  renderItinerary,
  openDayModal,
  confirmDeleteDay,
  openEventModal
});

registerDetailHooks({
  openDayModal,
  confirmDeleteDay,
  openEventModal,
  deleteEvent,
  moveEvent,
  openChecklistCategoryModal,
  openChecklistItemModal,
  openBudgetModal,
  openReservationModal,
  cycleReservationStatus,
  handleDragReorderReservation,
  deleteReservation,
  handleDragReorderEvent,
  handleDragMoveToTimeSlot,
  handleDragMoveAcrossDays,
  duplicateEvent,
  openCopyToDayModal,
  toggleEventCompleted,
  toggleEventFixed,
  toggleEventTravelMode,
  handleAutoFitDay,
  openCustomCategoriesModal
});

registerMapifyHooks({
  focusTimelineEvent: scrollToTimelineEvent
});

/**
 * Prevent Accidental Pinch-Zoom on Mobile Browsers (Especially iOS Safari)
 */
function bindMobileViewportGuards() {
  const preventGesture = (e) => {
    e.preventDefault();
  };

  document.addEventListener('gesturestart', preventGesture, { passive: false });
  document.addEventListener('gesturechange', preventGesture, { passive: false });
  document.addEventListener('gestureend', preventGesture, { passive: false });

  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
}

/**
 * Bind Global UI Controls, Directional Touch Swipe & Keyboard Navigation
 */
function bindGlobalEvents() {
  document.getElementById('editHeroInlineBtn')?.addEventListener('click', () => openHeroModal('edit'));
  document.getElementById('addDayBtn')?.addEventListener('click', () => openDayModal(null));
  document.getElementById('addNewTripBtn')?.addEventListener('click', () => openHeroModal('create'));
  document.getElementById('switchTripsBtn')?.addEventListener('click', openTripsModal);
  document.getElementById('savePdfBtn')?.addEventListener('click', openSavePdfFlow);
  document.getElementById('resetPlannerBtn')?.addEventListener('click', confirmResetPlanner);
  document.getElementById('manageCategoriesBtn')?.addEventListener('click', () => openCustomCategoriesModal(null));

  document.getElementById('carouselPrevBtn')?.addEventListener('click', () => {
    setActiveCarouselIndex(appStore.activeCarouselIndex - 1);
  });
  document.getElementById('carouselNextBtn')?.addEventListener('click', () => {
    setActiveCarouselIndex(appStore.activeCarouselIndex + 1);
  });

  document.getElementById('viewSingleBtn')?.addEventListener('click', () => {
    appStore.showAllDays = false;
    renderItinerary();
  });
  document.getElementById('viewAllBtn')?.addEventListener('click', () => {
    appStore.showAllDays = true;
    renderItinerary();
  });

  // Booki Controls (Hide/Show Icon, Auto-Expand on Add Booking or Status Pill Click)
  document.getElementById('toggleBookiBtn')?.addEventListener('click', () => {
    setBookiPanelExpanded(!appStore.bookiPanelExpanded);
  });

  document.getElementById('vaultStatusSummary')?.addEventListener(
    'click',
    (e) => {
      if (e.target.closest('[data-vault-quick-status]') && !appStore.bookiPanelExpanded) {
        setBookiPanelExpanded(true);
      }
    },
    true
  );

  document.getElementById('addReservationBtn')?.addEventListener('click', () => {
    if (!appStore.bookiPanelExpanded) {
      setBookiPanelExpanded(true);
    }
    const preselectedType = appStore.vaultTypeFilter && appStore.vaultTypeFilter !== 'all'
      ? appStore.vaultTypeFilter
      : null;
    openReservationModal(null, preselectedType);
  });

  // Personal Trip Notes & Quick Reminders Hide/Show Toggle
  document.getElementById('toggleNotesBtn')?.addEventListener('click', () => {
    setNotesPanelExpanded(!appStore.notesPanelExpanded);
  });

  document.getElementById('addBudgetRowBtn')?.addEventListener('click', () => openBudgetModal(null));
  document.getElementById('addChecklistCategoryBtn')?.addEventListener('click', () => openChecklistCategoryModal(null));

  document.getElementById('toggleWeatherForecastBtn')?.addEventListener('click', () => {
    setWeatherPanelExpanded(!appStore.weatherPanelExpanded);
  });

  // Copy Formatted Rich-Text Personal Notes as Clean Text
  document.getElementById('copyNotesBtn')?.addEventListener('click', () => {
    const plain = appStore.state.notesHtml
      ? extractPlainTextFromRichHtml(appStore.state.notesHtml)
      : String(appStore.state.notes || '').trim();
    if (!plain) return showToast('Notes are currently empty', 'error');
    copyTextToClipboard(plain, 'Trip notes copied!');
  });

  document.getElementById('modalCloseBtn')?.addEventListener('click', closeModal);
  document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });

  // Keyboard Navigation (Escape to close modal, Left/Right for 3D Carousel)
  window.addEventListener('keydown', (e) => {
    const modalOpen = !document.getElementById('modalOverlay').classList.contains('hidden');
    if (e.key === 'Escape' && modalOpen) return closeModal();
    const activeEl = document.activeElement;
    if (
      modalOpen ||
      activeEl?.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl?.tagName)
    ) {
      return;
    }
    if (e.key === 'ArrowLeft') setActiveCarouselIndex(appStore.activeCarouselIndex - 1);
    if (e.key === 'ArrowRight') setActiveCarouselIndex(appStore.activeCarouselIndex + 1);
  });

  // Directional Touch Swipe Support for 3D Carousel (Ignores Vertical Scrolling)
  const stage = document.getElementById('carouselStage');
  let touchStartX = 0;
  let touchStartY = 0;
  let isSingleTouch = false;

  stage?.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) {
        isSingleTouch = false;
        return;
      }
      isSingleTouch = true;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    },
    { passive: true }
  );

  stage?.addEventListener(
    'touchend',
    (e) => {
      if (!isSingleTouch || !e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      isSingleTouch = false;

      // Only swipe carousel when movement is clearly horizontal
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        setActiveCarouselIndex(appStore.activeCarouselIndex + (dx < 0 ? 1 : -1));
      }
    },
    { passive: true }
  );

  stage?.addEventListener(
    'touchcancel',
    () => {
      isSingleTouch = false;
    },
    { passive: true }
  );

  // Recompute 3D spacing & Mapify viewport size on window resize or phone rotation
  let resizeTimer = null;
  const handleViewportChange = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderCarousel();
      invalidateMapifySize();
    }, 90);
  };
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('orientationchange', handleViewportChange);

  // Re-check automatic Day/Night transition when returning to the tab
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      refreshWeatherDayNightAuto();
    }
  });
}

/**
 * Boot Application
 */
bindMobileViewportGuards();
renderStaticIcons();
setBookiPanelExpanded(appStore.bookiPanelExpanded);
setNotesPanelExpanded(appStore.notesPanelExpanded);
updateClock();
setInterval(updateClock, 1000);
bindGlobalEvents();
initRichNotesEditor();
updateBackdropForDay(appStore.state.days[appStore.activeCarouselIndex] || appStore.state.days[0]);
renderAll();
prefetchAllDaysWeather();
setInterval(refreshWeatherDayNightAuto, 60 * 1000);
setInterval(syncLiveWeatherForActiveDay, 20 * 60 * 1000);
prefetchAllCardPhotos();
refreshTripTravelRoutes();
initCloudSync();