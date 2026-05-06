import { NextRequest, NextResponse } from "next/server";
import {
  sql,
  getAllWeeklySchedule,
  getPlannedItemsRange,
  isDateMaterialized,
  materializeDate,
  type PlannedItem,
  type ActivityRow,
} from "@/lib/db";
import { USER_TZ } from "@/lib/dates";

export const dynamic = "force-dynamic";

interface CompletionInfo {
  activity_id: number;
  type: string;
  name: string | null;
  distance_m: number | null;
  moving_time_s: number | null;
  avg_hr: number | null;
}

interface CalendarDay {
  date: string;
  day_of_week: number;
  items: PlannedItem[];
  completions: CompletionInfo[];
}

function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function* dateRange(from: string, to: string): Generator<string> {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const start = new Date(Date.UTC(fy, fm - 1, fd));
  const end = new Date(Date.UTC(ty, tm - 1, td));
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10);
  }
}

async function ensureMaterialized(from: string, to: string) {
  const weekly = await getAllWeeklySchedule();
  const byDow = new Map(weekly.map((s) => [s.day_of_week, s]));

  for (const date of dateRange(from, to)) {
    // eslint-disable-next-line no-await-in-loop
    if (await isDateMaterialized(date)) continue;
    const w = byDow.get(dayOfWeek(date));
    if (!w) {
      await materializeDate(date, []);
      continue;
    }
    const isRest = w.template_tags.length === 0 && !w.is_fixed;
    await materializeDate(date, [
      {
        template_tags: w.template_tags,
        sport: w.sport,
        notes: w.notes,
        is_fixed: w.is_fixed,
        is_rest: isRest,
      },
    ]);
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to required (YYYY-MM-DD)" }, { status: 400 });
  }

  await ensureMaterialized(from, to);

  const items = await getPlannedItemsRange(from, to);

  const activities = (await sql`
    select
      id, type, name, distance_m, moving_time_s, avg_hr,
      to_char(start_date at time zone ${USER_TZ}, 'YYYY-MM-DD') as date
    from activities
    where (start_date at time zone ${USER_TZ})::date between ${from} and ${to}
    order by start_date
  `) as Array<Pick<ActivityRow, "id" | "type" | "name" | "distance_m" | "moving_time_s" | "avg_hr"> & { date: string }>;

  const toDateStr = (v: unknown): string => {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v).slice(0, 10);
  };

  const days: CalendarDay[] = [];
  for (const date of dateRange(from, to)) {
    days.push({
      date,
      day_of_week: dayOfWeek(date),
      items: items.filter((i) => toDateStr(i.date) === date).map((i) => ({ ...i, date: toDateStr(i.date) })),
      completions: activities
        .filter((a) => a.date === date)
        .map((a) => ({
          activity_id: a.id,
          type: a.type,
          name: a.name,
          distance_m: a.distance_m,
          moving_time_s: a.moving_time_s,
          avg_hr: a.avg_hr,
        })),
    });
  }

  return NextResponse.json({ days });
}
