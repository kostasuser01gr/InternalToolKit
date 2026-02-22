import { GlassCard } from "@/components/kit/glass-card";
import { fetchWeatherSafe, weatherCodeToEmoji } from "@/lib/weather/client";

export async function WeatherWidget({ stationId }: { stationId?: string }) {
  const weather = await fetchWeatherSafe(stationId);

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
          <p className="text-xs text-[var(--text-muted)]">{weather.stationName}</p>
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
