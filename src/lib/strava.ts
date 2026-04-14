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

async function getAccessToken(): Promise<string> {
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
  return data.access_token;
}

export async function getStravaStats(): Promise<StravaStats> {
  const accessToken = await getAccessToken();

  const athleteRes = await fetch("https://www.strava.com/api/v3/athlete", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!athleteRes.ok) {
    throw new Error(`Failed to fetch athlete: ${athleteRes.status}`);
  }

  const athlete = await athleteRes.json();

  const statsRes = await fetch(
    `https://www.strava.com/api/v3/athletes/${athlete.id}/stats`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!statsRes.ok) {
    throw new Error(`Failed to fetch stats: ${statsRes.status}`);
  }

  return statsRes.json();
}
