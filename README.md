# 🚂 Dick Wallner Train Tracker

*In memory of Dick Wallner, who loved trains.*

Track Amtrak, VIA Rail, and Brightline trains near your location in real-time.

**[Live Demo →](https://jackwallner.github.io/nearby-trains/)**

![Trains Tracked](https://img.shields.io/badge/trains-tracked-blue) ![GitHub Pages](https://img.shields.io/badge/hosted-GitHub%20Pages-green) ![No API Key](https://img.shields.io/badge/API%20key-none%20needed-orange)

## Features

- 🔭 **Real-time train tracking** — See all active Amtrak, VIA Rail, and Brightline trains
- 📍 **Proximity detection** — Configurable radius to detect trains near your location
- 🗺️ **Interactive map** — Leaflet map with live train positions and station markers
- 📊 **Spotting log** — Automatically logs every train that passes within your radius
- 📈 **Stats dashboard** — Nearby count, spotted today, closest approach, average speed
- 💾 **Persistent storage** — All data saved in localStorage, export/import as JSON
- 📱 **Responsive** — Works on desktop and mobile
- 🌙 **Dark mode** — Follows system preference

## How It Works

1. **Set your location** — Use GPS, search by city, or enter coordinates manually
2. **Watch trains appear** — The app polls the [Amtraker API](https://amtraker.com) every 60 seconds
3. **Track approaches** — See which trains are approaching vs. moving away
4. **Build your log** — Every train within your detection radius gets logged

## Data Source

Uses the free [Amtraker v3 API](https://api-v3.amtraker.com/v3/) — no API key required, CORS-enabled.

- **Trains endpoint**: All active train positions (lat/lon, speed, heading, route, status)
- **Stations endpoint**: All station metadata with scheduled trains
- **Providers**: Amtrak 🚆, VIA Rail 🍁, Brightline 🚄
- **Update frequency**: ~1-2 minutes

## Tech Stack

- **Vanilla JavaScript** (ES6+) — no frameworks, no build step
- **Leaflet** — interactive maps via CDN
- **localStorage** — persistent client-side storage
- **GitHub Pages** — static hosting

Inspired by [Overhead Flights](https://jackwallner.github.io/overhead-flights/).

## Local Development

```bash
git clone https://github.com/jackwallner/nearby-trains.git
cd nearby-trains
python3 -m http.server 8080
# Open http://localhost:8080
```

## Project Structure

```
nearby-trains/
├── index.html          # Single-page app with inline CSS
├── js/
│   ├── storage.js      # localStorage wrapper (settings, locations, history)
│   ├── amtraker.js     # Amtraker v3 API client
│   ├── location.js     # Geolocation + Nominatim geocoding
│   ├── tracker.js      # Train state, nearby detection, closest approach
│   ├── map.js          # Leaflet map with train/station markers
│   ├── ui.js           # DOM rendering, stats, cards, modals
│   └── app.js          # Main controller, event binding, refresh loop
└── README.md
```

## Why No Freight Trains?

Private railroads (BNSF, UP, CSX, NS, CN, CP) publish zero public position data. Unlike aviation where ADS-B is broadcast publicly, railroad Positive Train Control (PTC) data is encrypted and on private frequencies. There is no public API for freight trains.

## License

MIT
