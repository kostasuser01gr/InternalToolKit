/**
 * Open-Meteo weather client — keyless, free, cached.
 * Docs: https://open-meteo.com/en/docs
 */

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export type WeatherCurrent = {
  temperature: number;
  windSpeed: number;
  weatherCode: number;
  description: string;
  isDay: boolean;
};

export type WeatherHourly = {
  time: string;
  temperature: number;
  weatherCode: number;
  precipitation: number;
};

export type WeatherDaily = {
  date: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
  precipitationSum: number;
};

export type WeatherData = {
  current: WeatherCurrent;
  hourly: WeatherHourly[];
  daily: WeatherDaily[];
  fetchedAt: string;
  stationName: string;
};

type CacheEntry = { data: WeatherData; expiresAt: number };
const cache = new Map<string, CacheEntry>();

const WMO_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight showers",
  81: "Moderate showers",
  82: "Violent showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Heavy thunderstorm with hail",
};

export function weatherCodeToDescription(code: number): string {
  return WMO_CODES[code] ?? "Unknown";
}

export function weatherCodeToEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌧️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

/** Default station coordinates (Thessaloniki airport — Europcar/Goldcar typical) */
export const DEFAULT_STATIONS: Record<string, { lat: number; lon: number; name: string }> = {
  default: { lat: 40.5197, lon: 22.9709, name: "Thessaloniki Airport" },
  ath: { lat: 37.9364, lon: 23.9445, name: "Athens Airport" },
  skg: { lat: 40.5197, lon: 22.9709, name: "Thessaloniki Airport" },
  hrak: { lat: 35.3387, lon: 25.1803, name: "Heraklion Airport" },
  rho: { lat: 36.4054, lon: 28.0862, name: "Rhodes Airport" },
};

export async function fetchWeather(
  stationId?: string,
  lat?: number,
  lon?: number,
): Promise<WeatherData> {
  const station = DEFAULT_STATIONS[stationId ?? "default"] ?? DEFAULT_STATIONS["default"]!;
  const useLat = lat ?? station.lat;
  const useLon = lon ?? station.lon;
  const cacheKey = `${useLat.toFixed(2)},${useLon.toFixed(2)}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const params = new URLSearchParams({
    latitude: String(useLat),
    longitude: String(useLon),
    current: "temperature_2m,wind_speed_10m,weather_code,is_day",
    hourly: "temperature_2m,weather_code,precipitation",
    daily: "temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum",
    timezone: "auto",
    forecast_days: "7",
  });

  const res = await fetch(`${OPEN_METEO_URL}?${params}`, {
    next: { revalidate: 600 }, // 10min ISR cache
  });

  if (!res.ok) {
    throw new Error(`Open-Meteo API error: ${res.status}`);
  }

  const json = await res.json();

  const data: WeatherData = {
    current: {
      temperature: json.current?.temperature_2m ?? 0,
      windSpeed: json.current?.wind_speed_10m ?? 0,
      weatherCode: json.current?.weather_code ?? 0,
      description: weatherCodeToDescription(json.current?.weather_code ?? 0),
      isDay: json.current?.is_day === 1,
    },
    hourly: (json.hourly?.time ?? []).slice(0, 24).map((t: string, i: number) => ({
      time: t,
      temperature: json.hourly?.temperature_2m?.[i] ?? 0,
      weatherCode: json.hourly?.weather_code?.[i] ?? 0,
      precipitation: json.hourly?.precipitation?.[i] ?? 0,
    })),
    daily: (json.daily?.time ?? []).map((d: string, i: number) => ({
      date: d,
      tempMax: json.daily?.temperature_2m_max?.[i] ?? 0,
      tempMin: json.daily?.temperature_2m_min?.[i] ?? 0,
      weatherCode: json.daily?.weather_code?.[i] ?? 0,
      precipitationSum: json.daily?.precipitation_sum?.[i] ?? 0,
    })),
    fetchedAt: new Date().toISOString(),
    stationName: station.name,
  };

  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

/** Safe fetch that returns null on failure */
export async function fetchWeatherSafe(stationId?: string): Promise<WeatherData | null> {
  try {
    return await fetchWeather(stationId);
  } catch {
    return null;
  }
}
