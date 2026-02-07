/**
 * Map Manager
 * Leaflet map with train markers, station markers, user location, and detection radius
 */

const MapManager = {
  map: null,
  userMarker: null,
  radiusCircle: null,
  trainMarkers: new Map(),
  stationMarkers: new Map(),
  stationsVisible: true,
  trainPaths: new Map(),

  // Custom train icon
  createTrainIcon(train, isClosest = false) {
    const provider = (train.provider || '').toLowerCase();
    let color = '#3b82f6'; // default blue
    let emoji = '🚆';

    if (provider === 'brightline') { color = '#eab308'; emoji = '🚄'; }
    else if (provider === 'via') { color = '#dc2626'; emoji = '🚃'; }
    else { color = '#2563eb'; emoji = '🚆'; }

    // Use iconColor for on-time status
    if (train.iconColor) color = train.iconColor;

    const size = isClosest ? 36 : 28;
    const borderWidth = isClosest ? 3 : 2;
    const shadow = isClosest ? '0 0 12px rgba(59,130,246,0.6)' : '0 2px 4px rgba(0,0,0,0.3)';

    return L.divIcon({
      className: 'train-map-marker',
      html: `<div style="
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isClosest ? 20 : 16}px;
        background: ${color};
        border: ${borderWidth}px solid white;
        border-radius: 50%;
        box-shadow: ${shadow};
        cursor: pointer;
        transition: transform 0.3s;
      ">${emoji}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    });
  },

  // Station icon
  createStationIcon() {
    return L.divIcon({
      className: 'station-map-marker',
      html: `<div style="
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        background: var(--bg-secondary, #1e293b);
        border: 2px solid var(--accent-primary, #3b82f6);
        border-radius: 3px;
        cursor: pointer;
      ">🚉</div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -10]
    });
  },

  /**
   * Initialize the map
   */
  init(lat, lon, zoom = 10) {
    if (this.map) {
      this.map.remove();
    }

    this.map = L.map('train-map', {
      center: [lat, lon],
      zoom: zoom,
      zoomControl: true,
      attributionControl: true
    });

    // Dark tile layer
    const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    });

    // Light tile layer
    const lightTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    });

    // Always use light tiles
    lightTiles.addTo(this.map);

    // Store tile layers for theme switching
    this._darkTiles = darkTiles;
    this._lightTiles = lightTiles;
    this._currentTiles = lightTiles;

    // Add user location marker
    this.userMarker = L.marker([lat, lon], {
      icon: L.divIcon({
        className: 'user-marker',
        html: `<div style="
          width: 20px;
          height: 20px;
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(59,130,246,0.5);
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      }),
      zIndexOffset: 1000
    }).addTo(this.map);

    this.userMarker.bindPopup('<strong>📍 Your Location</strong>');

    // Add detection radius circle
    const settings = Storage.getSettings();
    this.radiusCircle = L.circle([lat, lon], {
      radius: settings.radius * 1609.34, // miles to meters
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.05,
      weight: 1,
      dashArray: '5,5'
    }).addTo(this.map);

    // Fit map to radius
    this.map.fitBounds(this.radiusCircle.getBounds(), { padding: [20, 20] });

    return this.map;
  },

  /**
   * Update user location on the map
   */
  updateUserLocation(lat, lon) {
    if (this.userMarker) {
      this.userMarker.setLatLng([lat, lon]);
    }
    if (this.radiusCircle) {
      this.radiusCircle.setLatLng([lat, lon]);
    }
  },

  /**
   * Update detection radius
   */
  updateRadius(radiusMiles) {
    if (this.radiusCircle) {
      this.radiusCircle.setRadius(radiusMiles * 1609.34);
    }
  },

  /**
   * Update train markers on the map
   */
  updateTrains(trains, closestTrainID = null) {
    const activeTrainIDs = new Set();

    trains.forEach(train => {
      if (!train.lat || !train.lon) return;
      activeTrainIDs.add(train.trainID);

      const isClosest = train.trainID === closestTrainID;
      const icon = this.createTrainIcon(train, isClosest);

      if (this.trainMarkers.has(train.trainID)) {
        // Update existing marker
        const marker = this.trainMarkers.get(train.trainID);
        marker.setLatLng([train.lat, train.lon]);
        marker.setIcon(icon);
        marker.setPopupContent(this.createTrainPopup(train));
        if (isClosest) marker.setZIndexOffset(999);
        else marker.setZIndexOffset(0);
      } else {
        // Create new marker
        const marker = L.marker([train.lat, train.lon], {
          icon: icon,
          zIndexOffset: isClosest ? 999 : 0
        }).addTo(this.map);

        marker.bindPopup(this.createTrainPopup(train));
        this.trainMarkers.set(train.trainID, marker);
      }
    });

    // Remove markers for trains no longer tracked
    for (const [trainID, marker] of this.trainMarkers) {
      if (!activeTrainIDs.has(trainID)) {
        marker.remove();
        this.trainMarkers.delete(trainID);
      }
    }
  },

  /**
   * Create popup content for a train marker
   */
  createTrainPopup(train) {
    const status = AmtrakerClient.getStatusText(train);
    const nextStation = AmtrakerClient.getNextStation(train);
    const nextStationText = nextStation ? nextStation.name : '—';
    const speed = train.velocity ? `${Math.round(train.velocity)} mph` : 'Stopped';
    const distance = train.distance !== undefined ? Tracker.formatDistance(train.distance) : '';

    const amtrakerURL = AmtrakerClient.getAmtrakerURL(train);
    const transitDocsURL = AmtrakerClient.getTransitDocsURL(train);

    return `
      <div style="min-width: 220px; font-family: system-ui, sans-serif;">
        <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">
          ${AmtrakerClient.getProviderEmoji(train)} ${train.routeName || 'Unknown'}
        </div>
        <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
          Train #${train.trainNum} · ${train.provider || 'Amtrak'}
        </div>
        <div style="font-size: 12px; line-height: 1.6;">
          <div>📍 ${distance} away</div>
          <div>🚄 ${speed} · ${train.heading || '—'}</div>
          <div>📊 ${status}</div>
          <div>🔜 Next: ${nextStationText}</div>
          <div>🛤️ ${train.origName || '?'} → ${train.destName || '?'}</div>
        </div>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <a href="${amtrakerURL}" target="_blank" rel="noopener" style="font-size:11px;padding:4px 10px;background:#2563eb;color:white;border-radius:12px;text-decoration:none;font-weight:600;">View on Amtraker ↗</a>
          <a href="${transitDocsURL}" target="_blank" rel="noopener" style="font-size:11px;padding:4px 10px;background:#475569;color:white;border-radius:12px;text-decoration:none;font-weight:600;">TransitDocs ↗</a>
        </div>
      </div>
    `;
  },

  /**
   * Update station markers on the map
   */
  updateStations(stations) {
    // Clear old station markers
    for (const [, marker] of this.stationMarkers) {
      marker.remove();
    }
    this.stationMarkers.clear();

    if (!this.stationsVisible) return;

    stations.forEach(station => {
      if (!station.lat || !station.lon) return;

      const marker = L.marker([station.lat, station.lon], {
        icon: this.createStationIcon(),
        zIndexOffset: -100
      }).addTo(this.map);

      const trainCount = station.trains ? station.trains.length : 0;
      marker.bindPopup(`
        <div style="min-width: 150px; font-family: system-ui, sans-serif;">
          <div style="font-weight: 700; font-size: 13px;">🚉 ${station.name}</div>
          <div style="font-size: 12px; color: #666;">${station.code} · ${Tracker.formatDistance(station.distance)} away</div>
          <div style="font-size: 12px; margin-top: 4px;">${trainCount} train${trainCount !== 1 ? 's' : ''} scheduled</div>
          ${station.address1 ? `<div style="font-size: 11px; color: #888; margin-top: 2px;">${station.address1}</div>` : ''}
        </div>
      `);

      this.stationMarkers.set(station.code, marker);
    });
  },

  /**
   * Toggle station visibility
   */
  toggleStations(visible) {
    this.stationsVisible = visible;
    if (!visible) {
      for (const [, marker] of this.stationMarkers) {
        marker.remove();
      }
      this.stationMarkers.clear();
    }
  },

  /**
   * Switch map theme
   */
  setTheme(isDark) {
    if (!this.map) return;

    if (this._currentTiles) {
      this.map.removeLayer(this._currentTiles);
    }

    this._currentTiles = isDark ? this._darkTiles : this._lightTiles;
    this._currentTiles.addTo(this.map);
  },

  /**
   * Center map on coordinates
   */
  centerOn(lat, lon, zoom) {
    if (this.map) {
      if (zoom) {
        this.map.setView([lat, lon], zoom);
      } else {
        this.map.panTo([lat, lon]);
      }
    }
  },

  /**
   * Fit map to show all nearby trains
   */
  fitToTrains() {
    if (!this.map || this.trainMarkers.size === 0) return;

    const group = L.featureGroup([...this.trainMarkers.values()]);
    if (this.userMarker) group.addLayer(this.userMarker);
    this.map.fitBounds(group.getBounds(), { padding: [30, 30] });
  },

  /**
   * Invalidate map size (call after container resize)
   */
  invalidateSize() {
    if (this.map) {
      setTimeout(() => this.map.invalidateSize(), 100);
    }
  },

  /**
   * Destroy map
   */
  destroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.trainMarkers.clear();
    this.stationMarkers.clear();
  }
};

window.MapManager = MapManager;
