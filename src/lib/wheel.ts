import { sql } from "@/lib/db";

export interface WheelPartition {
  id: number;
  label: string;
  color: string;
  position: number;
}

// Defaults used when the DB has no rows yet, so the page always has
// something to spin even before the admin touches it.
const DEFAULT_PARTITIONS: Omit<WheelPartition, "id">[] = [
  { label: "Pizza",      color: "#ef4444", position: 0 },
  { label: "Sushi",      color: "#f97316", position: 1 },
  { label: "Burgers",    color: "#facc15", position: 2 },
  { label: "Thai",       color: "#22c55e", position: 3 },
  { label: "Tacos",      color: "#06b6d4", position: 4 },
  { label: "Pasta",      color: "#3b82f6", position: 5 },
  { label: "Ramen",      color: "#8b5cf6", position: 6 },
  { label: "Indian",     color: "#ec4899", position: 7 },
];

export async function getWheelPartitions(): Promise<WheelPartition[]> {
  const rows = (await sql`
    select id, label, color, position
    from wheel_partitions
    order by position asc, id asc
  `) as WheelPartition[];
  if (rows.length === 0) {
    return DEFAULT_PARTITIONS.map((p, i) => ({ ...p, id: -(i + 1) }));
  }
  return rows;
}

export async function replaceWheelPartitions(
  partitions: { label: string; color: string }[],
): Promise<WheelPartition[]> {
  // Wipe and re-insert in the provided order. The wheel is small
  // enough that this is cheaper than a diffing dance.
  await sql`delete from wheel_partitions`;
  for (let i = 0; i < partitions.length; i++) {
    const p = partitions[i];
    await sql`
      insert into wheel_partitions (label, color, position)
      values (${p.label}, ${p.color}, ${i})
    `;
  }
  return getWheelPartitions();
}
