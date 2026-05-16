import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest, unauthorized } from "@/lib/auth";
import { replaceWheelPartitions } from "@/lib/wheel";

export const dynamic = "force-dynamic";

interface PartitionInput {
  label?: unknown;
  color?: unknown;
}

function clean(input: unknown): { label: string; color: string }[] | null {
  if (!Array.isArray(input)) return null;
  const out: { label: string; color: string }[] = [];
  for (const raw of input as PartitionInput[]) {
    if (typeof raw?.label !== "string" || typeof raw?.color !== "string") return null;
    const label = raw.label.trim().slice(0, 60);
    const color = raw.color.trim().slice(0, 24);
    if (!label || !/^#?[0-9a-fA-F]{3,8}$|^[a-zA-Z]+$/.test(color)) return null;
    out.push({ label, color: color.startsWith("#") || /[a-zA-Z]/.test(color[0]) ? color : `#${color}` });
  }
  if (out.length < 2 || out.length > 24) return null;
  return out;
}

export async function PUT(req: NextRequest) {
  if (!isAdminFromRequest(req)) return unauthorized();

  const body = (await req.json()) as { partitions?: unknown };
  const cleaned = clean(body.partitions);
  if (!cleaned) {
    return NextResponse.json(
      { error: "expected partitions: { label, color }[] with 2..24 entries" },
      { status: 400 },
    );
  }

  const saved = await replaceWheelPartitions(cleaned);
  return NextResponse.json({ partitions: saved });
}
