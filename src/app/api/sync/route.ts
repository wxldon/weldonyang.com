import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  getRecentActivities,
  getActivity,
  getActivityStreams,
  type StravaActivitySummary,
  type StravaStreams,
} from "@/lib/strava";
import { sql, getLatestActivityDate, upsertAthleteProfile, getAthleteProfile } from "@/lib/db";
import {
  computeNormalizedPower,
  computeTimeInHRZones,
  computeTSS,
  estimateFTPFromHistory,
  estimateMaxHR,
} from "@/lib/training";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const SIX_MONTHS_S = 60 * 60 * 24 * 30 * 6;

async function ingestOne(summary: StravaActivitySummary, profileMaxHr: number, profileFtp: number | null, profileThresholdHr: number | null) {
  const detail = await getActivity(summary.id);
  let streams: StravaStreams = {};
  try {
    streams = await getActivityStreams(summary.id);
  } catch {
    streams = {};
  }

  const np = computeNormalizedPower(streams);
  const tssRes = computeTSS({
    durationS: detail.moving_time ?? 0,
    np,
    ftp: profileFtp,
    avgHr: detail.average_heartrate ?? null,
    thresholdHr: profileThresholdHr,
  });
  const tiz = computeTimeInHRZones(streams, profileMaxHr);

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
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "incremental";

  let profile = await getAthleteProfile();
  if (!profile) {
    await upsertAthleteProfile({ max_hr: estimateMaxHR(26) });
    profile = await getAthleteProfile();
  }
  const maxHr = profile?.max_hr ?? estimateMaxHR(26);
  const thresholdHr = profile?.threshold_hr ?? Math.round(maxHr * 0.88);

  let after: number | undefined;
  if (mode === "incremental") {
    const last = await getLatestActivityDate();
    after = last ? Math.floor(last.getTime() / 1000) : Math.floor(Date.now() / 1000) - SIX_MONTHS_S;
  } else if (mode === "backfill") {
    after = Math.floor(Date.now() / 1000) - SIX_MONTHS_S;
  }

  let page = 1;
  let total = 0;
  const errors: { id: number; error: string }[] = [];

  while (true) {
    const batch = await getRecentActivities({ after, page, perPage: 100 });
    if (batch.length === 0) break;

    for (const a of batch) {
      try {
        await ingestOne(a, maxHr, profile?.ftp ?? null, thresholdHr);
        total++;
      } catch (e) {
        errors.push({ id: a.id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    if (batch.length < 100) break;
    page++;
  }

  if (mode === "backfill" && profile && !profile.ftp) {
    const rows = (await sql`
      select s.data from streams s
      join activities a on a.id = s.activity_id
      where a.type ilike '%ride%'
      order by a.start_date desc
      limit 50
    `) as { data: StravaStreams }[];
    const ftp = estimateFTPFromHistory(rows.map((r) => ({ streams: r.data })));
    if (ftp) await upsertAthleteProfile({ ftp });
  }

  if (total > 0) {
    revalidatePath("/how-far-have-i-gone");
    revalidatePath("/my-coach");
  }

  return NextResponse.json({ ingested: total, errors, mode });
}
