import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import {
  getAthleteProfile,
  getRecentActivityRows,
  getScheduleForDay,
  getTemplatesByTags,
  getRecommendationForDate,
  upsertRecommendation,
  upsertAthleteProfile,
  type WorkoutTemplate,
} from "@/lib/db";
import {
  computeFitnessLoad,
  estimateMaxHR,
  hrZones,
  resolveTarget,
} from "@/lib/training";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function todayLocalDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function todayDayOfWeek(): number {
  return new Date().getUTCDay();
}

function summarizeTemplate(t: WorkoutTemplate, profile: { max_hr: number | null; ftp: number | null; threshold_pace_s_per_km: number | null }) {
  const resolved = JSON.stringify(t.structure, null, 2);
  return {
    id: t.id,
    name: t.name,
    sport: t.sport,
    tags: t.tags,
    structure: resolved,
    notes: t.notes,
    profile,
  };
}

async function generate(req: NextRequest) {
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const date = todayLocalDate();

  if (!force) {
    const existing = await getRecommendationForDate(date);
    if (existing) {
      return NextResponse.json({ recommendation: existing, cached: true });
    }
  }

  let profile = await getAthleteProfile();
  if (!profile) {
    await upsertAthleteProfile({ max_hr: estimateMaxHR(26) });
    profile = await getAthleteProfile();
  }
  if (!profile) {
    return NextResponse.json({ error: "no athlete profile" }, { status: 500 });
  }

  const schedule = await getScheduleForDay(todayDayOfWeek());
  if (!schedule) {
    return NextResponse.json({ error: "no schedule for today — seed workout_schedule" }, { status: 400 });
  }

  if (schedule.template_tags.includes("rest")) {
    const rec = {
      date,
      template_id: null,
      prescribed: { rest: true, note: "Rest day per schedule. Prioritize sleep and mobility." },
      reasoning: "Scheduled rest day.",
    };
    await upsertRecommendation(rec);
    revalidatePath("/my-coach");
    return NextResponse.json({ recommendation: rec, cached: false });
  }

  const candidates = await getTemplatesByTags(schedule.template_tags, schedule.sport ?? undefined);
  if (candidates.length === 0) {
    return NextResponse.json({ error: `no templates match tags ${schedule.template_tags.join(",")}` }, { status: 400 });
  }

  const recent = await getRecentActivityRows(30);
  const fitness = computeFitnessLoad(recent);

  const recentSummaries = recent.slice(0, 20).map((a) => ({
    date: a.start_date.slice(0, 10),
    type: a.type,
    name: a.name,
    duration_min: a.moving_time_s ? Math.round(a.moving_time_s / 60) : null,
    distance_km: a.distance_m ? Math.round(a.distance_m / 100) / 10 : null,
    avg_hr: a.avg_hr,
    max_hr: a.max_hr,
    avg_watts: a.avg_watts,
    np: a.weighted_avg_watts,
    tss: a.tss,
    if: a.intensity_factor,
    time_in_zones_s: a.time_in_zones,
  }));

  const zones = hrZones(profile.max_hr ?? estimateMaxHR(26));
  const profileForLLM = {
    max_hr: profile.max_hr,
    ftp: profile.ftp,
    threshold_hr: profile.threshold_hr,
    threshold_pace_s_per_km: profile.threshold_pace_s_per_km,
    hr_zones: zones,
  };

  const candidateSummaries = candidates.map((t) => summarizeTemplate(t, profileForLLM));

  const sys = `You are a personal endurance coach. Given today's scheduled workout tags, candidate workout templates, and the athlete's recent training, produce a single concrete prescription for today.

Rules:
- Pick exactly ONE template from candidates.
- Resolve every "target" string in the template (e.g. "z2", "tempo", "vo2_pace") to specific HR ranges or paces using the athlete's profile.
- Scale durations and intensities based on recent fitness (CTL/ATL/TSB) and how recent comparable workouts went. Hard intervals shorter if athlete is fatigued (TSB < -15). Slightly longer if fresh (TSB > 5).
- Output STRICT JSON. No prose outside JSON.

Output schema:
{
  "template_id": <int>,
  "prescribed": {
    "name": "<template name>",
    "sport": "<run|ride|swim>",
    "total_duration_min": <number>,
    "segments": [
      { "phase": "warmup|main|cooldown|interval|rest", "duration_min": <number>, "target": "<label>", "hr_range": [lo,hi] | null, "pace_range_per_km_s": [lo,hi] | null, "power_range_w": [lo,hi] | null, "reps": <int|null>, "notes": "<short>" }
    ]
  },
  "reasoning": "<2-4 sentences citing fitness state and last similar workout>"
}`;

  const userMessage = JSON.stringify({
    today: date,
    day_of_week: todayDayOfWeek(),
    schedule,
    fitness,
    profile: profileForLLM,
    candidates: candidateSummaries,
    recent_activities: recentSummaries,
  });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: [{ type: "text", text: sys, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMessage }],
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "model did not return JSON", raw: text }, { status: 500 });
  }

  let parsed: { template_id: number; prescribed: Record<string, unknown>; reasoning: string };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json({ error: "failed to parse model JSON", raw: text }, { status: 500 });
  }

  // Belt-and-suspenders: re-resolve any unresolved targets server-side.
  const segments = (parsed.prescribed.segments as Array<Record<string, unknown>>) ?? [];
  for (const seg of segments) {
    if (seg.target && !seg.hr_range && !seg.pace_range_per_km_s && !seg.power_range_w) {
      const r = resolveTarget(String(seg.target), profile);
      if (r.hrRange) seg.hr_range = r.hrRange;
      if (r.paceRangeSPerKm) seg.pace_range_per_km_s = r.paceRangeSPerKm;
      if (r.powerRange) seg.power_range_w = r.powerRange;
    }
  }

  await upsertRecommendation({
    date,
    template_id: parsed.template_id,
    prescribed: parsed.prescribed,
    reasoning: parsed.reasoning,
  });
  revalidatePath("/my-coach");

  const saved = await getRecommendationForDate(date);
  return NextResponse.json({ recommendation: saved, cached: false });
}

export async function GET(req: NextRequest) {
  return generate(req);
}

export async function POST(req: NextRequest) {
  return generate(req);
}
