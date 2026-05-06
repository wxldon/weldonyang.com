import { NextRequest, NextResponse } from "next/server";
import { getStreamsForActivity } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_POINTS = 400;

function decimate(arr: number[] | undefined, target: number): number[] | undefined {
  if (!arr || arr.length === 0) return undefined;
  if (arr.length <= target) return arr;
  const step = arr.length / target;
  const out: number[] = [];
  for (let i = 0; i < target; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

function decimatePairs(arr: [number, number][] | undefined, target: number): [number, number][] | undefined {
  if (!arr || arr.length === 0) return undefined;
  if (arr.length <= target) return arr;
  const step = arr.length / target;
  const out: [number, number][] = [];
  for (let i = 0; i < target; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const raw = await getStreamsForActivity(numId);
  if (!raw) {
    return NextResponse.json({ streams: null });
  }

  const get = (k: string): number[] | undefined => {
    const s = raw[k];
    if (!s || !Array.isArray(s.data)) return undefined;
    return s.data as number[];
  };

  const streams: Record<string, unknown> = {
    time: decimate(get("time"), MAX_POINTS),
    heartrate: decimate(get("heartrate"), MAX_POINTS),
    watts: decimate(get("watts"), MAX_POINTS),
    cadence: decimate(get("cadence"), MAX_POINTS),
    velocity_smooth: decimate(get("velocity_smooth"), MAX_POINTS),
    altitude: decimate(get("altitude"), MAX_POINTS),
    distance: decimate(get("distance"), MAX_POINTS),
  };

  const latlngStream = raw.latlng;
  if (latlngStream && Array.isArray(latlngStream.data)) {
    streams.latlng = decimatePairs(latlngStream.data as [number, number][], MAX_POINTS);
  }

  const res = NextResponse.json({ streams });
  res.headers.set("Cache-Control", "public, max-age=86400, immutable");
  return res;
}
