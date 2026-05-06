import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  sql,
  moveItem,
  deleteRecommendation,
  type PlannedItem,
} from "@/lib/db";
import { isAdminFromRequest, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  if (!isAdminFromRequest(req)) return unauthorized();

  const { item_id, new_date } = (await req.json()) as { item_id?: number; new_date?: string };
  if (!item_id || !new_date || !/^\d{4}-\d{2}-\d{2}$/.test(new_date)) {
    return NextResponse.json({ error: "item_id and new_date (YYYY-MM-DD) required" }, { status: 400 });
  }

  const rows = (await sql`
    select id, to_char(date, 'YYYY-MM-DD') as date
    from workout_planned_items
    where id = ${item_id}
  `) as Array<Pick<PlannedItem, "id" | "date">>;
  const original = rows[0];
  if (!original) return NextResponse.json({ error: "item not found" }, { status: 404 });

  const oldDate = original.date;
  await moveItem(item_id, new_date);

  const today = todayDate();
  if (oldDate === today || new_date === today) {
    await deleteRecommendation(today);
  }

  revalidatePath("/my-coach");
  return NextResponse.json({ ok: true, moved_from: oldDate, moved_to: new_date });
}
