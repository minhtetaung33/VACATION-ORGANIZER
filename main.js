import {
  appStore,
  registerPlannerHooks,
  renderStaticIcons,
  updateClock,
  setWeatherPanelExpanded,
  setActiveCarouselIndex,
  renderCarousel,
  updateBackdropForDay,
  syncLiveWeatherForActiveDay,
  prefetchAllDaysWeather,
  prefetchAllCardPhotos,
  refreshTripTravelRoutes,
  initCloudSync,
  scheduleCloudSave,
  showToast,
  copyTextToClipboard,
  closeModal
} from './trip-planner.js';

import {
  registerDetailHooks,
  scrollToTimelineEvent,
  renderItinerary,
  renderAll,
  openSavePdfFlow
} from './trip-planner-detail.js';

import {
  registerMapifyHooks,
  invalidateMapifySize
} from './trip-mapify.js';

import {
  openHeroModal,
  openTripsModal,
  openChecklistCategoryModal,
  openLinkModal,
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
 * Connect Cross-Module Callbacks (Prevents Circular Imports & Keeps Forecast Synced on Edits)
 */
registerPlannerHooks({
  renderAll: () => {
    renderAll();
    syncLiveWeatherForActiveDay();
  },
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
  openBudgetModal,
  openLinkModal,
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

  document.getElementById('addBudgetRowBtn')?.addEventListener('click', () => openBudgetModal(null));
  document.getElementById('addLinkBtn')?.addEventListener('click', () => openLinkModal(null));
  document.getElementById('addChecklistCategoryBtn')?.addEventListener('click', () => openChecklistCategoryModal(null));

  document.getElementById('toggleWeatherForecastBtn')?.addEventListener('click', () => {
    setWeatherPanelExpanded(!appStore.weatherPanelExpanded);
  });

  document.getElementById('notesInput')?.addEventListener('input', (e) => {
    appStore.state.notes = e.target.value;
    document.getElementById('notesMeta').textContent = `${appStore.state.notes.length} characters`;
    scheduleCloudSave();
  });

  document.getElementById('copyNotesBtn')?.addEventListener('click', () => {
    if (!appStore.state.notes.trim()) return showToast('Notes are currently empty', 'error');
    copyTextToClipboard(appStore.state.notes, 'Trip notes copied!');
  });

  document.getElementById('modalCloseBtn')?.addEventListener('click', closeModal);
  document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });

  // Keyboard Navigation (Escape to close modal, Left/Right for 3D Carousel)
  window.addEventListener('keydown', (e) => {
    const modalOpen = !document.getElementById('modalOverlay').classList.contains('hidden');
    if (e.key === 'Escape' && modalOpen) return closeModal();
    if (modalOpen || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
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
}

/**
 * Boot Application
 */
bindMobileViewportGuards();
renderStaticIcons();
updateClock();
setInterval(updateClock, 1000);
bindGlobalEvents();
updateBackdropForDay(appStore.state.days[appStore.activeCarouselIndex] || appStore.state.days[0]);
renderAll();
syncLiveWeatherForActiveDay();
prefetchAllDaysWeather();
prefetchAllCardPhotos();
refreshTripTravelRoutes();
initCloudSync();