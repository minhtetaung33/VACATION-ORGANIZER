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
  openChecklistCategoryModal,
  openBudgetModal,
  openLinkModal
});

/**
 * Bind Global UI Controls, Touch Swipe & Keyboard Navigation
 */
function bindGlobalEvents() {
  document.getElementById('editHeroInlineBtn').addEventListener('click', () => openHeroModal('edit'));
  document.getElementById('addDayBtn').addEventListener('click', () => openDayModal(null));
  document.getElementById('addNewTripBtn').addEventListener('click', () => openHeroModal('create'));
  document.getElementById('switchTripsBtn').addEventListener('click', openTripsModal);
  document.getElementById('savePdfBtn').addEventListener('click', openSavePdfFlow);
  document.getElementById('resetPlannerBtn').addEventListener('click', confirmResetPlanner);

  document.getElementById('carouselPrevBtn').addEventListener('click', () => {
    setActiveCarouselIndex(appStore.activeCarouselIndex - 1);
  });
  document.getElementById('carouselNextBtn').addEventListener('click', () => {
    setActiveCarouselIndex(appStore.activeCarouselIndex + 1);
  });

  document.getElementById('viewSingleBtn').addEventListener('click', () => {
    appStore.showAllDays = false;
    renderItinerary();
  });
  document.getElementById('viewAllBtn').addEventListener('click', () => {
    appStore.showAllDays = true;
    renderItinerary();
  });

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

  // Touch Swipe Support for 3D Carousel
  const stage = document.getElementById('carouselStage');
  let touchStartX = 0;
  stage.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 45) {
      setActiveCarouselIndex(appStore.activeCarouselIndex + (dx < 0 ? 1 : -1));
    }
  }, { passive: true });

  // Recompute 3D spacing on window resize
  window.addEventListener('resize', () => renderCarousel());
}

/**
 * Boot Application
 */
renderStaticIcons();
updateClock();
setInterval(updateClock, 1000);
bindGlobalEvents();
updateBackdropForDay(appStore.state.days[appStore.activeCarouselIndex] || appStore.state.days[0]);
renderAll();
prefetchAllDaysWeather();
prefetchAllCardPhotos();
initCloudSync();