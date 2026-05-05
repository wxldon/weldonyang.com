interface ActivityTotal {
  count: number;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  elevation_gain: number;
}

export interface StravaStats {
  biggest_ride_distance: number;
  biggest_climb_elevation_gain: number;
  recent_ride_totals: ActivityTotal;
  recent_run_totals: ActivityTotal;
  recent_swim_totals: ActivityTotal;
  ytd_ride_totals: ActivityTotal;
  ytd_run_totals: ActivityTotal;
  ytd_swim_totals: ActivityTotal;
  all_ride_totals: ActivityTotal;
  all_run_totals: ActivityTotal;
  all_swim_totals: ActivityTotal;
}

export interface StravaActivitySummary {
  id: number;
  name: string;
  type: string;
  sport_type?: string;
  start_date: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  has_heartrate?: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  max_watts?: number;
  weighted_average_watts?: number;
  kilojoules?: number;
  average_cadence?: number;
  suffer_score?: number;
}

export type StreamType =
  | "time"
  | "distance"
  | "latlng"
  | "altitude"
  | "velocity_smooth"
  | "heartrate"
  | "cadence"
  | "watts"
  | "temp"
  | "moving"
  | "grade_smooth";

export interface StravaStreams {
  [key: string]: { data: number[] | [number, number][]; series_type: string; original_size: number; resolution: string };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: process.env.STRAVA_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to refresh Strava token: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: data.expires_at * 1000,
  };
  return data.access_token;
}

async function stravaFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`https://www.strava.com/api/v3${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getStravaStats(): Promise<StravaStats> {
  const athleteRes = await stravaFetch("/athlete");
  if (!athleteRes.ok) throw new Error(`Failed to fetch athlete: ${athleteRes.status}`);
  const athlete = await athleteRes.json();

  const statsRes = await stravaFetch(`/athletes/${athlete.id}/stats`);
  if (!statsRes.ok) throw new Error(`Failed to fetch stats: ${statsRes.status}`);
  return statsRes.json();
}

export async function getRecentActivities(opts: {
  after?: number;
  before?: number;
  page?: number;
  perPage?: number;
} = {}): Promise<StravaActivitySummary[]> {
  const params = new URLSearchParams();
  if (opts.after) params.set("after", String(opts.after));
  if (opts.before) params.set("before", String(opts.before));
  params.set("page", String(opts.page ?? 1));
  params.set("per_page", String(opts.perPage ?? 100));

  const res = await stravaFetch(`/athlete/activities?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch activities: ${res.status}`);
  return res.json();
}

export async function getActivity(id: number): Promise<StravaActivitySummary & Record<string, unknown>> {
  const res = await stravaFetch(`/activities/${id}?include_all_efforts=false`);
  if (!res.ok) throw new Error(`Failed to fetch activity ${id}: ${res.status}`);
  return res.json();
}

export async function getActivityStreams(
  id: number,
  types: StreamType[] = ["time", "heartrate", "watts", "cadence", "velocity_smooth", "altitude", "distance"],
): Promise<StravaStreams> {
  const keys = types.join(",");
  const res = await stravaFetch(`/activities/${id}/streams?keys=${keys}&key_by_type=true`);
  if (!res.ok) {
    if (res.status === 404) return {};
    throw new Error(`Failed to fetch streams ${id}: ${res.status}`);
  }
  return res.json();
}
