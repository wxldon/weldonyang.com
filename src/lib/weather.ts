// Quick SF weather summary + near-term changes via Open-Meteo (no auth).

const FORECAST_URL =
  "https://api.open-meteo.com/v1/forecast" +
  "?latitude=37.7749&longitude=-122.4194" +
  "&current=temperature_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_gusts_10m" +
  "&hourly=precipitation_probability,precipitation,weather_code,temperature_2m" +
  "&daily=sunrise,sunset,uv_index_max,precipitation_sum,temperature_2m_max,temperature_2m_min" +
  "&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch" +
  "&timezone=America/Los_Angeles&forecast_days=2";

const AQI_URL =
  "https://air-quality-api.open-meteo.com/v1/air-quality" +
  "?latitude=37.7749&longitude=-122.4194" +
  "&current=us_aqi,pm2_5,pm10" +
  "&timezone=America/Los_Angeles";

export interface WeatherEvent {
  kind: "rain-start" | "rain-stop" | "sunrise" | "sunset";
  whenIso: string;
  label: string;
}

export interface AirQuality {
  usAqi: number;
  pm2_5: number;
  pm10: number;
  category: string;
  color: string;
}

export interface WeatherSummary {
  observedIso: string;
  tempF: number;
  feelsLikeF: number;
  isDay: boolean;
  conditions: string;
  emoji: string;
  windMph: number;
  gustMph: number;
  precipNowIn: number;
  todayHighF: number;
  todayLowF: number;
  todayPrecipIn: number;
  uvMax: number;
  sunriseIso: string;
  sunsetIso: string;
  events: WeatherEvent[];
  air: AirQuality | null;
}

interface RawForecast {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    is_day: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
  };
  hourly: {
    time: string[];
    precipitation_probability: number[];
    precipitation: number[];
    weather_code: number[];
    temperature_2m: number[];
  };
  daily: {
    time: string[];
    sunrise: string[];
    sunset: string[];
    uv_index_max: number[];
    precipitation_sum: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

export function describeCode(code: number, isDay: boolean): { label: string; emoji: string } {
  if (code === 0) return { label: "Clear", emoji: isDay ? "☀️" : "🌙" };
  if (code === 1) return { label: "Mostly clear", emoji: isDay ? "🌤️" : "🌙" };
  if (code === 2) return { label: "Partly cloudy", emoji: "⛅" };
  if (code === 3) return { label: "Overcast", emoji: "☁️" };
  if (code === 45 || code === 48) return { label: "Fog", emoji: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", emoji: "🌦️" };
  if (code >= 61 && code <= 67) return { label: "Rain", emoji: "🌧️" };
  if (code >= 71 && code <= 77) return { label: "Snow", emoji: "🌨️" };
  if (code >= 80 && code <= 82) return { label: "Showers", emoji: "🌦️" };
  if (code >= 85 && code <= 86) return { label: "Snow showers", emoji: "🌨️" };
  if (code >= 95) return { label: "Thunderstorm", emoji: "⛈️" };
  return { label: "Unsettled", emoji: "🌥️" };
}

function isWet(code: number, prob: number, precipIn: number): boolean {
  if (precipIn > 0.005) return true;
  if (prob >= 35 && (code >= 51 && code <= 99)) return true;
  return false;
}

function fmtTime(iso: string): string {
  // iso has no timezone suffix (Open-Meteo returns local time without offset)
  const m = iso.match(/T(\d{2}):(\d{2})/);
  if (!m) return iso;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? "p" : "a";
  h = h % 12 || 12;
  return min === "00" ? `${h}${ampm}` : `${h}:${min}${ampm}`;
}

function aqiCategory(aqi: number): { category: string; color: string } {
  if (aqi <= 50) return { category: "Good", color: "#22c55e" };
  if (aqi <= 100) return { category: "Moderate", color: "#facc15" };
  if (aqi <= 150) return { category: "Unhealthy for sensitive", color: "#f97316" };
  if (aqi <= 200) return { category: "Unhealthy", color: "#ef4444" };
  if (aqi <= 300) return { category: "Very unhealthy", color: "#a855f7" };
  return { category: "Hazardous", color: "#7f1d1d" };
}

async function getAirQuality(): Promise<AirQuality | null> {
  try {
    const res = await fetch(AQI_URL, { next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      current: { us_aqi: number; pm2_5: number; pm10: number };
    };
    const aqi = Math.round(j.current.us_aqi);
    const cat = aqiCategory(aqi);
    return {
      usAqi: aqi,
      pm2_5: j.current.pm2_5,
      pm10: j.current.pm10,
      category: cat.category,
      color: cat.color,
    };
  } catch {
    return null;
  }
}

export async function getWeatherSummary(): Promise<WeatherSummary> {
  const [forecastRes, air] = await Promise.all([
    fetch(FORECAST_URL, { next: { revalidate: 600 } }),
    getAirQuality(),
  ]);
  if (!forecastRes.ok) throw new Error(`open-meteo ${forecastRes.status}`);
  const f = (await forecastRes.json()) as RawForecast;

  const isDay = f.current.is_day === 1;
  const desc = describeCode(f.current.weather_code, isDay);
  const todaySunrise = f.daily.sunrise[0];
  const todaySunset = f.daily.sunset[0];

  // Build a list of upcoming events in the next ~24h.
  const events: WeatherEvent[] = [];
  const now = new Date(f.current.time + ":00").getTime();

  // Rain transitions: scan hourly for next state change.
  let currentlyWet = isWet(
    f.current.weather_code,
    f.hourly.precipitation_probability[0] ?? 0,
    f.current.precipitation,
  );
  for (let i = 0; i < f.hourly.time.length; i++) {
    const t = new Date(f.hourly.time[i] + ":00").getTime();
    if (t < now) continue;
    if (t - now > 24 * 3600 * 1000) break;

    const wet = isWet(
      f.hourly.weather_code[i],
      f.hourly.precipitation_probability[i] ?? 0,
      f.hourly.precipitation[i] ?? 0,
    );

    if (wet !== currentlyWet) {
      events.push({
        kind: wet ? "rain-start" : "rain-stop",
        whenIso: f.hourly.time[i],
        label: wet
          ? `Rain starts around ${fmtTime(f.hourly.time[i])}`
          : `Drying out by ${fmtTime(f.hourly.time[i])}`,
      });
      currentlyWet = wet;
      if (events.length >= 3) break;
    }
  }

  // Sunrise / sunset (only the next one).
  const sunsetTs = new Date(todaySunset + ":00").getTime();
  const sunriseTomorrowTs = new Date(f.daily.sunrise[1] + ":00").getTime();
  if (sunsetTs > now) {
    events.push({
      kind: "sunset",
      whenIso: todaySunset,
      label: `Sunset at ${fmtTime(todaySunset)}`,
    });
  } else if (sunriseTomorrowTs > now) {
    events.push({
      kind: "sunrise",
      whenIso: f.daily.sunrise[1],
      label: `Sunrise at ${fmtTime(f.daily.sunrise[1])}`,
    });
  }

  events.sort((a, b) => a.whenIso.localeCompare(b.whenIso));

  return {
    observedIso: f.current.time,
    tempF: Math.round(f.current.temperature_2m),
    feelsLikeF: Math.round(f.current.apparent_temperature),
    isDay,
    conditions: desc.label,
    emoji: desc.emoji,
    windMph: Math.round(f.current.wind_speed_10m),
    gustMph: Math.round(f.current.wind_gusts_10m),
    precipNowIn: f.current.precipitation,
    todayHighF: Math.round(f.daily.temperature_2m_max[0]),
    todayLowF: Math.round(f.daily.temperature_2m_min[0]),
    todayPrecipIn: f.daily.precipitation_sum[0] ?? 0,
    uvMax: f.daily.uv_index_max[0] ?? 0,
    sunriseIso: todaySunrise,
    sunsetIso: todaySunset,
    events,
    air,
  };
}
