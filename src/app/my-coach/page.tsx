import { Metadata } from "next";
import {
  getAthleteProfile,
  getRecommendationForDate,
  sql,
  type ActivityRow,
} from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { todayLocalDate, USER_TZ, toLocalDateStr } from "@/lib/dates";
import { getWeatherSummary, type WeatherSummary } from "@/lib/weather";
import MyCoachContent from "./MyCoachContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Coach — Weldon Yang",
  description: "Today's prescribed workout, tailored to recent training.",
};

interface SetupState {
  hasSchema: boolean;
  hasTemplates: boolean;
  hasSchedule: boolean;
}

export interface ActivityHeader {
  activity: Omit<ActivityRow, "raw">;
  localDate: string;
}

async function getActivitiesInWindow(today: string): Promise<ActivityHeader[]> {
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  const fromDt = new Date(dt);
  fromDt.setUTCDate(fromDt.getUTCDate() - dow);
  const toDt = new Date(fromDt);
  toDt.setUTCDate(toDt.getUTCDate() + 13);
  const from = fromDt.toISOString().slice(0, 10);
  const to = toDt.toISOString().slice(0, 10);

  const rows = (await sql`
    select
      id, start_date, type, name, distance_m, moving_time_s, elapsed_time_s,
      elevation_gain_m, avg_hr, max_hr, avg_watts, max_watts, weighted_avg_watts,
      kilojoules, avg_cadence, suffer_score, tss, intensity_factor, time_in_zones
    from activities
    where (start_date at time zone ${USER_TZ})::date between ${from} and ${to}
    order by start_date desc
  `) as Array<Omit<ActivityRow, "raw">>;

  return rows.map((activity) => ({
    activity,
    localDate: toLocalDateStr(activity.start_date),
  }));
}

async function checkSetup(): Promise<SetupState> {
  try {
    const t = (await sql`select count(*)::int as n from workout_templates`) as { n: number }[];
    const s = (await sql`select count(*)::int as n from workout_schedule`) as { n: number }[];
    return {
      hasSchema: true,
      hasTemplates: (t[0]?.n ?? 0) > 0,
      hasSchedule: (s[0]?.n ?? 0) > 0,
    };
  } catch {
    return { hasSchema: false, hasTemplates: false, hasSchedule: false };
  }
}

export default async function MyCoachPage() {
  const [setup, admin, weather] = await Promise.all([
    checkSetup(),
    isAdmin(),
    getWeatherSummary().catch((): WeatherSummary | null => null),
  ]);

  if (!setup.hasSchema) {
    return <MyCoachContent state={{ kind: "needs_db" }} isAdmin={admin} weather={weather} activities={[]} />;
  }
  if (!setup.hasTemplates || !setup.hasSchedule) {
    return (
      <MyCoachContent
        state={{ kind: "needs_seed", hasTemplates: setup.hasTemplates, hasSchedule: setup.hasSchedule }}
        isAdmin={admin}
        weather={weather}
        activities={[]}
      />
    );
  }

  const date = todayLocalDate();
  const [profile, rec, activities] = await Promise.all([
    getAthleteProfile(),
    getRecommendationForDate(date),
    getActivitiesInWindow(date),
  ]);

  let completed: ActivityRow | null = null;
  if (rec?.completed_activity_id) {
    const rows = (await sql`select * from activities where id = ${rec.completed_activity_id}`) as ActivityRow[];
    completed = rows[0] ?? null;
  }

  return (
    <MyCoachContent
      state={{
        kind: "ready",
        date,
        profile,
        recommendation: rec,
        completed,
      }}
      isAdmin={admin}
      weather={weather}
      activities={activities}
    />
  );
}
