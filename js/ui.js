/**
 * UI Manager
 * Handles all DOM rendering, stats updates, train cards, history, and status
 */

const UI = {
  // Cached DOM elements
  elements: {},

  /**
   * Cache all DOM element references (matched to actual index.html IDs)
   */
  cacheElements() {
    this.elements = {
      // Views
      setupWizard: document.getElementById('setup-wizard'),
      mainApp: document.getElementById('main-app'),

      // Setup wizard
      btnUseLocation: document.getElementById('btn-use-location'),
      locationSearch: document.getElementById('location-search'),
      btnSearchLocation: document.getElementById('btn-search-location'),
      btnManualCoords: document.getElementById('btn-manual-coords'),
      manualCoordsForm: document.getElementById('manual-coords-form'),
      manualLat: document.getElementById('manual-lat'),
      manualLon: document.getElementById('manual-lon'),
      manualRadius: document.getElementById('manual-radius'),
      manualName: document.getElementById('manual-name'),
      btnSaveManual: document.getElementById('btn-save-manual'),
      setupSavedSection: document.getElementById('setup-saved-section'),
      setupSavedLocations: document.getElementById('setup-saved-locations'),

      // Stats
      activeCount: document.getElementById('active-count'),
      todayCount: document.getElementById('today-count'),
      closestToday: document.getElementById('closest-today'),
      avgSpeed: document.getElementById('avg-speed'),

      // Hero / closest train card
      currentTrainCard: document.getElementById('current-train-card'),
      waitingState: document.getElementById('waiting-state'),
      trainHero: document.getElementById('train-hero'),
      heroRouteName: document.getElementById('hero-route-name'),
      heroTrainNum: document.getElementById('hero-train-num'),
      heroProvider: document.getElementById('hero-provider'),
      heroStatusBadge: document.getElementById('hero-status-badge'),
      heroOrigin: document.getElementById('hero-origin'),
      heroDestination: document.getElementById('hero-destination'),
      heroDistance: document.getElementById('hero-distance'),
      heroSpeed: document.getElementById('hero-speed'),
      heroHeading: document.getElementById('hero-heading'),
      heroNextStation: document.getElementById('hero-next-station'),

      // Map
      btnToggleStations: document.getElementById('btn-toggle-stations'),

      // Stations section
      stationsSection: document.getElementById('stations-section'),
      stationsCount: document.getElementById('stations-count'),
      stationList: document.getElementById('station-list'),

      // Spotted trains / history
      historyLocationName: document.getElementById('history-location-name'),
      spottedCount: document.getElementById('spotted-count'),
      trainHistory: document.getElementById('train-history'),

      // Header
      locationName: document.getElementById('location-name'),
      detectionRadius: document.getElementById('detection-radius'),
      btnRefresh: document.getElementById('btn-refresh'),
      btnSettings: document.getElementById('btn-settings'),
      settingsDropdown: document.getElementById('settings-dropdown'),
      menuChangeLocation: document.getElementById('menu-change-location'),
      menuSettings: document.getElementById('menu-settings'),
      menuExport: document.getElementById('menu-export'),
      menuImport: document.getElementById('menu-import'),
      refreshIntervalDisplay: document.getElementById('refresh-interval-display'),

      // Location tabs
      locationTabs: document.getElementById('location-tabs'),

      // Status bar
      statusIndicator: document.getElementById('status-indicator'),
      statusText: document.getElementById('status-text'),
      nextUpdateCountdown: document.getElementById('next-update-countdown'),
      lastUpdate: document.getElementById('last-update'),

      // Settings modal
      settingsModal: document.getElementById('settings-modal'),
      btnCloseSettingsX: document.getElementById('btn-close-settings-x'),
      btnCloseSettings: document.getElementById('btn-close-settings'),
      btnSaveSettings: document.getElementById('btn-save-settings'),
      settingRefresh: document.getElementById('setting-refresh'),
      settingRadius: document.getElementById('setting-radius'),
      settingAmtrak: document.getElementById('setting-amtrak'),
      settingVia: document.getElementById('setting-via'),
      settingBrightline: document.getElementById('setting-brightline'),
      settingNightPause: document.getElementById('setting-night-pause'),
      settingNightStart: document.getElementById('setting-night-start'),
      settingNightEnd: document.getElementById('setting-night-end'),
      btnExport: document.getElementById('btn-export'),
      btnImport: document.getElementById('btn-import'),
      importFile: document.getElementById('import-file'),
      btnClearHistory: document.getElementById('btn-clear-history'),

      // Change location modal
      changeLocationModal: document.getElementById('change-location-modal'),
      btnCloseChangeLocX: document.getElementById('btn-close-change-loc-x'),
      btnCloseChangeLoc: document.getElementById('btn-close-change-loc'),
      btnUseLocationModal: document.getElementById('btn-use-location-modal'),
      modalLocationSearch: document.getElementById('modal-location-search'),
      btnModalSearch: document.getElementById('btn-modal-search'),
      modalSavedLocations: document.getElementById('modal-saved-locations'),
    };
  },

  /**
   * Show setup wizard, hide main app
   */
  showSetup() {
    this.elements.setupWizard.classList.remove('hidden');
    this.elements.mainApp.classList.add('hidden');
  },

  /**
   * Show main app, hide setup wizard
   */
  showApp() {
    this.elements.setupWizard.classList.add('hidden');
    this.elements.mainApp.classList.remove('hidden');
    MapManager.invalidateSize();
  },

  /**
   * Render the location tabs bar with saved locations + "+" button
   * @param {Array} locations - Array of {name, lat, lon, radius}
   * @param {string} activeName - Name of the currently active location
   * @param {Function} onSwitch - Called with (name, loc) when a tab is clicked
   * @param {Function} onAdd - Called when the "+" button is clicked
   * @param {Function} onDelete - Called with (name) when a delete "×" is clicked
   */
  renderLocationTabs(locations, activeName, onSwitch, onAdd, onDelete) {
    const container = this.elements.locationTabs;
    if (!container) return;

    container.innerHTML = '';

    locations.forEach(loc => {
      const tab = document.createElement('div');
      tab.className = `location-tab ${loc.name === activeName ? 'active' : ''}`;
      tab.innerHTML = `${loc.name}${locations.length > 1 ? '<span class="delete-loc" title="Remove">×</span>' : ''}`;

      // Click the tab text to switch
      tab.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-loc')) return;
        if (loc.name !== activeName) {
          onSwitch(loc.name, loc);
        }
      });

      // Click × to delete
      const deleteBtn = tab.querySelector('.delete-loc');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          onDelete(loc.name);
        });
      }

      container.appendChild(tab);
    });

    // "+" add button
    const addTab = document.createElement('div');
    addTab.className = 'location-tab add-tab';
    addTab.textContent = '+';
    addTab.title = 'Add location';
    addTab.addEventListener('click', onAdd);
    container.appendChild(addTab);
  },

  /**
   * Show/hide the quick-add location bar
   */
  showQuickAdd() {
    const bar = document.getElementById('quick-add-bar');
    const results = document.getElementById('quick-add-results');
    if (!bar) return;

    if (!bar.classList.contains('hidden')) {
      // Toggle off
      bar.classList.add('hidden');
      bar.innerHTML = '';
      if (results) results.innerHTML = '';
      return;
    }

    bar.classList.remove('hidden');
    bar.innerHTML = `
      <input type="text" id="quick-add-input" placeholder="Search city or enter coordinates..." autofocus>
      <button class="btn btn-primary btn-small" id="quick-add-search">Add</button>
      <button class="btn btn-small" id="quick-add-gps" title="Use GPS">📍</button>
      <button class="btn btn-small" id="quick-add-cancel">✕</button>
    `;

    // Focus the input
    setTimeout(() => document.getElementById('quick-add-input')?.focus(), 50);
  },

  /**
   * Hide the quick-add bar
   */
  hideQuickAdd() {
    const bar = document.getElementById('quick-add-bar');
    const results = document.getElementById('quick-add-results');
    if (bar) { bar.classList.add('hidden'); bar.innerHTML = ''; }
    if (results) results.innerHTML = '';
  },

  /**
   * Update the stats grid
   */
  updateStats(stats) {
    if (this.elements.activeCount) {
      this.elements.activeCount.textContent = stats.nearbyCount || 0;
    }
    if (this.elements.todayCount) {
      this.elements.todayCount.textContent = stats.spottedToday || 0;
    }
    if (this.elements.closestToday) {
      this.elements.closestToday.textContent = stats.closestDistance !== null
        ? Tracker.formatDistance(stats.closestDistance)
        : '—';
    }
    if (this.elements.avgSpeed) {
      this.elements.avgSpeed.textContent = stats.avgSpeed !== null
        ? `${stats.avgSpeed}`
        : '—';
    }
    if (this.elements.spottedCount) {
      this.elements.spottedCount.textContent = `${stats.spottedToday || 0} trains`;
    }
  },

  /**
   * Update the hero card (closest train)
   */
  updateHeroCard(train) {
    if (!train) {
      // Show waiting state, hide hero
      if (this.elements.waitingState) this.elements.waitingState.style.display = '';
      if (this.elements.trainHero) this.elements.trainHero.classList.remove('active');
      return;
    }

    // Hide waiting, show hero
    if (this.elements.waitingState) this.elements.waitingState.style.display = 'none';
    if (this.elements.trainHero) this.elements.trainHero.classList.add('active');

    if (this.elements.heroRouteName) this.elements.heroRouteName.textContent = train.routeName || 'Unknown Train';
    if (this.elements.heroTrainNum) this.elements.heroTrainNum.textContent = train.trainNum || '--';
    if (this.elements.heroProvider) this.elements.heroProvider.textContent = train.provider || 'Amtrak';
    if (this.elements.heroDistance) this.elements.heroDistance.textContent = Tracker.formatDistance(train.distance);
    if (this.elements.heroSpeed) this.elements.heroSpeed.textContent = train.velocity ? Math.round(train.velocity) : '0';
    if (this.elements.heroHeading) this.elements.heroHeading.textContent = `${train.bearingArrow || ''} ${train.bearing || train.heading || '—'}`;
    if (this.elements.heroOrigin) this.elements.heroOrigin.textContent = train.origName || '?';
    if (this.elements.heroDestination) this.elements.heroDestination.textContent = train.destName || '?';

    // Next station
    const nextStation = AmtrakerClient.getNextStation(train);
    if (this.elements.heroNextStation) {
      this.elements.heroNextStation.textContent = nextStation ? nextStation.name : '—';
    }

    // Status badge
    const statusText = AmtrakerClient.getStatusText(train);
    if (this.elements.heroStatusBadge) {
      this.elements.heroStatusBadge.textContent = statusText;
      const color = AmtrakerClient.getStatusColor(train);
      this.elements.heroStatusBadge.style.background = color;
    }

    // Route links
    const heroLinks = document.getElementById('hero-links');
    if (heroLinks) {
      const amtrakerURL = AmtrakerClient.getAmtrakerURL(train);
      const transitDocsURL = AmtrakerClient.getTransitDocsURL(train);
      heroLinks.innerHTML = `
        <a href="${amtrakerURL}" target="_blank" rel="noopener" class="btn btn-primary btn-small" style="text-decoration:none;font-size:13px;">🔗 View on Amtraker ↗</a>
        <a href="${transitDocsURL}" target="_blank" rel="noopener" class="btn btn-small" style="text-decoration:none;font-size:13px;">🗺️ TransitDocs ↗</a>
      `;
    }
  },

  /**
   * Update the nearby trains list (shown below the hero card in the spotted section)
   * Since the HTML doesn't have a separate nearby list, we render nearby into the history area
   * and show history below. We'll render nearby trains as part of updateHistoryList.
   */
  updateNearbyList(trains) {
    // Nearby trains don't have their own container in this HTML layout,
    // so we skip this (they appear on the map and in stats)
  },

  /**
   * Update stations list
   */
  updateStationsList(stations) {
    const container = this.elements.stationList;
    const section = this.elements.stationsSection;
    if (!container) return;

    if (!stations || stations.length === 0) {
      if (section) section.classList.add('hidden');
      container.innerHTML = '';
      return;
    }

    if (section) section.classList.remove('hidden');
    if (this.elements.stationsCount) {
      this.elements.stationsCount.textContent = `${stations.length} station${stations.length !== 1 ? 's' : ''}`;
    }

    container.innerHTML = stations.slice(0, 10).map(station => `
      <div class="station-item" data-station-code="${station.code}">
        <div>
          <div class="station-name">🚉 ${station.name}</div>
          <div class="station-detail">${station.code} · ${station.trains ? station.trains.length : 0} trains</div>
        </div>
        <div class="station-distance">${Tracker.formatDistance(station.distance)}</div>
      </div>
    `).join('');

    // Click to center on station
    container.querySelectorAll('.station-item').forEach(el => {
      el.addEventListener('click', () => {
        const code = el.dataset.stationCode;
        const station = stations.find(s => s.code === code);
        if (station) {
          MapManager.centerOn(station.lat, station.lon, 13);
          const marker = MapManager.stationMarkers.get(code);
          if (marker) marker.openPopup();
        }
      });
    });
  },

  /**
   * Update spotted/history list
   */
  updateHistoryList(history) {
    const container = this.elements.trainHistory;
    if (!container) return;

    if (!history || history.length === 0) {
      container.innerHTML = '<div class="waiting-state" style="padding:24px;"><p>No trains spotted yet. Stay tuned!</p></div>';
      return;
    }

    container.innerHTML = history
      .sort((a, b) => b.firstSeen - a.firstSeen)
      .slice(0, 30)
      .map(entry => `
        <div class="train-item">
          <div class="train-item-left">
            <div class="train-icon" style="background: ${entry.provider === 'Brightline' ? '#eab308' : entry.provider === 'Via' ? '#dc2626' : '#2563eb'};">
              ${AmtrakerClient.getProviderEmoji(entry)}
            </div>
            <div class="train-info">
              <span class="train-name">${entry.routeName || 'Unknown'}</span>
              <span class="train-route">#${entry.trainNum} · ${entry.provider || 'Amtrak'} · ${entry.origName || '?'} → ${entry.destName || '?'}</span>
              <span class="train-route"><a href="https://amtraker.com/trains/${entry.trainNum}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none;font-size:11px;">View Route ↗</a></span>
            </div>
          </div>
          <div class="train-item-right">
            <div class="train-distance">${Tracker.formatDistance(entry.closestDistance)}</div>
            <div class="train-speed">${Tracker.timeAgo(entry.lastSeen)}</div>
          </div>
        </div>
      `).join('');
  },

  /**
   * Update location display
   */
  updateLocationName(name) {
    if (this.elements.locationName) {
      this.elements.locationName.textContent = name || 'Unknown Location';
    }
  },

  /**
   * Update status bar
   */
  setStatus(status, text) {
    const indicator = this.elements.statusIndicator;
    const statusText = this.elements.statusText;

    if (!indicator || !statusText) return;

    indicator.className = 'status-indicator';
    switch (status) {
      case 'active':
        indicator.classList.add('success');
        break;
      case 'loading':
        indicator.classList.add('loading');
        break;
      case 'error':
        indicator.classList.add('error');
        break;
      case 'paused':
        break;
    }

    statusText.textContent = text || '';

    // Update last update time
    if (status === 'active' && this.elements.lastUpdate) {
      this.elements.lastUpdate.textContent = new Date().toLocaleTimeString();
    }
  },

  /**
   * Update countdown timer
   */
  updateCountdown(seconds) {
    if (this.elements.nextUpdateCountdown) {
      this.elements.nextUpdateCountdown.textContent = seconds > 0 ? `Next: ${seconds}s` : '';
    }
  },

  /**
   * Show search results
   */
  showSearchResults(results, container, onSelect) {
    if (!container) return;
    container.innerHTML = '';

    if (results.length === 0) {
      container.innerHTML = '<div style="padding:12px;color:var(--text-muted);text-align:center;">No results found</div>';
      return;
    }

    results.forEach(result => {
      const div = document.createElement('div');
      div.className = 'saved-location-card';
      div.innerHTML = `
        <div>
          <div class="location-name">${result.name}</div>
          <div class="location-coords">${Location.formatCoords(result.lat, result.lon)}</div>
        </div>
      `;
      div.addEventListener('click', () => onSelect(result));
      container.appendChild(div);
    });
  },

  /**
   * Show saved locations in change location modal
   * @param {Array} locations - Array of {name, lat, lon, radius}
   * @param {string} activeLocationName
   * @param {Function} onSelect
   */
  showSavedLocations(locations, activeLocationName, onSelect) {
    const container = this.elements.modalSavedLocations;
    if (!container) return;

    container.innerHTML = '';

    if (!locations || locations.length === 0) {
      container.innerHTML = '<div style="padding:12px;color:var(--text-muted);">No saved locations yet</div>';
      return;
    }

    container.innerHTML = '<h4 style="margin: 12px 0 8px; font-size: 14px;">📌 Saved Locations</h4>';

    locations.forEach(loc => {
      const div = document.createElement('div');
      div.className = `saved-location-card`;
      div.style.borderColor = loc.name === activeLocationName ? 'var(--accent)' : '';
      div.innerHTML = `
        <div>
          <div class="location-name">${loc.name} ${loc.name === activeLocationName ? '✓' : ''}</div>
          <div class="location-coords">${Location.formatCoords(loc.lat, loc.lon)} · ${loc.radius || 10} mi</div>
        </div>
      `;
      div.addEventListener('click', () => onSelect(loc.name, loc));
      container.appendChild(div);
    });
  },

  /**
   * Show a toast notification
   */
  showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s;
      background: ${type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#3b82f6'};
      color: white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;

    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; });

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  /**
   * Open settings modal
   */
  openSettings() {
    if (this.elements.settingsModal) {
      this.elements.settingsModal.classList.remove('hidden');

      // Populate current settings
      const settings = Storage.getSettings();
      if (this.elements.settingRadius) {
        this.elements.settingRadius.value = settings.radius;
      }
      if (this.elements.settingRefresh) {
        this.elements.settingRefresh.value = settings.refreshInterval;
      }
      if (this.elements.settingAmtrak) this.elements.settingAmtrak.checked = settings.providers.amtrak;
      if (this.elements.settingVia) this.elements.settingVia.checked = settings.providers.via;
      if (this.elements.settingBrightline) this.elements.settingBrightline.checked = settings.providers.brightline;
      if (this.elements.settingNightPause) this.elements.settingNightPause.checked = settings.nightPause || false;
    }
  },

  /**
   * Close settings modal
   */
  closeSettings() {
    if (this.elements.settingsModal) {
      this.elements.settingsModal.classList.add('hidden');
    }
  },

  /**
   * Open change location modal
   */
  openChangeLocation() {
    if (this.elements.changeLocationModal) {
      this.elements.changeLocationModal.classList.remove('hidden');
    }
  },

  /**
   * Close change location modal
   */
  closeChangeLocation() {
    if (this.elements.changeLocationModal) {
      this.elements.changeLocationModal.classList.add('hidden');
    }
  },

  /**
   * Apply theme
   */
  applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    MapManager.setTheme(theme !== 'light');
  }
};

window.UI = UI;
