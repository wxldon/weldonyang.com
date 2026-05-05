import type { StravaStreams } from "./strava";
import type { ActivityRow, AthleteProfile } from "./db";

export function estimateMaxHR(age: number): number {
  return Math.round(208 - 0.7 * age);
}

export function hrZones(maxHr: number): { z1: [number, number]; z2: [number, number]; z3: [number, number]; z4: [number, number]; z5: [number, number] } {
  const pct = (lo: number, hi: number): [number, number] => [Math.round(maxHr * lo), Math.round(maxHr * hi)];
  return {
    z1: pct(0.50, 0.60),
    z2: pct(0.60, 0.70),
    z3: pct(0.70, 0.80),
    z4: pct(0.80, 0.90),
    z5: pct(0.90, 1.00),
  };
}

export function powerZones(ftp: number): { z1: [number, number]; z2: [number, number]; z3: [number, number]; z4: [number, number]; z5: [number, number]; z6: [number, number]; z7: [number, number] } {
  const pct = (lo: number, hi: number): [number, number] => [Math.round(ftp * lo), Math.round(ftp * hi)];
  return {
    z1: pct(0.00, 0.55),
    z2: pct(0.55, 0.75),
    z3: pct(0.75, 0.90),
    z4: pct(0.90, 1.05),
    z5: pct(1.05, 1.20),
    z6: pct(1.20, 1.50),
    z7: pct(1.50, 3.00),
  };
}

function streamArray(streams: StravaStreams, key: string): number[] | null {
  const s = streams[key];
  if (!s || !Array.isArray(s.data)) return null;
  return s.data as number[];
}

export function computeTimeInHRZones(streams: StravaStreams, maxHr: number): Record<string, number> | null {
  const time = streamArray(streams, "time");
  const hr = streamArray(streams, "heartrate");
  if (!time || !hr || time.length !== hr.length) return null;

  const zones = hrZones(maxHr);
  const buckets: Record<string, number> = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };

  for (let i = 1; i < time.length; i++) {
    const dt = time[i] - time[i - 1];
    if (dt <= 0 || dt > 30) continue;
    const v = hr[i];
    if (v == null) continue;
    const z =
      v < zones.z1[0] ? null :
      v < zones.z2[0] ? "z1" :
      v < zones.z3[0] ? "z2" :
      v < zones.z4[0] ? "z3" :
      v < zones.z5[0] ? "z4" : "z5";
    if (z) buckets[z] += dt;
  }
  return buckets;
}

function rollingNormalizedPower(watts: number[], time: number[], windowS: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < watts.length; i++) {
    const tEnd = time[i];
    let j = i;
    let sum = 0;
    let count = 0;
    while (j >= 0 && tEnd - time[j] <= windowS) {
      sum += watts[j] ?? 0;
      count++;
      j--;
    }
    out.push(count > 0 ? sum / count : 0);
  }
  return out;
}

export function computeNormalizedPower(streams: StravaStreams): number | null {
  const watts = streamArray(streams, "watts");
  const time = streamArray(streams, "time");
  if (!watts || !time || watts.length !== time.length || watts.length === 0) return null;

  const rolled = rollingNormalizedPower(watts, time, 30);
  let sum = 0;
  let n = 0;
  for (const r of rolled) {
    sum += r ** 4;
    n++;
  }
  if (n === 0) return null;
  return Math.round(Math.pow(sum / n, 0.25));
}

export function computeTSS(opts: {
  durationS: number;
  np?: number | null;
  ftp?: number | null;
  avgHr?: number | null;
  thresholdHr?: number | null;
}): { tss: number; intensityFactor: number } | null {
  if (opts.np && opts.ftp) {
    const if_ = opts.np / opts.ftp;
    const tss = (opts.durationS * opts.np * if_) / (opts.ftp * 3600) * 100;
    return { tss: Math.round(tss * 10) / 10, intensityFactor: Math.round(if_ * 1000) / 1000 };
  }
  if (opts.avgHr && opts.thresholdHr) {
    const if_ = opts.avgHr / opts.thresholdHr;
    const tss = (opts.durationS / 3600) * (if_ ** 2) * 100;
    return { tss: Math.round(tss * 10) / 10, intensityFactor: Math.round(if_ * 1000) / 1000 };
  }
  return null;
}

export function estimateFTPFromHistory(activities: { streams?: StravaStreams }[]): number | null {
  let bestNP20 = 0;
  for (const a of activities) {
    if (!a.streams) continue;
    const watts = streamArray(a.streams, "watts");
    const time = streamArray(a.streams, "time");
    if (!watts || !time || watts.length < 1200) continue;

    const rolled = rollingNormalizedPower(watts, time, 1200);
    for (const r of rolled) if (r > bestNP20) bestNP20 = r;
  }
  if (bestNP20 < 50) return null;
  return Math.round(bestNP20 * 0.95);
}

export interface FitnessLoad {
  ctl: number;
  atl: number;
  tsb: number;
}

export function computeFitnessLoad(activities: ActivityRow[], asOf: Date = new Date()): FitnessLoad {
  const dayMap = new Map<string, number>();
  for (const a of activities) {
    if (a.tss == null) continue;
    const d = new Date(a.start_date).toISOString().slice(0, 10);
    dayMap.set(d, (dayMap.get(d) ?? 0) + a.tss);
  }

  const ctlAlpha = 1 - Math.exp(-1 / 42);
  const atlAlpha = 1 - Math.exp(-1 / 7);

  let ctl = 0;
  let atl = 0;
  const start = new Date(asOf);
  start.setUTCDate(start.getUTCDate() - 90);
  for (let d = new Date(start); d <= asOf; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const tss = dayMap.get(key) ?? 0;
    ctl = ctl + ctlAlpha * (tss - ctl);
    atl = atl + atlAlpha * (tss - atl);
  }
  return {
    ctl: Math.round(ctl * 10) / 10,
    atl: Math.round(atl * 10) / 10,
    tsb: Math.round((ctl - atl) * 10) / 10,
  };
}

export interface ResolvedTarget {
  label: string;
  hrRange?: [number, number];
  paceRangeSPerKm?: [number, number];
  powerRange?: [number, number];
}

export function resolveTarget(
  label: string,
  profile: AthleteProfile,
): ResolvedTarget {
  const l = label.toLowerCase().trim();
  const max = profile.max_hr ?? estimateMaxHR(26);
  const z = hrZones(max);
  const tp = profile.threshold_pace_s_per_km;

  const fromZone = (zone: keyof typeof z): ResolvedTarget => ({
    label,
    hrRange: z[zone],
  });

  if (l === "easy" || l === "z1" || l === "recovery") return fromZone("z1");
  if (l === "z2" || l === "endurance" || l === "long") return fromZone("z2");
  if (l === "z3" || l === "steady" || l === "marathon") return fromZone("z3");
  if (l === "z4" || l === "tempo" || l === "threshold") return fromZone("z4");
  if (l === "z5" || l === "vo2" || l === "vo2_pace" || l === "vo2max") return fromZone("z5");

  if (profile.ftp) {
    const pz = powerZones(profile.ftp);
    if (l === "ftp") return { label, powerRange: [profile.ftp, profile.ftp] };
    if (l === "sweet_spot" || l === "ss") return { label, powerRange: [Math.round(profile.ftp * 0.88), Math.round(profile.ftp * 0.94)] };
    if (l in pz) return { label, powerRange: pz[l as keyof typeof pz] };
  }

  if (tp) {
    if (l === "threshold_pace") return { label, paceRangeSPerKm: [tp - 5, tp + 5] };
    if (l === "5k_pace") return { label, paceRangeSPerKm: [tp - 20, tp - 10] };
    if (l === "marathon_pace") return { label, paceRangeSPerKm: [tp + 15, tp + 25] };
  }

  return { label };
}
