# Nearby Trains

## Project Overview
Real-time tracker for Amtrak, VIA Rail, and Brightline trains. Shows live train positions on an interactive map with proximity detection and stats.

## Tech Stack
- **Language:** Vanilla JavaScript (ES6+)
- **Maps:** Leaflet
- **API:** Amtraker and MTA GTFS-RT feeds (free, no key required)
- **Hosting:** GitHub Pages (static site)

## Structure
- `index.html`: Single-page app entry, with the styles inline (`css/` is empty and untracked)
- `js/`: plain scripts loaded in order from `index.html` (storage, `amtraker.js` and `mta-client.js` API clients, location, tracker, map, UI, effects, feature-request, app controller)

## Features
- Live train position tracking on interactive map
- Proximity detection with configurable radius
- Train pass logging with closest approach and speed stats
- Multi-railroad support (Amtrak, VIA Rail, Brightline via Amtraker; LIRR and Metro-North via MTA GTFS-RT)

## Development
No build step. Open `index.html` in a browser or serve with any static server:
```bash
python -m http.server 8000
```

## Conventions
- Keep it simple: no frameworks or build tools.
- Small files with clean separation of concerns.
- Mobile-friendly responsive design.
