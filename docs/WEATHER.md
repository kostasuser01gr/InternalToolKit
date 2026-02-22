# Weather Module

## Overview

Real-time weather data integrated into the Operations OS using the free, keyless [Open-Meteo API](https://open-meteo.com/).

## Architecture

### Data Flow
```
Open-Meteo API → lib/weather/client.ts (10min cache) → /api/weather → WeatherWidget
```

### Cache
- In-memory cache with 10-minute TTL
- Stale data served immediately while background refresh occurs
- If API fails, last cached data shown with warning badge

### Stations
5 pre-configured Greek airport stations:
| Station | IATA | Lat/Lon |
|---------|------|---------|
| Athens Eleftherios Venizelos | ATH | 37.9364° / 23.9445° |
| Thessaloniki Macedonia | SKG | 40.5197° / 22.9709° |
| Heraklion Nikos Kazantzakis | HER | 35.3397° / 25.1803° |
| Rhodes Diagoras | RHO | 36.4054° / 28.0862° |
| Corfu Ioannis Kapodistrias | CFU | 39.6019° / 19.9117° |

Custom coordinates supported via API: `/api/weather?lat=37.9&lon=23.7`

### Widget
- **`WeatherWidgetGeo`** — Client component with browser geolocation (wave 11)
  - Uses `navigator.geolocation.getCurrentPosition()` for auto-detection
  - Strategy: cached geo coords → browser geolocation → station fallback
  - SessionStorage cache: coords (30 min TTL), weather data (10 min TTL)
  - Shows "stale" badge when using cached data after API failure
  - Requires HTTPS (secure context) for geolocation
- **`WeatherWidget`** — Original server component (still available as fallback)
  - Rendered via Suspense, uses station coords only
- Current + 7-day forecast with WMO weather code → emoji mapping

### API Endpoint
`GET /api/weather`
- `?station=ath` — pre-configured station
- `?lat=37.9&lon=23.7` — custom coordinates
- Returns current + daily forecast data
- 503 with fallback station list on failure

### Adding Stations
Edit `DEFAULT_STATIONS` in `lib/weather/client.ts`. Coordinator can configure station lat/lon in Settings (future).

## Environment Variables
None required — Open-Meteo is free and keyless.
