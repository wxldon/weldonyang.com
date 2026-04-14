import { getStravaStats, StravaStats } from "@/lib/strava";

export const revalidate = 86400;

function formatDistance(meters: number): string {
  const miles = (meters / 1000) * 0.621371;
  return `${miles.toFixed(1)} mi`;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatElevation(meters: number): string {
  const feet = meters * 3.28084;
  return `${Math.round(feet).toLocaleString()} ft`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
      <p className="text-xs opacity-50 mb-1">{label}</p>
      <p className="text-lg">{value}</p>
    </div>
  );
}

function ActivitySection({
  title,
  totals,
}: {
  title: string;
  totals: { count: number; distance: number; moving_time: number; elevation_gain: number };
}) {
  if (totals.count === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-sm opacity-60 mb-3 tracking-wide uppercase">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Activities" value={totals.count.toString()} />
        <StatCard label="Distance" value={formatDistance(totals.distance)} />
        <StatCard label="Moving Time" value={formatTime(totals.moving_time)} />
        <StatCard label="Elevation" value={formatElevation(totals.elevation_gain)} />
      </div>
    </div>
  );
}

export default async function HowFarHaveIGone() {
  let stats: StravaStats;

  try {
    stats = await getStravaStats();
  } catch {
    return (
      <main className="min-h-screen px-6 py-20 flex items-center justify-center">
        <p className="opacity-50">Failed to load Strava data. Try again later.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-20 max-w-2xl mx-auto">
      <h1 className="text-2xl font-medium tracking-tight mb-2">How far have I gone?</h1>
      <p className="text-sm opacity-50 mb-10">Powered by Strava</p>

      {/* All Time */}
      <section className="mb-12">
        <h2 className="text-base font-medium mb-4 opacity-80">All Time</h2>
        <ActivitySection title="Running" totals={stats.all_run_totals} />
        <ActivitySection title="Cycling" totals={stats.all_ride_totals} />
        <ActivitySection title="Swimming" totals={stats.all_swim_totals} />
        {stats.biggest_ride_distance > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-8">
            <StatCard label="Longest Ride" value={formatDistance(stats.biggest_ride_distance)} />
            <StatCard label="Biggest Climb" value={formatElevation(stats.biggest_climb_elevation_gain)} />
          </div>
        )}
      </section>

      {/* Year to Date */}
      <section className="mb-12">
        <h2 className="text-base font-medium mb-4 opacity-80">Year to Date</h2>
        <ActivitySection title="Running" totals={stats.ytd_run_totals} />
        <ActivitySection title="Cycling" totals={stats.ytd_ride_totals} />
        <ActivitySection title="Swimming" totals={stats.ytd_swim_totals} />
      </section>

      {/* Recent (Last 4 Weeks) */}
      <section className="mb-12">
        <h2 className="text-base font-medium mb-4 opacity-80">Last 4 Weeks</h2>
        <ActivitySection title="Running" totals={stats.recent_run_totals} />
        <ActivitySection title="Cycling" totals={stats.recent_ride_totals} />
        <ActivitySection title="Swimming" totals={stats.recent_swim_totals} />
      </section>
    </main>
  );
}
