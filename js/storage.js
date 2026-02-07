/**
 * Storage Manager - localStorage wrapper for Dick Wallner Train Tracker
 * Stores locations, settings, and train spotting history
 */

const Storage = {
  KEYS: {
    SETTINGS: 'nt_settings',
    LOCATIONS: 'nt_locations',
    ACTIVE_LOCATION: 'nt_active_location',
    HISTORY: 'nt_history',
    SESSION: 'nt_session',
    FIRST_VISIT: 'nt_visited'
  },

  // Settings
  getSettings() {
    try {
      const stored = localStorage.getItem(this.KEYS.SETTINGS);
      const defaults = {
        refreshInterval: 60,
        radius: 10,
        nightPause: false,
        nightStart: '23:00',
        nightEnd: '06:00',
        providers: {
          amtrak: true,
          via: true,
          brightline: true,
          lirr: true,
          metroNorth: true
        }
      };
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge provider defaults so new providers are enabled
        if (parsed.providers) parsed.providers = { ...defaults.providers, ...parsed.providers };
        return { ...defaults, ...parsed };
      }
      return defaults;
    } catch {
      return {
        refreshInterval: 60,
        radius: 10,
        nightPause: false,
        nightStart: '23:00',
        nightEnd: '06:00',
        providers: { amtrak: true, via: true, brightline: true, lirr: true, metroNorth: true }
      };
    }
  },

  saveSettings(settings) {
    localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
  },

  // Locations
  getLocations() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.LOCATIONS)) || [];
    } catch {
      return [];
    }
  },

  saveLocation(name, lat, lon, radius = 10) {
    const locations = this.getLocations();
    const existing = locations.findIndex(l => l.name === name);
    const location = { name, lat, lon, radius, savedAt: Date.now() };

    if (existing >= 0) {
      locations[existing] = location;
    } else {
      locations.push(location);
    }

    localStorage.setItem(this.KEYS.LOCATIONS, JSON.stringify(locations));
    this.setActiveLocation(name);
    return location;
  },

  deleteLocation(name) {
    const locations = this.getLocations().filter(l => l.name !== name);
    localStorage.setItem(this.KEYS.LOCATIONS, JSON.stringify(locations));
  },

  getActiveLocation() {
    const name = localStorage.getItem(this.KEYS.ACTIVE_LOCATION);
    if (!name) return null;
    return this.getLocations().find(l => l.name === name) || null;
  },

  setActiveLocation(name) {
    localStorage.setItem(this.KEYS.ACTIVE_LOCATION, name);
  },

  // History (train spotting log)
  getHistory() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.HISTORY)) || [];
    } catch {
      return [];
    }
  },

  addSpotting(train) {
    const history = this.getHistory();

    // Check if we already spotted this exact train today
    const today = new Date().toDateString();
    const existing = history.findIndex(h =>
      h.trainID === train.trainID &&
      new Date(h.firstSeen).toDateString() === today &&
      h.locationName === train.locationName
    );

    if (existing >= 0) {
      // Update closest approach if this one is closer
      if (train.distance < history[existing].closestDistance) {
        history[existing].closestDistance = train.distance;
        history[existing].closestTime = Date.now();
      }
      history[existing].lastSeen = Date.now();
      history[existing].sightings = (history[existing].sightings || 1) + 1;
    } else {
      history.push({
        trainID: train.trainID,
        trainNum: train.trainNum,
        routeName: train.routeName,
        provider: train.provider,
        origName: train.origName,
        destName: train.destName,
        locationName: train.locationName,
        closestDistance: train.distance,
        closestTime: Date.now(),
        speed: train.velocity,
        heading: train.heading,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        sightings: 1
      });
    }

    // Keep last 500 entries max
    const trimmed = history.slice(-500);
    localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(trimmed));
  },

  getTodayHistory(locationName = null) {
    const today = new Date().toDateString();
    return this.getHistory().filter(h => {
      const isToday = new Date(h.firstSeen).toDateString() === today;
      if (locationName) return isToday && h.locationName === locationName;
      return isToday;
    });
  },

  clearHistory(all = false) {
    if (all) {
      localStorage.removeItem(this.KEYS.HISTORY);
    }
  },

  // Session
  getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(this.KEYS.SESSION)) || {};
    } catch {
      return {};
    }
  },

  saveSession(data) {
    sessionStorage.setItem(this.KEYS.SESSION, JSON.stringify(data));
  },

  // First Visit
  isFirstVisit() {
    return !localStorage.getItem(this.KEYS.FIRST_VISIT);
  },

  markVisited() {
    localStorage.setItem(this.KEYS.FIRST_VISIT, Date.now().toString());
  },

  // Export/Import
  exportData() {
    return JSON.stringify({
      settings: this.getSettings(),
      locations: this.getLocations(),
      activeLocation: localStorage.getItem(this.KEYS.ACTIVE_LOCATION),
      history: this.getHistory(),
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    }, null, 2);
  },

  importData(data) {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (parsed.settings) this.saveSettings(parsed.settings);
    if (parsed.locations) localStorage.setItem(this.KEYS.LOCATIONS, JSON.stringify(parsed.locations));
    if (parsed.activeLocation) localStorage.setItem(this.KEYS.ACTIVE_LOCATION, parsed.activeLocation);
    if (parsed.history) localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(parsed.history));
  },

  clearAll() {
    Object.values(this.KEYS).forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  }
};

window.Storage = Storage;
