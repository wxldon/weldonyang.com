import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest, unauthorized } from "@/lib/auth";
import { replaceMediaEntries } from "@/lib/media";

export const dynamic = "force-dynamic";

interface MediaInput {
  rating?: unknown;
  name?: unknown;
  type?: unknown;
  notes?: unknown;
}

function clean(
  input: unknown,
): { rating: number | null; name: string; type: string | null; notes: string | null }[] | null {
  if (!Array.isArray(input)) return null;
  const out: { rating: number | null; name: string; type: string | null; notes: string | null }[] = [];
  for (const raw of input as MediaInput[]) {
    if (typeof raw?.name !== "string") return null;
    const name = raw.name.trim().slice(0, 200);
    if (!name) continue; // silently drop blank rows
    let rating: number | null = null;
    if (raw.rating !== null && raw.rating !== undefined && raw.rating !== "") {
      const n = typeof raw.rating === "number" ? raw.rating : parseFloat(String(raw.rating));
      if (!Number.isFinite(n)) return null;
      rating = Math.max(0, Math.min(10, Math.round(n * 10) / 10));
    }
    const type = typeof raw.type === "string" ? raw.type.trim().slice(0, 60) || null : null;
    const notes = typeof raw.notes === "string" ? raw.notes.trim().slice(0, 1000) || null : null;
    out.push({ rating, name, type, notes });
  }
  if (out.length > 500) return null;
  return out;
}

export async function PUT(req: NextRequest) {
  if (!isAdminFromRequest(req)) return unauthorized();

  const body = (await req.json()) as { entries?: unknown };
  const cleaned = clean(body.entries);
  if (!cleaned) {
    return NextResponse.json(
      { error: "expected entries: { rating?, name, type?, notes? }[]" },
      { status: 400 },
    );
  }

  const saved = await replaceMediaEntries(cleaned);
  return NextResponse.json({ entries: saved });
}
