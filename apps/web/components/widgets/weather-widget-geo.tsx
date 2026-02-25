"use client";

import { useEffect, useState } from "react";

import { GlassCard } from "@/components/kit/glass-card";

type WeatherCurrent = {
  temperature: number;
  windSpeed: number;
  weatherCode: number;
  description: string;
};

type WeatherDaily = {
  date: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
  precipitationSum: number;
};

type WeatherPayload = {
  current: WeatherCurrent;
  daily: WeatherDaily[];
  stationName: string;
  error?: string;
};

function weatherCodeToEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

const GEO_CACHE_KEY = "weather_geo_coords";
const DATA_CACHE_KEY = "weather_data_cache";
const CACHE_TTL = 10 * 60 * 1000; // 10 min

function getCachedCoords(): { lat: number; lon: number } | null {
  try {
    const raw = sessionStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat: number; lon: number; ts: number };
    if (Date.now() - parsed.ts > 30 * 60 * 1000) return null; // 30 min
    return { lat: parsed.lat, lon: parsed.lon };
  } catch {
    return null;
  }
}

function setCachedCoords(lat: number, lon: number) {
  try {
    sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ lat, lon, ts: Date.now() }));
  } catch { /* ignore */ }
}

function getCachedData(): WeatherPayload | null {
  try {
    const raw = sessionStorage.getItem(DATA_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeatherPayload & { ts: number };
    if (Date.now() - parsed.ts > CACHE_TTL) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setCachedData(data: WeatherPayload) {
  try {
    sessionStorage.setItem(DATA_CACHE_KEY, JSON.stringify({ ...data, ts: Date.now() }));
  } catch { /* ignore */ }
}

/**
 * Client-side weather widget with browser geolocation.
 * Strategy: Geo → station fallback → cached data → "unavailable".
 */
export function WeatherWidgetGeo({ stationId }: { stationId?: string | undefined }) {
  const [weather, setWeather] = useState<WeatherPayload | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Hydrate from sessionStorage cache after mount to avoid SSR mismatch
  useEffect(() => {
    const cached = getCachedData();
    if (cached) {
      setWeather(cached);
      setLoading(false);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    async function fetchWithCoords(lat?: number, lon?: number) {
      const params = new URLSearchParams();
      if (lat != null && lon != null) {
        params.set("lat", lat.toFixed(4));
        params.set("lon", lon.toFixed(4));
      }
      if (stationId) params.set("station", stationId);

      try {
        const res = await fetch(`/api/weather?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as WeatherPayload;
        if (!cancelled && !data.error) {
          setWeather(data);
          setCachedData(data);
          setStale(false);
        }
      } catch {
        // Keep cached/stale data
        if (!cancelled && weather) setStale(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Try cached coords first
    const cached = getCachedCoords();
    if (cached) {
      void fetchWithCoords(cached.lat, cached.lon);
      return () => { cancelled = true; };
    }

    // Try browser geolocation
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          setCachedCoords(pos.coords.latitude, pos.coords.longitude);
          void fetchWithCoords(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          // Permission denied or unavailable — fall back to station
          if (!cancelled) void fetchWithCoords();
        },
        { timeout: 5000, maximumAge: 300000 },
      );
    } else {
      void fetchWithCoords();
    }

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId, mounted]);

  if (loading && !weather) {
    return (
      <GlassCard className="animate-pulse p-4">
        <div className="h-8 w-24 rounded bg-white/10" />
        <div className="mt-2 h-4 w-40 rounded bg-white/10" />
      </GlassCard>
    );
  }

  if (!weather) {
    return (
      <GlassCard className="p-3 text-center text-sm text-[var(--text-muted)]">
        Weather unavailable
      </GlassCard>
    );
  }

  const { current, daily } = weather;

  return (
    <GlassCard className="space-y-3 p-4" data-testid="weather-widget">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-[var(--text)]">
            {weatherCodeToEmoji(current.weatherCode)} {current.temperature}°C
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {current.description} · Wind {current.windSpeed} km/h
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {weather.stationName}
            {stale ? " · ⚠ stale" : ""}
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {daily.slice(0, 7).map((day) => (
          <div
            key={day.date}
            className="flex shrink-0 flex-col items-center rounded-lg border border-[var(--border)] bg-white/5 px-2 py-1.5"
          >
            <span className="text-xs text-[var(--text-muted)]">
              {new Date(day.date).toLocaleDateString("en", { weekday: "short" })}
            </span>
            <span className="text-sm">{weatherCodeToEmoji(day.weatherCode)}</span>
            <span className="text-xs font-medium text-[var(--text)]">
              {Math.round(day.tempMax)}° / {Math.round(day.tempMin)}°
            </span>
            {day.precipitationSum > 0 && (
              <span className="text-[10px] text-blue-300">
                💧{day.precipitationSum.toFixed(1)}mm
              </span>
            )}
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
