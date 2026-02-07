/**
 * Dick Wallner Train Tracker - Main Application Controller
 * Ties together all modules: Amtraker API, Location, Tracker, Map, UI, Storage
 */

const App = {
  refreshTimer: null,
  countdownTimer: null,
  countdownValue: 0,
  isRefreshing: false,
  stationsCache: null,
  stationsCacheTime: 0,
  STATIONS_CACHE_DURATION: 300000, // 5 minutes

  /**
   * Initialize the application
   */
  async init() {
    console.log('🚂 Dick Wallner Train Tracker initializing...');

    // Cache DOM elements
    UI.cacheElements();

    // Check if we have a saved location
    const activeLocation = Storage.getActiveLocation();

    if (activeLocation) {
      // Jump straight to the app
      await this.start(activeLocation);
    } else {
      // Show setup wizard
      UI.showSetup();
    }

    // Bind all event handlers
    this.bindEvents();

    // Apply saved theme
    const settings = Storage.getSettings();
    if (settings.theme) {
      UI.applyTheme(settings.theme);
    }

    // Mark as visited
    Storage.markVisited();

    console.log('🚂 Dick Wallner Train Tracker ready!');
  },

  /**
   * Start tracking at a given location
   */
  async start(location) {
    console.log(`📍 Starting at: ${location.name} (${location.lat}, ${location.lon})`);

    // Show main app
    UI.showApp();
    UI.updateLocationName(location.name);
    UI.setStatus('loading', 'Initializing...');

    // Render location tabs
    this.renderTabs();

    // Highlight active hub chip
    this.updateHubBar(location.name);

    // Initialize map
    MapManager.init(location.lat, location.lon);

    // Update radius from settings
    const settings = Storage.getSettings();
    MapManager.updateRadius(settings.radius);

    // Reset tracker
    Tracker.resetSession();

    // Do first refresh
    await this.refresh();

    // Start auto-refresh
    this.startRefresh();
  },

  /**
   * Main refresh cycle — fetch trains and update everything
   */
  async refresh() {
    if (this.isRefreshing) return;
    this.isRefreshing = true;

    const activeLocation = Storage.getActiveLocation();
    if (!activeLocation) {
      this.isRefreshing = false;
      return;
    }

    const settings = Storage.getSettings();

    try {
      UI.setStatus('loading', 'Fetching trains...');

      // Fetch trains
      const trains = await AmtrakerClient.getTrainsFlat(settings.providers);

      // Process through tracker
      const result = Tracker.processTrains(
        trains,
        activeLocation.lat,
        activeLocation.lon,
        settings.radius
      );

      // Update map with ALL trains in view, not just nearby
      // Show trains up to 2x radius for context
      const extendedRadius = trains
        .map(t => ({
          ...t,
          distance: AmtrakerClient.haversineDistance(activeLocation.lat, activeLocation.lon, t.lat, t.lon)
        }))
        .filter(t => t.distance <= settings.radius * 2)
        .sort((a, b) => a.distance - b.distance);

      MapManager.updateTrains(extendedRadius, result.closest ? result.closest.trainID : null);

      // Update UI
      UI.updateStats(result.stats);
      UI.updateHeroCard(result.closest);
      UI.updateNearbyList(result.nearby);

      // Fetch stations (cached)
      await this.refreshStations(activeLocation, settings);

      // Update history
      const todayHistory = Tracker.getTodayHistory();
      UI.updateHistoryList(todayHistory);

      // Update status
      const trainCount = result.nearby.length;
      UI.setStatus('active', `${trainCount} train${trainCount !== 1 ? 's' : ''} nearby · ${trains.length} total active`);

      console.log(`🔄 Refresh complete: ${trainCount} nearby, ${trains.length} total`);

    } catch (error) {
      console.error('Refresh error:', error);
      UI.setStatus('error', `Error: ${error.message}`);
      UI.showToast('Failed to fetch train data. Will retry...', 'error');
    }

    this.isRefreshing = false;
  },

  /**
   * Refresh stations (with caching)
   */
  async refreshStations(location, settings) {
    const now = Date.now();
    if (this.stationsCache && (now - this.stationsCacheTime) < this.STATIONS_CACHE_DURATION) {
      // Use cached stations
      Tracker.processStations(this.stationsCache);
      UI.updateStationsList(this.stationsCache);
      MapManager.updateStations(this.stationsCache);
      return;
    }

    try {
      const stations = await AmtrakerClient.getStationsNearPoint(
        location.lat, location.lon, settings.radius * 1.5
      );

      this.stationsCache = stations;
      this.stationsCacheTime = now;

      Tracker.processStations(stations);
      UI.updateStationsList(stations);
      MapManager.updateStations(stations);
    } catch (e) {
      console.warn('Failed to fetch stations:', e);
    }
  },

  /**
   * Start auto-refresh timer
   */
  startRefresh() {
    this.stopRefresh();

    const settings = Storage.getSettings();
    const interval = settings.refreshInterval || 60;
    this.countdownValue = interval;

    // Countdown timer (every second)
    this.countdownTimer = setInterval(() => {
      this.countdownValue--;
      UI.updateCountdown(this.countdownValue);

      if (this.countdownValue <= 0) {
        this.countdownValue = interval;
        this.refresh();
      }
    }, 1000);
  },

  /**
   * Highlight the active hub chip (if the current location matches a hub)
   */
  updateHubBar(locationName) {
    document.querySelectorAll('#hub-bar .hub-chip').forEach(chip => {
      if (chip.dataset.name === locationName) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  },

  /**
   * Stop auto-refresh
   */
  stopRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  },

  /**
   * Render location tabs bar
   */
  renderTabs() {
    const locations = Storage.getLocations();
    const active = Storage.getActiveLocation();
    const activeName = active ? active.name : '';

    UI.renderLocationTabs(
      locations,
      activeName,
      // onSwitch
      (name, loc) => {
        Location.setActive(name);
        UI.hideQuickAdd();
        this.stationsCache = null;
        this.start({ name, lat: loc.lat, lon: loc.lon, radius: loc.radius });
      },
      // onAdd — show the quick-add bar
      () => {
        UI.showQuickAdd();
        this.bindQuickAdd();
      },
      // onDelete
      (name) => {
        if (!confirm(`Remove "${name}" from saved locations?`)) return;
        Storage.deleteLocation(name);
        // If we deleted the active one, switch to the first remaining
        const remaining = Storage.getLocations();
        if (remaining.length > 0) {
          const next = remaining[0];
          Location.setActive(next.name);
          this.stationsCache = null;
          this.start({ name: next.name, lat: next.lat, lon: next.lon, radius: next.radius });
        } else {
          UI.showSetup();
        }
      }
    );
  },

  /**
   * Bind quick-add bar events (called each time bar is shown)
   */
  bindQuickAdd() {
    const searchBtn = document.getElementById('quick-add-search');
    const gpsBtn = document.getElementById('quick-add-gps');
    const cancelBtn = document.getElementById('quick-add-cancel');
    const input = document.getElementById('quick-add-input');
    const resultsContainer = document.getElementById('quick-add-results');

    const doSearch = async () => {
      const query = input?.value.trim();
      if (!query) return;

      // Try parsing as coordinates first
      const coords = Location.parseCoordinates(query);
      if (coords) {
        const name = await Location.reverseGeocode(coords.lat, coords.lon);
        const settings = Storage.getSettings();
        Location.save(name, coords.lat, coords.lon, settings.radius);
        Location.setActive(name);
        UI.hideQuickAdd();
        this.stationsCache = null;
        this.start({ name, lat: coords.lat, lon: coords.lon, radius: settings.radius });
        return;
      }

      // Search by name
      searchBtn.textContent = '...';
      const results = await Location.searchLocation(query);
      searchBtn.textContent = 'Add';

      if (resultsContainer) {
        UI.showSearchResults(results, resultsContainer, async (result) => {
          const settings = Storage.getSettings();
          Location.save(result.name, result.lat, result.lon, settings.radius);
          Location.setActive(result.name);
          UI.hideQuickAdd();
          this.stationsCache = null;
          this.start({ name: result.name, lat: result.lat, lon: result.lon, radius: settings.radius });
        });
      }
    };

    searchBtn?.addEventListener('click', doSearch);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSearch();
      if (e.key === 'Escape') UI.hideQuickAdd();
    });

    cancelBtn?.addEventListener('click', () => UI.hideQuickAdd());

    gpsBtn?.addEventListener('click', async () => {
      gpsBtn.textContent = '⏳';
      try {
        const pos = await Location.getCurrentPosition();
        const name = await Location.reverseGeocode(pos.lat, pos.lon);
        const settings = Storage.getSettings();
        Location.save(name, pos.lat, pos.lon, settings.radius);
        Location.setActive(name);
        UI.hideQuickAdd();
        this.stationsCache = null;
        this.start({ name, lat: pos.lat, lon: pos.lon, radius: settings.radius });
      } catch (err) {
        gpsBtn.textContent = '📍';
        UI.showToast(err.message, 'error');
      }
    });
  },

  /**
   * Bind all event handlers
   */
  bindEvents() {
    // ===== SETUP WIZARD =====

    // Use current location button
    UI.elements.btnUseLocation?.addEventListener('click', async () => {
      const btn = UI.elements.btnUseLocation;
      btn.textContent = '📍 Getting location...';
      btn.disabled = true;

      try {
        const pos = await Location.getCurrentPosition();
        btn.textContent = '📍 Found! Getting name...';

        const name = await Location.reverseGeocode(pos.lat, pos.lon);
        const settings = Storage.getSettings();
        Location.save(name, pos.lat, pos.lon, settings.radius);
        Location.setActive(name);

        this.start({ name, lat: pos.lat, lon: pos.lon, radius: settings.radius });

      } catch (error) {
        btn.textContent = '📍 Use My Current Location';
        btn.disabled = false;
        UI.showToast(error.message, 'error');
      }
    });

    // Search location in setup
    UI.elements.btnSearchLocation?.addEventListener('click', async () => {
      const query = UI.elements.locationSearch?.value.trim();
      if (!query) return;

      UI.elements.btnSearchLocation.textContent = '...';

      const results = await Location.searchLocation(query);
      UI.elements.btnSearchLocation.textContent = 'Search';

      const resultsContainer = document.getElementById('setup-search-results');

      UI.showSearchResults(results, resultsContainer, async (result) => {
        const settings = Storage.getSettings();
        Location.save(result.name, result.lat, result.lon, settings.radius);
        Location.setActive(result.name);
        this.start({ name: result.name, lat: result.lat, lon: result.lon, radius: settings.radius });
      });
    });

    UI.elements.locationSearch?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') UI.elements.btnSearchLocation?.click();
    });

    // Toggle manual coords form
    UI.elements.btnManualCoords?.addEventListener('click', () => {
      UI.elements.manualCoordsForm?.classList.toggle('hidden');
    });

    // Save manual coords
    UI.elements.btnSaveManual?.addEventListener('click', async () => {
      const lat = parseFloat(UI.elements.manualLat?.value);
      const lon = parseFloat(UI.elements.manualLon?.value);
      const radius = parseInt(UI.elements.manualRadius?.value) || 10;
      let name = UI.elements.manualName?.value.trim();

      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        UI.showToast('Invalid coordinates. Lat: -90 to 90, Lon: -180 to 180', 'error');
        return;
      }

      if (!name) {
        name = await Location.reverseGeocode(lat, lon);
      }

      Location.save(name, lat, lon, radius);
      Location.setActive(name);

      this.start({ name, lat, lon, radius });
    });

    // ===== MAIN APP HEADER =====

    // Refresh button
    UI.elements.btnRefresh?.addEventListener('click', () => {
      this.refresh();
    });

    // Settings gear — toggle dropdown
    UI.elements.btnSettings?.addEventListener('click', (e) => {
      e.stopPropagation();
      UI.elements.settingsDropdown?.classList.toggle('hidden');
    });

    // Close dropdown on outside click
    document.addEventListener('click', () => {
      UI.elements.settingsDropdown?.classList.add('hidden');
    });

    // Dropdown menu items
    UI.elements.menuChangeLocation?.addEventListener('click', () => {
      UI.elements.settingsDropdown?.classList.add('hidden');
      const locations = Storage.getLocations();
      const active = Storage.getActiveLocation();
      UI.showSavedLocations(locations, active ? active.name : '', (name, loc) => {
        Location.setActive(name);
        UI.closeChangeLocation();
        this.stationsCache = null;
        this.start({ name, ...loc });
      });
      UI.openChangeLocation();
    });

    // Suggested locations in change-location modal
    document.querySelectorAll('#modal-suggested-locations .suggested-card').forEach(card => {
      card.addEventListener('click', () => {
        const lat = parseFloat(card.dataset.lat);
        const lon = parseFloat(card.dataset.lon);
        const name = card.dataset.name;
        const settings = Storage.getSettings();
        Location.save(name, lat, lon, settings.radius);
        Location.setActive(name);
        UI.closeChangeLocation();
        this.stationsCache = null;
        this.start({ name, lat, lon, radius: settings.radius });
      });
    });

    // Hub bar quick-switch chips
    document.querySelectorAll('#hub-bar .hub-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const lat = parseFloat(chip.dataset.lat);
        const lon = parseFloat(chip.dataset.lon);
        const name = chip.dataset.name;
        const settings = Storage.getSettings();
        Location.save(name, lat, lon, settings.radius);
        Location.setActive(name);
        this.stationsCache = null;
        this.start({ name, lat, lon, radius: settings.radius });
      });
    });

    UI.elements.menuSettings?.addEventListener('click', () => {
      UI.elements.settingsDropdown?.classList.add('hidden');
      UI.openSettings();
    });

    UI.elements.menuExport?.addEventListener('click', () => {
      UI.elements.settingsDropdown?.classList.add('hidden');
      const data = Storage.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nearby-trains-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      UI.showToast('Data exported!', 'success');
    });

    UI.elements.menuImport?.addEventListener('click', () => {
      UI.elements.settingsDropdown?.classList.add('hidden');
      UI.elements.importFile?.click();
    });

    UI.elements.importFile?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          Storage.importData(reader.result);
          UI.showToast('Data imported! Reloading...', 'success');
          setTimeout(() => window.location.reload(), 1000);
        } catch (err) {
          UI.showToast('Import failed: invalid file', 'error');
        }
      };
      reader.readAsText(file);
    });

    // Toggle stations on map
    UI.elements.btnToggleStations?.addEventListener('click', () => {
      const isVisible = !MapManager.stationsVisible;
      MapManager.toggleStations(isVisible);
      if (isVisible && this.stationsCache) {
        MapManager.updateStations(this.stationsCache);
      }
      UI.elements.btnToggleStations.style.opacity = isVisible ? '1' : '0.5';
    });

    // ===== SETTINGS MODAL =====

    UI.elements.btnCloseSettingsX?.addEventListener('click', () => UI.closeSettings());
    UI.elements.btnCloseSettings?.addEventListener('click', () => UI.closeSettings());

    // Save settings
    UI.elements.btnSaveSettings?.addEventListener('click', () => {
      const settings = Storage.getSettings();

      if (UI.elements.settingRefresh) settings.refreshInterval = parseInt(UI.elements.settingRefresh.value) || 60;
      if (UI.elements.settingRadius) settings.radius = parseInt(UI.elements.settingRadius.value) || 10;
      if (UI.elements.settingAmtrak) settings.providers.amtrak = UI.elements.settingAmtrak.checked;
      if (UI.elements.settingVia) settings.providers.via = UI.elements.settingVia.checked;
      if (UI.elements.settingBrightline) settings.providers.brightline = UI.elements.settingBrightline.checked;
      if (UI.elements.settingNightPause) settings.nightPause = UI.elements.settingNightPause.checked;

      Storage.saveSettings(settings);

      // Apply changes
      MapManager.updateRadius(settings.radius);
      if (UI.elements.detectionRadius) UI.elements.detectionRadius.textContent = settings.radius;
      if (UI.elements.refreshIntervalDisplay) UI.elements.refreshIntervalDisplay.textContent = settings.refreshInterval;

      this.stationsCache = null;
      this.startRefresh();
      this.refresh();

      UI.closeSettings();
      UI.showToast('Settings saved!', 'success');
    });

    // Export/import/clear in settings modal
    UI.elements.btnExport?.addEventListener('click', () => {
      const data = Storage.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nearby-trains-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      UI.showToast('Data exported!', 'success');
    });

    UI.elements.btnImport?.addEventListener('click', () => {
      UI.elements.importFile?.click();
    });

    UI.elements.btnClearHistory?.addEventListener('click', () => {
      if (confirm('Clear all spotting history? This cannot be undone.')) {
        Storage.clearHistory();
        UI.updateHistoryList([]);
        UI.showToast('History cleared', 'success');
      }
    });

    // ===== CHANGE LOCATION MODAL =====

    UI.elements.btnCloseChangeLocX?.addEventListener('click', () => UI.closeChangeLocation());
    UI.elements.btnCloseChangeLoc?.addEventListener('click', () => UI.closeChangeLocation());

    // Use current location in modal
    UI.elements.btnUseLocationModal?.addEventListener('click', async () => {
      const btn = UI.elements.btnUseLocationModal;
      btn.textContent = '📍 Getting location...';
      btn.disabled = true;

      try {
        const pos = await Location.getCurrentPosition();
        const name = await Location.reverseGeocode(pos.lat, pos.lon);
        const settings = Storage.getSettings();
        Location.save(name, pos.lat, pos.lon, settings.radius);
        Location.setActive(name);
        UI.closeChangeLocation();
        this.stationsCache = null;
        this.start({ name, lat: pos.lat, lon: pos.lon, radius: settings.radius });
      } catch (error) {
        btn.textContent = '📍 Use Current Location';
        btn.disabled = false;
        UI.showToast(error.message, 'error');
      }
    });

    // Search in change location modal
    UI.elements.btnModalSearch?.addEventListener('click', async () => {
      const query = UI.elements.modalLocationSearch?.value.trim();
      if (!query) return;

      const results = await Location.searchLocation(query);

      const resultsContainer = document.getElementById('modal-search-results');

      UI.showSearchResults(results, resultsContainer, async (result) => {
        const settings = Storage.getSettings();
        Location.save(result.name, result.lat, result.lon, settings.radius);
        Location.setActive(result.name);
        UI.closeChangeLocation();
        this.stationsCache = null;
        this.start({ name: result.name, lat: result.lat, lon: result.lon, radius: settings.radius });
      });
    });

    UI.elements.modalLocationSearch?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') UI.elements.btnModalSearch?.click();
    });

    // ===== MODAL BACKDROP CLOSE =====
    [UI.elements.settingsModal, UI.elements.changeLocationModal].forEach(modal => {
      modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    });

    // ===== KEYBOARD SHORTCUTS =====
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        UI.closeSettings();
        UI.closeChangeLocation();
        UI.elements.settingsDropdown?.classList.add('hidden');
      }
      // 'r' to refresh (when not in an input)
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey && !e.target.closest('input, textarea')) {
        this.refresh();
      }
    });

    // ===== VISIBILITY CHANGE =====
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopRefresh();
      } else {
        this.refresh();
        this.startRefresh();
      }
    });

    // ===== SETUP: SHOW SAVED LOCATIONS =====
    const savedLocations = Storage.getLocations();

    // ===== SETUP: SUGGESTED LOCATIONS =====
    document.querySelectorAll('.suggested-card').forEach(card => {
      card.addEventListener('click', () => {
        const lat = parseFloat(card.dataset.lat);
        const lon = parseFloat(card.dataset.lon);
        const name = card.dataset.name;
        const settings = Storage.getSettings();
        Location.save(name, lat, lon, settings.radius);
        Location.setActive(name);
        this.start({ name, lat, lon, radius: settings.radius });
      });
    });

    if (savedLocations.length > 0) {
      UI.elements.setupSavedSection?.classList.remove('hidden');
      const container = UI.elements.setupSavedLocations;
      if (container) {
        savedLocations.forEach(loc => {
          const div = document.createElement('div');
          div.className = 'saved-location-card';
          div.innerHTML = `
            <div>
              <div class="location-name">${loc.name}</div>
              <div class="location-coords">${Location.formatCoords(loc.lat, loc.lon)}</div>
            </div>
          `;
          div.addEventListener('click', () => {
            Location.setActive(loc.name);
            this.start({ name: loc.name, lat: loc.lat, lon: loc.lon, radius: loc.radius });
          });
          container.appendChild(div);
        });
      }
    }
  }
};

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

window.App = App;
