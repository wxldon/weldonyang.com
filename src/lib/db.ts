import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

export const sql: NeonQueryFunction<false, false> = ((strings: TemplateStringsArray, ...values: unknown[]) =>
  getSql()(strings, ...values)) as NeonQueryFunction<false, false>;

export interface ActivityRow {
  id: number;
  start_date: string;
  type: string;
  name: string | null;
  distance_m: number | null;
  moving_time_s: number | null;
  elapsed_time_s: number | null;
  elevation_gain_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_watts: number | null;
  max_watts: number | null;
  weighted_avg_watts: number | null;
  kilojoules: number | null;
  avg_cadence: number | null;
  suffer_score: number | null;
  tss: number | null;
  intensity_factor: number | null;
  time_in_zones: Record<string, number> | null;
  raw: Record<string, unknown>;
}

export interface AthleteProfile {
  id: number;
  ftp: number | null;
  max_hr: number | null;
  resting_hr: number | null;
  threshold_hr: number | null;
  threshold_pace_s_per_km: number | null;
  fitness_goal: string | null;
  updated_at: string;
}

export interface WorkoutTemplate {
  id: number;
  name: string;
  sport: string;
  tags: string[];
  structure: Record<string, unknown>;
  notes: string | null;
}

export interface ScheduleRow {
  day_of_week: number;
  template_tags: string[];
  sport: string | null;
  notes: string | null;
  is_fixed: boolean;
}

export interface PlannedItem {
  id: number;
  date: string;
  template_tags: string[];
  sport: string | null;
  notes: string | null;
  is_fixed: boolean;
  is_rest: boolean;
  position: number;
}

export interface RecommendationRow {
  date: string;
  template_id: number | null;
  prescribed: Record<string, unknown>;
  reasoning: string | null;
  completed_activity_id: number | null;
}

export async function getAthleteProfile(): Promise<AthleteProfile | null> {
  const rows = (await sql`select * from athlete_profile where id = 1`) as AthleteProfile[];
  return rows[0] ?? null;
}

export async function upsertAthleteProfile(p: Partial<Omit<AthleteProfile, "id" | "updated_at">>) {
  await sql`
    insert into athlete_profile (id, ftp, max_hr, resting_hr, threshold_hr, threshold_pace_s_per_km, updated_at)
    values (1, ${p.ftp ?? null}, ${p.max_hr ?? null}, ${p.resting_hr ?? null}, ${p.threshold_hr ?? null}, ${p.threshold_pace_s_per_km ?? null}, now())
    on conflict (id) do update set
      ftp = coalesce(excluded.ftp, athlete_profile.ftp),
      max_hr = coalesce(excluded.max_hr, athlete_profile.max_hr),
      resting_hr = coalesce(excluded.resting_hr, athlete_profile.resting_hr),
      threshold_hr = coalesce(excluded.threshold_hr, athlete_profile.threshold_hr),
      threshold_pace_s_per_km = coalesce(excluded.threshold_pace_s_per_km, athlete_profile.threshold_pace_s_per_km),
      updated_at = now()
  `;
}

export async function getLatestActivityDate(): Promise<Date | null> {
  const rows = (await sql`select max(start_date) as max_date from activities`) as { max_date: string | null }[];
  return rows[0]?.max_date ? new Date(rows[0].max_date) : null;
}

export async function getRecentActivityRows(sinceDays: number): Promise<ActivityRow[]> {
  const rows = (await sql`
    select * from activities
    where start_date >= now() - (${sinceDays} || ' days')::interval
    order by start_date desc
  `) as ActivityRow[];
  return rows;
}

export async function getTemplatesByTags(tags: string[], sport?: string): Promise<WorkoutTemplate[]> {
  const rows = sport
    ? ((await sql`
        select * from workout_templates
        where tags && ${tags} and sport = ${sport}
      `) as WorkoutTemplate[])
    : ((await sql`
        select * from workout_templates
        where tags && ${tags}
      `) as WorkoutTemplate[]);
  return rows;
}

export async function getScheduleForDay(dayOfWeek: number): Promise<ScheduleRow | null> {
  const rows = (await sql`select * from workout_schedule where day_of_week = ${dayOfWeek}`) as ScheduleRow[];
  return rows[0] ?? null;
}

export async function getAllWeeklySchedule(): Promise<ScheduleRow[]> {
  const rows = (await sql`select * from workout_schedule order by day_of_week`) as ScheduleRow[];
  return rows;
}

export async function getPlannedItems(date: string): Promise<PlannedItem[]> {
  const rows = (await sql`
    select * from workout_planned_items
    where date = ${date}
    order by position, id
  `) as PlannedItem[];
  return rows;
}

export async function getPlannedItemsRange(from: string, to: string): Promise<PlannedItem[]> {
  const rows = (await sql`
    select * from workout_planned_items
    where date between ${from} and ${to}
    order by date, position, id
  `) as PlannedItem[];
  return rows;
}

export async function isDateMaterialized(date: string): Promise<boolean> {
  const rows = (await sql`select 1 from workout_planned_dates where date = ${date}`) as { "?column?": number }[];
  return rows.length > 0;
}

export async function materializeDate(
  date: string,
  items: Array<{
    template_tags: string[];
    sport: string | null;
    notes: string | null;
    is_fixed: boolean;
    is_rest: boolean;
  }>,
) {
  await sql`insert into workout_planned_dates (date) values (${date}) on conflict do nothing`;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    await sql`
      insert into workout_planned_items (date, template_tags, sport, notes, is_fixed, is_rest, position)
      values (${date}, ${it.template_tags}, ${it.sport}, ${it.notes}, ${it.is_fixed}, ${it.is_rest}, ${i})
    `;
  }
}

export async function moveItem(itemId: number, newDate: string) {
  await sql`update workout_planned_items set date = ${newDate} where id = ${itemId}`;
}

export async function deleteRecommendation(date: string) {
  await sql`delete from workout_recommendations where date = ${date}`;
}

export async function getRecommendationForDate(date: string): Promise<RecommendationRow | null> {
  const rows = (await sql`select * from workout_recommendations where date = ${date}`) as RecommendationRow[];
  return rows[0] ?? null;
}

export async function upsertRecommendation(r: {
  date: string;
  template_id: number | null;
  prescribed: Record<string, unknown>;
  reasoning: string;
}) {
  await sql`
    insert into workout_recommendations (date, template_id, prescribed, reasoning)
    values (${r.date}, ${r.template_id}, ${JSON.stringify(r.prescribed)}::jsonb, ${r.reasoning})
    on conflict (date) do update set
      template_id = excluded.template_id,
      prescribed = excluded.prescribed,
      reasoning = excluded.reasoning
  `;
}

export async function markRecommendationCompleted(date: string, activityId: number) {
  await sql`
    update workout_recommendations
    set completed_activity_id = ${activityId}
    where date = ${date}
  `;
}
