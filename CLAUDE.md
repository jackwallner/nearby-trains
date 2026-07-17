# Nearby Trains

## Project Overview
Real-time tracker for Amtrak, VIA Rail, and Brightline trains. Shows live train positions on an interactive map with proximity detection and stats.

## Tech Stack
- **Language:** Vanilla JavaScript (ES6+ modules)
- **Maps:** Leaflet
- **API:** Amtraker (free, no key required)
- **Hosting:** GitHub Pages (static site)

## Structure
- `index.html` — Single-page app entry
- `js/` — ES6 modules (storage, API client, geolocation, tracker, map, UI, app controller)
- `css/` — Stylesheets

## Features
- Live train position tracking on interactive map
- Proximity detection with configurable radius
- Train pass logging with closest approach and speed stats
- Multi-railroad support (Amtrak, VIA Rail, Brightline)

## Development
No build step. Open `index.html` in a browser or serve with any static server:
```bash
python -m http.server 8000
```

## Conventions
- No frameworks, no build tools — keep it simple.
- ES6 modules with clean separation of concerns.
- Mobile-friendly responsive design.

## Subagent delegation
Follow the global CLAUDE.md subagent rules: ask Jack for the model before spawning, spawn at most one at a time unless Jack explicitly approves more, and never allow a subagent to spawn another subagent.
