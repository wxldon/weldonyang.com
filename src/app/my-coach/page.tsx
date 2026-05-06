import { Metadata } from "next";
import {
  getAthleteProfile,
  getRecommendationForDate,
  sql,
  type ActivityRow,
  type StreamData,
} from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { todayLocalDate, USER_TZ, toLocalDateStr } from "@/lib/dates";
import { getWeatherSummary, type WeatherSummary } from "@/lib/weather";
import MyCoachContent from "./MyCoachContent";
import type { DecimatedStreams } from "./ActivitySection";

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

const MAX_POINTS = 400;

function decimate(arr: number[] | undefined, target: number): number[] | undefined {
  if (!arr || arr.length === 0) return undefined;
  if (arr.length <= target) return arr;
  const step = arr.length / target;
  const out: number[] = [];
  for (let i = 0; i < target; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

export interface ActivityWithStreams {
  activity: ActivityRow;
  streams: DecimatedStreams;
  localDate: string;
}

async function getActivitiesInWindow(today: string): Promise<ActivityWithStreams[]> {
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
    select a.*, s.data as stream_data
    from activities a
    left join streams s on s.activity_id = a.id
    where (a.start_date at time zone ${USER_TZ})::date between ${from} and ${to}
    order by a.start_date desc
  `) as Array<ActivityRow & { stream_data: Record<string, StreamData> | null }>;

  return rows.map((r) => {
    const streams: DecimatedStreams = {};
    if (r.stream_data) {
      const get = (k: string): number[] | undefined => {
        const s = r.stream_data?.[k];
        if (!s || !Array.isArray(s.data)) return undefined;
        return s.data as number[];
      };
      streams.time = decimate(get("time"), MAX_POINTS);
      streams.heartrate = decimate(get("heartrate"), MAX_POINTS);
      streams.watts = decimate(get("watts"), MAX_POINTS);
      streams.cadence = decimate(get("cadence"), MAX_POINTS);
      streams.velocity_smooth = decimate(get("velocity_smooth"), MAX_POINTS);
      streams.altitude = decimate(get("altitude"), MAX_POINTS);
      streams.distance = decimate(get("distance"), MAX_POINTS);
    }
    const { stream_data: _stream_data, ...activity } = r;
    void _stream_data;
    return {
      activity: activity as ActivityRow,
      streams,
      localDate: toLocalDateStr(activity.start_date),
    };
  });
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
