/**
 * MTA Client — Real-time LIRR & Metro-North train positions
 * Free, no API key, CORS-enabled GTFS-RT protobuf feeds
 *
 * Decodes GTFS-RT vehicle positions from binary protobuf without
 * any external library — the format is simple enough to hand-decode.
 */

const MTAClient = {
  FEEDS: {
    lirr: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/lirr%2Fgtfs-lirr',
    metroNorth: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/mnr%2Fgtfs-mnr',
  },

  lastCall: 0,
  minInterval: 2000,

  async rateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastCall;
    if (elapsed < this.minInterval) {
      await new Promise(r => setTimeout(r, this.minInterval - elapsed));
    }
    this.lastCall = Date.now();
  },

  // ──────────────────────────────────────────────
  // Minimal protobuf varint / wire-type decoder
  // GTFS-RT only uses a small subset of protobuf
  // ──────────────────────────────────────────────

  /**
   * Read a varint from a DataView at offset, return { value, bytesRead }
   */
  readVarint(dv, offset) {
    let result = 0;
    let shift = 0;
    let bytesRead = 0;
    while (offset < dv.byteLength) {
      const b = dv.getUint8(offset++);
      bytesRead++;
      result |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
      if (shift > 35) throw new Error('Varint too long');
    }
    return { value: result >>> 0, bytesRead };
  },

  /**
   * Parse a length-delimited protobuf message into field map
   * Returns Map<fieldNumber, Array<{wireType, value}>>
   */
  parseMessage(buffer, start, end) {
    const dv = new DataView(buffer);
    const fields = new Map();
    let pos = start;

    while (pos < end) {
      const tag = this.readVarint(dv, pos);
      pos += tag.bytesRead;

      const fieldNum = tag.value >>> 3;
      const wireType = tag.value & 0x7;

      let value;
      if (wireType === 0) {
        // Varint
        const v = this.readVarint(dv, pos);
        pos += v.bytesRead;
        value = v.value;
      } else if (wireType === 1) {
        // 64-bit (fixed64 / double)
        value = dv.getFloat64(pos, true);
        pos += 8;
      } else if (wireType === 2) {
        // Length-delimited (string, bytes, embedded message)
        const len = this.readVarint(dv, pos);
        pos += len.bytesRead;
        value = { start: pos, end: pos + len.value, buffer };
        pos += len.value;
      } else if (wireType === 5) {
        // 32-bit (fixed32 / float)
        value = dv.getFloat32(pos, true);
        pos += 4;
      } else {
        // Unknown wire type, skip
        break;
      }

      if (!fields.has(fieldNum)) fields.set(fieldNum, []);
      fields.get(fieldNum).push({ wireType, value });
    }

    return fields;
  },

  /**
   * Get a string from a length-delimited field
   */
  getString(field) {
    if (!field || field.wireType !== 2) return '';
    const bytes = new Uint8Array(field.value.buffer, field.value.start, field.value.end - field.value.start);
    return new TextDecoder().decode(bytes);
  },

  /**
   * Get a float from a field (handles both float32 and double)
   */
  getFloat(field) {
    if (!field) return 0;
    if (field.wireType === 5) return field.value; // float32
    if (field.wireType === 1) return field.value; // float64/double
    if (field.wireType === 0) return field.value;  // varint
    return 0;
  },

  /**
   * Get a sub-message from a length-delimited field
   */
  getSubMessage(field) {
    if (!field || field.wireType !== 2) return null;
    return this.parseMessage(field.value.buffer, field.value.start, field.value.end);
  },

  // ──────────────────────────────────────────────
  // GTFS-RT parsing (FeedMessage → entities → vehicle positions)
  // ──────────────────────────────────────────────
  //
  // FeedMessage:
  //   field 1 = FeedHeader (embedded)
  //   field 2 = FeedEntity (repeated, embedded)
  //
  // FeedEntity:
  //   field 1 = id (string)
  //   field 4 = vehicle (VehiclePosition, embedded)
  //
  // VehiclePosition (MTA uses non-standard field mapping):
  //   field 1 = trip (TripDescriptor, embedded)
  //   field 2 = position (Position, embedded) — NOTE: standard GTFS-RT puts this at field 3
  //   field 3 = position (Position) — standard location, checked as fallback
  //   field 4 = current_status (enum: 0=INCOMING_AT, 1=STOPPED_AT, 2=IN_TRANSIT_TO)
  //   field 5 = timestamp (uint64)
  //   field 7 = stop_id (MTA extension)
  //   field 8 = vehicle descriptor (MTA extension)
  //
  // Position:
  //   field 1 = latitude (float)
  //   field 2 = longitude (float)
  //   field 3 = bearing (float)
  //   field 4 = speed (double, m/s)
  //
  // TripDescriptor:
  //   field 1 = trip_id (string)
  //   field 3 = route_id (string)

  /**
   * Parse a GTFS-RT FeedMessage binary into vehicle position objects
   */
  parseFeed(arrayBuffer) {
    const vehicles = [];
    const feedMsg = this.parseMessage(arrayBuffer, 0, arrayBuffer.byteLength);

    // field 2 = FeedEntity (repeated)
    const entities = feedMsg.get(2) || [];

    for (const entityField of entities) {
      const entity = this.getSubMessage(entityField);
      if (!entity) continue;

      // field 1 = id
      const idField = entity.get(1);
      const entityId = idField ? this.getString(idField[0]) : '';

      // field 4 = VehiclePosition
      const vpField = entity.get(4);
      if (!vpField) continue;
      const vp = this.getSubMessage(vpField[0]);
      if (!vp) continue;

      // field 3 = Position (standard GTFS-RT)
      // field 2 = Position (MTA uses this instead)
      let posField = vp.get(3); // standard
      if (!posField) posField = vp.get(2); // MTA extension
      if (!posField) continue;

      // Check if field 2 is actually a Position (has float sub-fields)
      // vs a VehicleDescriptor. Position has float32 lat/lon at fields 1,2.
      let pos = this.getSubMessage(posField[0]);
      if (!pos) continue;

      // Position fields
      const latField = pos.get(1);
      const lonField = pos.get(2);
      const bearingField = pos.get(3);
      const speedField = pos.get(4);

      const lat = latField ? this.getFloat(latField[0]) : 0;
      const lon = lonField ? this.getFloat(lonField[0]) : 0;

      if (lat === 0 && lon === 0) continue; // Skip entries without GPS

      const bearing = bearingField ? this.getFloat(bearingField[0]) : null;
      const speedMs = speedField ? this.getFloat(speedField[0]) : 0;
      const speedMph = speedMs * 2.23694; // m/s to mph

      // field 1 = TripDescriptor
      let tripId = '', routeId = '';
      const tripField = vp.get(1);
      if (tripField) {
        const trip = this.getSubMessage(tripField[0]);
        if (trip) {
          const tidField = trip.get(1);
          const ridField = trip.get(3);
          if (tidField) tripId = this.getString(tidField[0]);
          if (ridField) routeId = this.getString(ridField[0]);
        }
      }

      // field 8 = VehicleDescriptor (MTA extension)
      // field 2 = VehicleDescriptor (standard) — but MTA uses field 2 for Position
      let vehicleId = '', vehicleLabel = '';
      const vehField = vp.get(8); // MTA puts vehicle info here
      if (vehField) {
        const veh = this.getSubMessage(vehField[0]);
        if (veh) {
          const vidField = veh.get(1);
          const vlField = veh.get(2);
          if (vidField) vehicleId = this.getString(vidField[0]);
          if (vlField) vehicleLabel = this.getString(vlField[0]);
        }
      }

      // field 7 = stop_id (MTA extension), field 5 = stop_id (standard)
      const stopField = vp.get(7) || vp.get(5);
      const stopId = stopField ? this.getString(stopField[0]) : '';

      // field 4 = current_status
      const statusField = vp.get(4);
      const currentStatus = statusField ? statusField[0].value : 2;

      // field 5 = timestamp (MTA)
      const tsField = vp.get(5);
      const timestamp = tsField ? tsField[0].value : 0;

      vehicles.push({
        entityId,
        lat,
        lon,
        bearing,
        speedMph,
        tripId,
        routeId,
        vehicleId,
        vehicleLabel,
        stopId,
        currentStatus,
        timestamp
      });
    }

    return vehicles;
  },

  /**
   * Convert bearing degrees to cardinal heading string
   */
  degreesToHeading(degrees) {
    if (degrees === null || degrees === undefined) return '';
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const idx = Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16;
    return dirs[idx];
  },

  /**
   * Status enum to readable text
   */
  statusText(code) {
    switch (code) {
      case 0: return 'Arriving';
      case 1: return 'At Station';
      case 2: return 'In Transit';
      default: return 'Active';
    }
  },

  /**
   * Normalize an MTA vehicle into the same shape as an Amtraker train object
   * so it can be used interchangeably in the tracker, map, and UI
   */
  normalizeVehicle(v, source) {
    const provider = source === 'lirr' ? 'LIRR' : 'Metro-North';
    const trainNum = v.vehicleLabel || v.vehicleId || v.tripId.split('_')[0] || v.entityId;

    return {
      // Core identity
      trainID: `mta-${source}-${v.entityId}`,
      trainNum: trainNum,
      routeName: provider, // MTA feeds don't include route names in vehicle positions

      // Position
      lat: v.lat,
      lon: v.lon,
      velocity: Math.round(v.speedMph),
      heading: v.bearing !== null ? this.degreesToHeading(v.bearing) : '',

      // Provider info
      provider: provider,

      // Route info (MTA feeds don't have origin/dest names in vehicle positions)
      origName: '',
      destName: v.stopId || '',
      trainState: this.statusText(v.currentStatus),

      // Status (MTA doesn't have Amtrak-style iconColor, so default to "active")
      iconColor: source === 'lirr' ? '#0039A6' : '#0039A6', // MTA blue
      trainTimely: v.currentStatus === 2 ? 'In Transit' : 'At Station',

      // Amtraker-style fields (empty for MTA)
      stations: [],

      // Flag for MTA-specific handling
      _mtaSource: source,
    };
  },

  /**
   * Fetch and parse vehicle positions from one feed
   */
  async fetchFeed(source) {
    const url = this.FEEDS[source];
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`MTA ${source} feed error: ${response.status}`);
        return [];
      }
      const buffer = await response.arrayBuffer();
      const vehicles = this.parseFeed(buffer);
      return vehicles.map(v => this.normalizeVehicle(v, source));
    } catch (err) {
      console.warn(`MTA ${source} fetch failed:`, err.message);
      return [];
    }
  },

  /**
   * Fetch all MTA trains (LIRR + Metro-North)
   * @param {Object} providerFilter - { lirr: true, metroNorth: true }
   * @returns {Promise<Array>} Normalized train objects
   */
  async getAllTrains(providerFilter = { lirr: true, metroNorth: true }) {
    await this.rateLimit();

    const promises = [];
    if (providerFilter.lirr) promises.push(this.fetchFeed('lirr'));
    if (providerFilter.metroNorth) promises.push(this.fetchFeed('metroNorth'));

    const results = await Promise.all(promises);
    return results.flat();
  }
};

window.MTAClient = MTAClient;
