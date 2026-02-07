/**
 * Train Tracker
 * Manages train state, nearby detection, closest approach tracking,
 * and spotting log entries
 */

const Tracker = {
  // Current state
  currentTrains: [],
  nearbyTrains: [],
  closestTrain: null,
  nearbyStations: [],

  // Previous state for comparison
  previousTrains: new Map(), // trainID -> previous distance

  // Session stats
  session: {
    spotted: 0,
    closestDistance: Infinity,
    closestTrain: null,
    totalSpeed: 0,
    speedCount: 0,
    startTime: Date.now()
  },

  /**
   * Process a fresh batch of train data
   * @param {Array} trains - All trains from API (already filtered by provider)
   * @param {number} userLat - User's latitude
   * @param {number} userLon - User's longitude
   * @param {number} radius - Detection radius in miles
   * @returns {Object} { nearby, closest, stats }
   */
  processTrains(trains, userLat, userLon, radius) {
    // Calculate distance for all trains
    const trainsWithDistance = trains.map(train => ({
      ...train,
      distance: AmtrakerClient.haversineDistance(userLat, userLon, train.lat, train.lon),
      bearing: Location.getBearing(userLat, userLon, train.lat, train.lon),
      bearingArrow: Location.getBearingArrow(
        Location.getBearing(userLat, userLon, train.lat, train.lon)
      )
    }));

    // Filter nearby trains
    const nearby = trainsWithDistance
      .filter(t => t.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

    // Track closest approach for each train
    nearby.forEach(train => {
      const prevDistance = this.previousTrains.get(train.trainID);
      const isApproaching = prevDistance !== undefined && train.distance < prevDistance;
      const isReceding = prevDistance !== undefined && train.distance > prevDistance;

      train.approaching = isApproaching;
      train.receding = isReceding;

      // Closest approach detection
      if (prevDistance !== undefined && train.distance > prevDistance) {
        // Train is now moving away — previous distance was the closest approach
        train.closestApproach = prevDistance;
      }

      // Log to spotting history
      this.logSpotting(train, userLat, userLon);
    });

    // Update previous distances
    this.previousTrains.clear();
    trainsWithDistance.forEach(t => {
      this.previousTrains.set(t.trainID, t.distance);
    });

    // Find closest train
    const closest = nearby.length > 0 ? nearby[0] : null;

    // Update session stats
    if (closest) {
      if (closest.distance < this.session.closestDistance) {
        this.session.closestDistance = closest.distance;
        this.session.closestTrain = closest;
      }
    }

    nearby.forEach(t => {
      if (t.velocity && t.velocity > 0) {
        this.session.totalSpeed += t.velocity;
        this.session.speedCount++;
      }
    });

    // Store current state
    this.currentTrains = trainsWithDistance;
    this.nearbyTrains = nearby;
    this.closestTrain = closest;

    return {
      all: trainsWithDistance,
      nearby,
      closest,
      stats: this.getStats()
    };
  },

  /**
   * Log a train spotting to storage
   */
  logSpotting(train, userLat, userLon) {
    const activeLocation = Storage.getActiveLocation();
    const locationName = activeLocation ? activeLocation.name : 'Unknown';

    const spottingData = {
      trainID: train.trainID,
      trainNum: train.trainNum,
      routeName: train.routeName || 'Unknown Route',
      provider: train.provider || 'Amtrak',
      distance: train.distance,
      lat: train.lat,
      lon: train.lon,
      velocity: train.velocity || 0,
      heading: train.heading || '',
      bearing: train.bearing,
      origName: train.origName || '',
      destName: train.destName || '',
      trainState: train.trainState || 'Active',
      locationName
    };

    const added = Storage.addSpotting(spottingData);
    if (added) {
      this.session.spotted++;
      // ✨ Confetti burst for newly spotted train!
      if (typeof Effects !== 'undefined') {
        Effects.celebrateNewTrain();
      }
    }
  },

  /**
   * Process station data
   */
  processStations(stations) {
    this.nearbyStations = stations;
    return stations;
  },

  /**
   * Get current stats
   */
  getStats() {
    const activeLocation = Storage.getActiveLocation();
    const locationName = activeLocation ? activeLocation.name : null;
    const todayHistory = locationName ? Storage.getTodayHistory(locationName) : [];

    return {
      nearbyCount: this.nearbyTrains.length,
      spottedToday: todayHistory.length,
      closestDistance: this.closestTrain ? this.closestTrain.distance : null,
      closestName: this.closestTrain ? (this.closestTrain.routeName || `Train ${this.closestTrain.trainNum}`) : null,
      avgSpeed: this.session.speedCount > 0
        ? Math.round(this.session.totalSpeed / this.session.speedCount)
        : null,
      sessionClosest: this.session.closestDistance < Infinity
        ? this.session.closestDistance
        : null,
      sessionClosestName: this.session.closestTrain
        ? (this.session.closestTrain.routeName || `Train ${this.session.closestTrain.trainNum}`)
        : null,
      stationCount: this.nearbyStations.length
    };
  },

  /**
   * Get today's spotting history
   */
  getTodayHistory() {
    const activeLocation = Storage.getActiveLocation();
    const locationName = activeLocation ? activeLocation.name : null;
    return locationName ? Storage.getTodayHistory(locationName) : [];
  },

  /**
   * Get all spotting history
   */
  getAllHistory() {
    return Storage.getHistory();
  },

  /**
   * Reset session stats
   */
  resetSession() {
    this.session = {
      spotted: 0,
      closestDistance: Infinity,
      closestTrain: null,
      totalSpeed: 0,
      speedCount: 0,
      startTime: Date.now()
    };
    this.previousTrains.clear();
    this.currentTrains = [];
    this.nearbyTrains = [];
    this.closestTrain = null;
    this.nearbyStations = [];
  },

  /**
   * Format distance for display
   */
  formatDistance(miles) {
    if (miles === null || miles === undefined) return '—';
    if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
    if (miles < 1) return `${miles.toFixed(2)} mi`;
    if (miles < 10) return `${miles.toFixed(1)} mi`;
    return `${Math.round(miles)} mi`;
  },

  /**
   * Format speed for display
   */
  formatSpeed(mph) {
    if (!mph || mph <= 0) return 'Stopped';
    return `${Math.round(mph)} mph`;
  },

  /**
   * Get time ago string
   */
  timeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
};

window.Tracker = Tracker;
