// Wind observations from California ASOS / AWOS stations (airports + select
// remote sites), via Iowa State Mesonet's free public currents endpoint.
// No auth, no rate limit documented.

const CURRENTS_URL =
  "https://mesonet.agron.iastate.edu/api/1/currents.json?network=CA_ASOS";

const SF_LAT = 37.7749;
const SF_LNG = -122.4194;
const RADIUS_MI = 75;
const KNOTS_TO_MPH = 1.15078;

// Hyperlocal "spot" forecasts — picked because they're popular ride
// destinations with no nearby ASOS / AWOS station (Hawk Hill is a notorious
// wind tunnel; Ocean Beach is the city's coastal exposure). Wind here is
// model output from Open-Meteo, not a real anemometer, so the UI marks
// these distinctly.
const SPOTS = [
  { id: "ocean-beach",  name: "Ocean Beach",  lat: 37.7594, lng: -122.5107 },
  { id: "hawk-hill",    name: "Hawk Hill",    lat: 37.8264, lng: -122.4986 },
] as const;

export interface SpotHour {
  timeIso: string;
  windMph: number;
  gustMph: number;
  directionDeg: number;
  directionLabel: string;
  tempF: number;
  precipPct: number;
  weatherCode: number;
}

export interface WindSpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  windMph: number;
  gustMph: number | null;
  directionDeg: number | null;
  directionLabel: string;
  tempF: number | null;
  observedAt: string | null;
  source: "forecast";
  forecast24h: SpotHour[];
}

export interface WindStation {
  id: string;
  name: string;
  county: string;
  lat: number;
  lng: number;
  windMph: number;
  gustMph: number | null;
  directionDeg: number | null;
  directionLabel: string;
  tempF: number | null;
  observedAt: string | null;
  distanceMi: number;
}

interface RawCurrent {
  station: string;
  name: string;
  county: string | null;
  lat: number | null;
  lon: number | null;
  sknt: number | null;
  drct: number | null;
  gust: number | null;
  tmpf: number | null;
  utc_valid: string | null;
}

function haversineMi(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.7613;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const COMPASS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
function compassFromDeg(deg: number | null): string {
  if (deg == null) return "";
  const idx = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
  return COMPASS[idx];
}

export async function getNearbyWindStations(): Promise<WindStation[]> {
  const res = await fetch(CURRENTS_URL, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`mesonet currents ${res.status}`);
  const json = (await res.json()) as { data: RawCurrent[] };

  const out: WindStation[] = [];
  for (const r of json.data) {
    if (r.lat == null || r.lon == null) continue;
    const dist = haversineMi(SF_LAT, SF_LNG, r.lat, r.lon);
    if (dist > RADIUS_MI) continue;
    if (r.sknt == null) continue;

    const sknt = r.sknt;
    const gust = r.gust;
    out.push({
      id: r.station,
      name: r.name || r.station,
      county: r.county || "",
      lat: r.lat,
      lng: r.lon,
      windMph: Math.round(sknt * KNOTS_TO_MPH),
      gustMph: gust != null ? Math.round(gust * KNOTS_TO_MPH) : null,
      directionDeg: r.drct,
      directionLabel: compassFromDeg(r.drct),
      tempF: r.tmpf,
      observedAt: r.utc_valid,
      distanceMi: dist,
    });
  }

  out.sort((a, b) => a.distanceMi - b.distanceMi);
  return out;
}

interface RawSpotForecast {
  current: {
    time: string;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
    temperature_2m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    wind_gusts_10m: number[];
    weather_code: number[];
    precipitation_probability: number[];
  };
}

async function fetchSpot(spot: typeof SPOTS[number]): Promise<WindSpot | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lng}` +
    `&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m` +
    `&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,precipitation_probability` +
    `&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=America/Los_Angeles&forecast_days=2`;
  try {
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return null;
    const j = (await res.json()) as RawSpotForecast;

    const nowMs = new Date(j.current.time + ":00").getTime();
    const forecast24h: SpotHour[] = [];
    for (let i = 0; i < j.hourly.time.length && forecast24h.length < 24; i++) {
      const tMs = new Date(j.hourly.time[i] + ":00").getTime();
      if (tMs < nowMs) continue;
      const dir = j.hourly.wind_direction_10m[i] ?? 0;
      forecast24h.push({
        timeIso: j.hourly.time[i],
        windMph: Math.round(j.hourly.wind_speed_10m[i] ?? 0),
        gustMph: Math.round(j.hourly.wind_gusts_10m[i] ?? 0),
        directionDeg: dir,
        directionLabel: compassFromDeg(dir),
        tempF: Math.round(j.hourly.temperature_2m[i] ?? 0),
        precipPct: Math.round(j.hourly.precipitation_probability[i] ?? 0),
        weatherCode: j.hourly.weather_code[i] ?? 0,
      });
    }

    return {
      id: spot.id,
      name: spot.name,
      lat: spot.lat,
      lng: spot.lng,
      windMph: Math.round(j.current.wind_speed_10m),
      gustMph: Math.round(j.current.wind_gusts_10m),
      directionDeg: j.current.wind_direction_10m,
      directionLabel: compassFromDeg(j.current.wind_direction_10m),
      tempF: Math.round(j.current.temperature_2m),
      observedAt: j.current.time,
      source: "forecast",
      forecast24h,
    };
  } catch {
    return null;
  }
}

export async function getSpotWinds(): Promise<WindSpot[]> {
  const results = await Promise.all(SPOTS.map(fetchSpot));
  return results.filter((s): s is WindSpot => s !== null);
}
