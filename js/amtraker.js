/**
 * Amtraker API Client
 * Free, CORS-enabled, no auth required
 * Provides real-time train data for Amtrak, VIA Rail, and Brightline
 * API: https://api-v3.amtraker.com/v3/
 */

const AmtrakerClient = {
  BASE_URL: 'https://api-v3.amtraker.com/v3',

  lastCall: 0,
  minInterval: 5000, // 5 seconds between calls

  async rateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastCall;
    if (elapsed < this.minInterval) {
      await new Promise(r => setTimeout(r, this.minInterval - elapsed));
    }
    this.lastCall = Date.now();
  },

  /**
   * Fetch all active trains
   * Returns object keyed by train number, each containing array of train objects
   */
  async getAllTrains() {
    await this.rateLimit();

    const response = await fetch(`${this.BASE_URL}/trains`);
    if (!response.ok) {
      throw new Error(`Amtraker API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  },

  /**
   * Fetch a specific train by number
   */
  async getTrain(trainNum) {
    await this.rateLimit();

    const response = await fetch(`${this.BASE_URL}/trains/${trainNum}`);
    if (!response.ok) {
      throw new Error(`Amtraker API error: ${response.status}`);
    }

    return await response.json();
  },

  /**
   * Fetch all stations
   */
  async getAllStations() {
    await this.rateLimit();

    const response = await fetch(`${this.BASE_URL}/stations`);
    if (!response.ok) {
      throw new Error(`Amtraker API error: ${response.status}`);
    }

    return await response.json();
  },

  /**
   * Fetch a specific station
   */
  async getStation(stationCode) {
    await this.rateLimit();

    const response = await fetch(`${this.BASE_URL}/stations/${stationCode}`);
    if (!response.ok) {
      throw new Error(`Amtraker API error: ${response.status}`);
    }

    return await response.json();
  },

  /**
   * Check if the API data is stale
   */
  async checkStale() {
    const response = await fetch(`${this.BASE_URL}/stale`);
    return await response.json();
  },

  /**
   * Flatten the trains response into a simple array
   * The API returns { "1": [trainObj, ...], "3": [trainObj, ...], ... }
   */
  flattenTrains(trainsData) {
    const trains = [];
    for (const trainNum of Object.keys(trainsData)) {
      const trainArray = trainsData[trainNum];
      if (Array.isArray(trainArray)) {
        for (const train of trainArray) {
          trains.push(train);
        }
      }
    }
    return trains;
  },

  /**
   * Get all trains as a flat array, filtered by provider
   * @param {Object} providerFilter - { amtrak: true, via: true, brightline: true }
   */
  async getTrainsFlat(providerFilter = null) {
    const data = await this.getAllTrains();
    let trains = this.flattenTrains(data);

    // Filter by provider if specified
    if (providerFilter) {
      trains = trains.filter(t => {
        const provider = (t.provider || '').toLowerCase();
        if (provider === 'amtrak' && !providerFilter.amtrak) return false;
        if (provider === 'via' && !providerFilter.via) return false;
        if (provider === 'brightline' && !providerFilter.brightline) return false;
        return true;
      });
    }

    // Filter out trains without valid coordinates
    trains = trains.filter(t => t.lat && t.lon && t.lat !== 0 && t.lon !== 0);

    return trains;
  },

  /**
   * Calculate distance between two points using Haversine formula
   * Returns distance in miles
   */
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  /**
   * Get trains near a specific point
   * @param {number} lat - Center latitude
   * @param {number} lon - Center longitude
   * @param {number} radiusMiles - Radius in miles
   * @param {Object} providerFilter - Provider filter
   * @returns {Promise<Array>} Array of trains with distance added
   */
  async getTrainsNearPoint(lat, lon, radiusMiles, providerFilter = null) {
    const allTrains = await this.getTrainsFlat(providerFilter);

    const nearbyTrains = allTrains
      .map(train => ({
        ...train,
        distance: this.haversineDistance(lat, lon, train.lat, train.lon)
      }))
      .filter(train => train.distance <= radiusMiles)
      .sort((a, b) => a.distance - b.distance);

    return nearbyTrains;
  },

  /**
   * Get stations near a specific point
   * @param {number} lat - Center latitude
   * @param {number} lon - Center longitude
   * @param {number} radiusMiles - Radius in miles
   * @returns {Promise<Array>} Array of stations with distance added
   */
  async getStationsNearPoint(lat, lon, radiusMiles) {
    const allStations = await this.getAllStations();

    const stations = Object.values(allStations)
      .filter(s => s.lat && s.lon && s.lat !== 0 && s.lon !== 0)
      .map(station => ({
        ...station,
        distance: this.haversineDistance(lat, lon, station.lat, station.lon)
      }))
      .filter(station => station.distance <= radiusMiles)
      .sort((a, b) => a.distance - b.distance);

    return stations;
  },

  /**
   * Get the next station for a train (first "Enroute" station)
   */
  getNextStation(train) {
    if (!train.stations || !Array.isArray(train.stations)) return null;

    const next = train.stations.find(s => s.status === 'Enroute');
    if (next) return next;

    // If no Enroute, find first non-Departed station
    return train.stations.find(s => s.status !== 'Departed' && s.status !== 'Station') || null;
  },

  /**
   * Get on-time status text from iconColor
   */
  getStatusText(train) {
    const color = (train.iconColor || '').toLowerCase();
    if (color.includes('2a893d') || color.includes('16a34a') || color.startsWith('#2')) return 'On Time';
    if (color.includes('ca8a') || color.includes('f59e') || color.includes('c4840f') || color.includes('c6')) return 'Delayed';
    if (color.includes('dc26') || color.includes('c60b')) return 'Late';
    if (color === '#212529') return 'Predeparture';
    return train.trainTimely || 'Active';
  },

  /**
   * Get CSS color class for status
   */
  getStatusColor(train) {
    const color = (train.iconColor || '').toLowerCase();
    if (color.includes('2a893d') || color.includes('298c') || color.includes('2c92') || color.includes('389') || color.includes('409') || color.includes('16a34a')) return 'var(--train-green)';
    if (color.includes('c48') || color.includes('c68') || color.includes('c67') || color.includes('c66') || color.includes('c65') || color.includes('c28') || color.includes('bca') || color.includes('b6b7')) return 'var(--train-yellow)';
    if (color.includes('c60b') || color.includes('c63c') || color.includes('c647') || color.includes('c64') || color.includes('dc26')) return 'var(--train-red)';
    return 'var(--text-muted)';
  },

  /**
   * Get Amtraker.com URL for a specific train instance
   */
  getAmtrakerURL(train) {
    if (train.trainID && train.trainID.includes('-')) {
      const parts = train.trainID.split('-');
      return `https://amtraker.com/trains/${parts[0]}/${parts[1]}`;
    }
    return `https://amtraker.com/trains/${train.trainNum}`;
  },

  /**
   * Get Transitdocs URL for a train
   */
  getTransitDocsURL(train) {
    return `https://asm.transitdocs.com/train/${train.trainNum}`;
  },

  /**
   * Get provider emoji
   */
  getProviderEmoji(train) {
    const provider = (train.provider || '').toLowerCase();
    if (provider === 'brightline') return '🟡';
    if (provider === 'via') return '🍁';
    return '🚆';
  }
};

window.AmtrakerClient = AmtrakerClient;
