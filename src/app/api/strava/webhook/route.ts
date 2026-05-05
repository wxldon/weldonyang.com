import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  getActivity,
  getActivityStreams,
  type StravaStreams,
} from "@/lib/strava";
import {
  sql,
  getAthleteProfile,
  markRecommendationCompleted,
  getRecommendationForDate,
} from "@/lib/db";
import {
  computeNormalizedPower,
  computeTimeInHRZones,
  computeTSS,
  estimateMaxHR,
} from "@/lib/training";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = url.searchParams.get("hub.verify_token");

  if (mode === "subscribe" && verifyToken === process.env.STRAVA_VERIFY_TOKEN && challenge) {
    return NextResponse.json({ "hub.challenge": challenge });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

interface StravaWebhookEvent {
  object_type: "activity" | "athlete";
  aspect_type: "create" | "update" | "delete";
  object_id: number;
  owner_id: number;
  subscription_id: number;
  event_time: number;
  updates?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const event = (await req.json()) as StravaWebhookEvent;

  // Always 200 fast; do work async after responding would be ideal,
  // but Vercel route handlers must complete before returning. Keep work small.
  if (event.object_type !== "activity") {
    return NextResponse.json({ ok: true });
  }

  if (event.aspect_type === "delete") {
    await sql`delete from activities where id = ${event.object_id}`;
    revalidatePath("/my-coach");
    revalidatePath("/how-far-have-i-gone");
    return NextResponse.json({ ok: true });
  }

  const profile = await getAthleteProfile();
  const maxHr = profile?.max_hr ?? estimateMaxHR(26);
  const thresholdHr = profile?.threshold_hr ?? Math.round(maxHr * 0.88);

  try {
    const detail = await getActivity(event.object_id);
    let streams: StravaStreams = {};
    try {
      streams = await getActivityStreams(event.object_id);
    } catch {
      streams = {};
    }

    const np = computeNormalizedPower(streams);
    const tssRes = computeTSS({
      durationS: detail.moving_time ?? 0,
      np,
      ftp: profile?.ftp ?? null,
      avgHr: detail.average_heartrate ?? null,
      thresholdHr,
    });
    const tiz = computeTimeInHRZones(streams, maxHr);

    await sql`
      insert into activities (
        id, start_date, type, name,
        distance_m, moving_time_s, elapsed_time_s, elevation_gain_m,
        avg_hr, max_hr, avg_watts, max_watts, weighted_avg_watts, kilojoules,
        avg_cadence, suffer_score, tss, intensity_factor, time_in_zones, raw
      ) values (
        ${detail.id}, ${detail.start_date}, ${detail.type}, ${detail.name ?? null},
        ${detail.distance ?? null}, ${detail.moving_time ?? null}, ${detail.elapsed_time ?? null}, ${detail.total_elevation_gain ?? null},
        ${detail.average_heartrate ?? null}, ${detail.max_heartrate ?? null},
        ${detail.average_watts ?? null}, ${detail.max_watts ?? null}, ${detail.weighted_average_watts ?? np ?? null}, ${detail.kilojoules ?? null},
        ${detail.average_cadence ?? null}, ${detail.suffer_score ?? null},
        ${tssRes?.tss ?? null}, ${tssRes?.intensityFactor ?? null},
        ${tiz ? JSON.stringify(tiz) : null}::jsonb,
        ${JSON.stringify(detail)}::jsonb
      )
      on conflict (id) do update set
        name = excluded.name,
        avg_hr = excluded.avg_hr,
        max_hr = excluded.max_hr,
        avg_watts = excluded.avg_watts,
        max_watts = excluded.max_watts,
        weighted_avg_watts = excluded.weighted_avg_watts,
        tss = excluded.tss,
        intensity_factor = excluded.intensity_factor,
        time_in_zones = excluded.time_in_zones,
        raw = excluded.raw,
        fetched_at = now()
    `;

    if (Object.keys(streams).length > 0) {
      await sql`
        insert into streams (activity_id, data)
        values (${detail.id}, ${JSON.stringify(streams)}::jsonb)
        on conflict (activity_id) do update set data = excluded.data, fetched_at = now()
      `;
    }

    const localDate = new Date(detail.start_date).toISOString().slice(0, 10);
    const rec = await getRecommendationForDate(localDate);
    if (rec && !rec.completed_activity_id) {
      await markRecommendationCompleted(localDate, detail.id);
    }
  } catch (e) {
    console.error("webhook ingest failed", event.object_id, e);
  }

  revalidatePath("/my-coach");
  revalidatePath("/how-far-have-i-gone");
  return NextResponse.json({ ok: true });
}
