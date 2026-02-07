/**
 * Location Manager
 * Handles geolocation, geocoding, and saved locations
 * Uses Nominatim for geocoding (free, no auth, 1 req/sec)
 */

const Location = {
  NOMINATIM_URL: 'https://nominatim.openstreetmap.org',

  /**
   * Get current position from browser geolocation API
   * @returns {Promise<{lat: number, lon: number, accuracy: number}>}
   */
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          switch (error.code) {
            case error.PERMISSION_DENIED:
              reject(new Error('Location permission denied. Please enter your location manually.'));
              break;
            case error.POSITION_UNAVAILABLE:
              reject(new Error('Location information unavailable.'));
              break;
            case error.TIMEOUT:
              reject(new Error('Location request timed out.'));
              break;
            default:
              reject(new Error('Unknown location error.'));
          }
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  },

  /**
   * Reverse geocode coordinates to get a human-readable name
   * @param {number} lat
   * @param {number} lon
   * @returns {Promise<string>} Location name
   */
  async reverseGeocode(lat, lon) {
    try {
      const response = await fetch(
        `${this.NOMINATIM_URL}/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
        {
          headers: { 'User-Agent': 'NearbyTrains/1.0' }
        }
      );

      if (!response.ok) throw new Error('Geocoding failed');

      const data = await response.json();
      const addr = data.address || {};

      // Build a nice name: city, state or county, state
      const city = addr.city || addr.town || addr.village || addr.hamlet || addr.suburb || '';
      const state = addr.state || '';

      if (city && state) return `${city}, ${state}`;
      if (city) return city;
      if (state) return state;

      return data.display_name ? data.display_name.split(',').slice(0, 2).join(',').trim() : `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    } catch (e) {
      console.warn('Reverse geocoding failed:', e);
      return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    }
  },

  /**
   * Search for a location by name
   * @param {string} query
   * @returns {Promise<Array<{name: string, lat: number, lon: number}>>}
   */
  async searchLocation(query) {
    if (!query || query.trim().length < 2) return [];

    try {
      const response = await fetch(
        `${this.NOMINATIM_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=us,ca,mx`,
        {
          headers: { 'User-Agent': 'NearbyTrains/1.0' }
        }
      );

      if (!response.ok) throw new Error('Search failed');

      const results = await response.json();
      return results.map(r => ({
        name: r.display_name.split(',').slice(0, 3).join(',').trim(),
        fullName: r.display_name,
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon)
      }));
    } catch (e) {
      console.error('Location search error:', e);
      return [];
    }
  },

  /**
   * Parse manual coordinate input
   * Supports formats: "40.7128, -74.0060" or "40.7128 -74.0060"
   * @param {string} input
   * @returns {{lat: number, lon: number}|null}
   */
  parseCoordinates(input) {
    const cleaned = input.trim().replace(/[°NSEW]/gi, '');
    const parts = cleaned.split(/[,\s]+/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n));

    if (parts.length >= 2) {
      const [lat, lon] = parts;
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        return { lat, lon };
      }
    }
    return null;
  },

  /**
   * Format coordinates for display
   */
  formatCoords(lat, lon, decimals = 4) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(decimals)}°${latDir}, ${Math.abs(lon).toFixed(decimals)}°${lonDir}`;
  },

  /**
   * Calculate bearing from point A to point B
   * @returns {string} Cardinal direction (N, NE, E, SE, S, SW, W, NW)
   */
  getBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    bearing = (bearing + 360) % 360;

    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  },

  /**
   * Get arrow emoji for bearing
   */
  getBearingArrow(bearing) {
    const arrows = {
      'N': '⬆️', 'NE': '↗️', 'E': '➡️', 'SE': '↘️',
      'S': '⬇️', 'SW': '↙️', 'W': '⬅️', 'NW': '↖️'
    };
    return arrows[bearing] || '📍';
  },

  /**
   * Get saved locations from storage
   */
  getSaved() {
    return Storage.getLocations();
  },

  /**
   * Get active location
   */
  getActive() {
    return Storage.getActiveLocation();
  },

  /**
   * Save a location
   */
  save(name, lat, lon, radius) {
    return Storage.saveLocation(name, lat, lon, radius);
  },

  /**
   * Set active location
   */
  setActive(name) {
    Storage.setActiveLocation(name);
  }
};

window.Location = Location;
