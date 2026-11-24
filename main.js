import {
  appStore,
  registerPlannerHooks,
  renderStaticIcons,
  updateClock,
  setWeatherPanelExpanded,
  setActiveCarouselIndex,
  renderCarousel,
  updateBackdropForDay,
  prefetchAllDaysWeather,
  prefetchAllCardPhotos,
  prefetchRoutesForTrip,
  initCloudSync,
  scheduleCloudSave,
  showToast,
  copyTextToClipboard,
  closeModal
} from './trip-planner.js';

import {
  registerDetailHooks,
  renderItinerary,
  renderAll,
  openSavePdfFlow
} from './trip-planner-detail.js';

import {
  openHeroModal,
  openTripsModal,
  openChecklistCategoryModal,
  openLinkModal,
  openBudgetModal,
  openDayModal,
  confirmDeleteDay,
  openEventModal,
  openCopyEventModal,
  openTravelOverrideModal,
  openCustomCategoriesModal,
  deleteEvent,
  moveEvent,
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
  openCopyEventModal,
  openTravelOverrideModal,
  openChecklistCategoryModal,
  openBudgetModal,
  openLinkModal
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
 * Bind Global UI Controls, Smart Schedule Controls, Touch Swipe & Keyboard Navigation
 */
function bindGlobalEvents() {
  // Header & Trip Controls
  document.getElementById('editHeroInlineBtn').addEventListener('click', () => openHeroModal('edit'));
  document.getElementById('addDayBtn').addEventListener('click', () => openDayModal(null));
  document.getElementById('addNewTripBtn').addEventListener('click', () => openHeroModal('create'));
  document.getElementById('switchTripsBtn').addEventListener('click', openTripsModal);
  document.getElementById('savePdfBtn').addEventListener('click', openSavePdfFlow);
  document.getElementById('resetPlannerBtn').addEventListener('click', confirmResetPlanner);

  // 3D Carousel Controls
  document.getElementById('carouselPrevBtn').addEventListener('click', () => {
    setActiveCarouselIndex(appStore.activeCarouselIndex - 1);
  });
  document.getElementById('carouselNextBtn').addEventListener('click', () => {
    setActiveCarouselIndex(appStore.activeCarouselIndex + 1);
  });

  // Smart Day Schedule Controls (Timeline vs. Time Slots, Focused vs. All Days, Auto-Adjust, Custom Categories)
  document.getElementById('scheduleModeTimelineBtn').addEventListener('click', () => {
    appStore.scheduleViewMode = 'timeline';
    renderItinerary();
  });
  document.getElementById('scheduleModeSlotsBtn').addEventListener('click', () => {
    appStore.scheduleViewMode = 'slots';
    renderItinerary();
  });

  document.getElementById('viewSingleBtn').addEventListener('click', () => {
    appStore.showAllDays = false;
    renderItinerary();
  });
  document.getElementById('viewAllBtn').addEventListener('click', () => {
    appStore.showAllDays = true;
    renderItinerary();
  });

  document.getElementById('autoAdjustToggleBtn').addEventListener('click', () => {
    appStore.autoAdjustTimes = !appStore.autoAdjustTimes;
    renderItinerary();
    showToast(
      appStore.autoAdjustTimes
        ? 'Auto-Adjust ON · Flexible stops shift automatically'
        : 'Auto-Adjust OFF · Times stay manual'
    );
  });

  document.getElementById('manageCategoriesBtn').addEventListener('click', () => {
    openCustomCategoriesModal();
  });

  // Other Dashboard Modules
  document.getElementById('addBudgetRowBtn').addEventListener('click', () => openBudgetModal(null));
  document.getElementById('addLinkBtn').addEventListener('click', () => openLinkModal(null));
  document.getElementById('addChecklistCategoryBtn').addEventListener('click', () => openChecklistCategoryModal(null));

  document.getElementById('toggleWeatherForecastBtn').addEventListener('click', () => {
    setWeatherPanelExpanded(!appStore.weatherPanelExpanded);
  });

  document.getElementById('notesInput').addEventListener('input', (e) => {
    appStore.state.notes = e.target.value;
    document.getElementById('notesMeta').textContent = `${appStore.state.notes.length} characters`;
    scheduleCloudSave();
  });

  document.getElementById('copyNotesBtn').addEventListener('click', () => {
    if (!appStore.state.notes.trim()) return showToast('Notes are currently empty', 'error');
    copyTextToClipboard(appStore.state.notes, 'Trip notes copied!');
  });

  // Reusable Modal Close Handlers
  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
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

  stage.addEventListener(
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

  stage.addEventListener(
    'touchend',
    (e) => {
      if (!isSingleTouch || !e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      isSingleTouch = false;

      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        setActiveCarouselIndex(appStore.activeCarouselIndex + (dx < 0 ? 1 : -1));
      }
    },
    { passive: true }
  );

  stage.addEventListener(
    'touchcancel',
    () => {
      isSingleTouch = false;
    },
    { passive: true }
  );

  // Recompute 3D spacing on window resize & phone rotation
  let resizeTimer = null;
  const handleViewportChange = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderCarousel(), 80);
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
prefetchAllDaysWeather();
prefetchAllCardPhotos();
prefetchRoutesForTrip();
initCloudSync();