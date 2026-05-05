import { Metadata } from "next";
import {
  getAthleteProfile,
  getScheduleForDay,
  getRecommendationForDate,
  sql,
  type ActivityRow,
} from "@/lib/db";
import MyCoachContent from "./MyCoachContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Coach — Weldon Yang",
  description: "Today's prescribed workout, tailored to recent training.",
};

function todayLocalDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function todayDayOfWeek(): number {
  return new Date().getUTCDay();
}

interface SetupState {
  hasSchema: boolean;
  hasTemplates: boolean;
  hasSchedule: boolean;
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
  const setup = await checkSetup();

  if (!setup.hasSchema) {
    return (
      <MyCoachContent
        state={{ kind: "needs_db" }}
      />
    );
  }
  if (!setup.hasTemplates || !setup.hasSchedule) {
    return (
      <MyCoachContent
        state={{ kind: "needs_seed", hasTemplates: setup.hasTemplates, hasSchedule: setup.hasSchedule }}
      />
    );
  }

  const date = todayLocalDate();
  const [profile, schedule, rec] = await Promise.all([
    getAthleteProfile(),
    getScheduleForDay(todayDayOfWeek()),
    getRecommendationForDate(date),
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
        schedule,
        recommendation: rec,
        completed,
      }}
    />
  );
}
