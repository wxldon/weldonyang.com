import { sql } from "@/lib/db";

export interface MediaEntry {
  id: number;
  rating: number | null;
  name: string;
  type: string | null;
  notes: string | null;
  position: number;
}

export async function getMediaEntries(): Promise<MediaEntry[]> {
  const rows = (await sql`
    select id, rating, name, type, notes, position
    from media_entries
    order by position asc, id asc
  `) as { id: number; rating: string | number | null; name: string; type: string | null; notes: string | null; position: number }[];
  return rows.map((r) => ({
    ...r,
    rating: r.rating === null ? null : typeof r.rating === "string" ? parseFloat(r.rating) : r.rating,
  }));
}

export async function replaceMediaEntries(
  entries: { rating: number | null; name: string; type: string | null; notes: string | null }[],
): Promise<MediaEntry[]> {
  await sql`delete from media_entries`;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    await sql`
      insert into media_entries (rating, name, type, notes, position)
      values (${e.rating}, ${e.name}, ${e.type}, ${e.notes}, ${i})
    `;
  }
  return getMediaEntries();
}
