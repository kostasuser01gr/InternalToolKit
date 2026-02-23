import { NextResponse } from "next/server";

import { fetchWeather, DEFAULT_STATIONS } from "@/lib/weather/client";

/**
 * /api/cron/weather — refresh weather cache for all known stations.
 * Intended to be called by Vercel Cron (prod-only).
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results: Record<string, string> = {};

  for (const [stationId, station] of Object.entries(DEFAULT_STATIONS)) {
    try {
      await fetchWeather(stationId, station.lat, station.lon);
      results[stationId] = "ok";
    } catch (err) {
      results[stationId] = err instanceof Error ? err.message : "unknown error";
    }
  }

  return NextResponse.json({
    success: true,
    stations: results,
    timestamp: new Date().toISOString(),
  });
}
