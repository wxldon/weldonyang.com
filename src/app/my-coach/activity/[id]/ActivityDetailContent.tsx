"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ActivityRow } from "@/lib/db";

interface DecimatedStreams {
  time?: number[];
  heartrate?: number[];
  watts?: number[];
  cadence?: number[];
  velocity_smooth?: number[];
  altitude?: number[];
  distance?: number[];
}

const purple = "#8b5cf6";
const easing = [0.22, 1, 0.36, 1] as const;

const ZONE_COLORS: Record<string, string> = {
  z1: "#3b82f6",
  z2: "#22c55e",
  z3: "#eab308",
  z4: "#f97316",
  z5: "#ef4444",
};

export default function ActivityDetailContent({
  activity,
  streams,
  localDate,
}: {
  activity: ActivityRow;
  streams: DecimatedStreams;
  localDate: string;
}) {
  const distMi = activity.distance_m ? activity.distance_m / 1609.344 : null;
  const durSec = activity.moving_time_s ?? 0;
  const elevFt = activity.elevation_gain_m ? activity.elevation_gain_m * 3.28084 : null;
  const avgPaceSPerMi = distMi && distMi > 0 ? durSec / distMi : null;
  const sport = activity.type.toLowerCase();
  const isRun = sport.includes("run");
  const isRide = sport.includes("ride") || sport.includes("bike");

  const paceArr =
    streams.velocity_smooth && streams.velocity_smooth.length > 0
      ? streams.velocity_smooth.map((v) => (v > 0 ? 1609.344 / v : 0))
      : undefined;

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: "3rem 1.5rem" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <Link href="/my-coach" style={{ opacity: 0.5, fontSize: "0.875rem" }}>← my coach</Link>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easing }}
          style={{ marginTop: "1.25rem" }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 500 }}>{activity.name ?? "Activity"}</h1>
            <span style={{ opacity: 0.5, fontSize: "0.875rem" }}>
              {localDate} · {activity.type}
            </span>
          </div>
        </motion.div>

        <StatsGrid
          activity={activity}
          distMi={distMi}
          durSec={durSec}
          elevFt={elevFt}
          avgPaceSPerMi={avgPaceSPerMi}
          isRun={isRun}
          isRide={isRide}
        />

        {activity.time_in_zones && (
          <Section title="Time in zones">
            <ZoneBars zones={activity.time_in_zones} />
          </Section>
        )}

        {streams.heartrate && streams.time && (
          <Section title="Heart rate">
            <LineChart
              x={streams.time}
              y={streams.heartrate}
              color="#ef4444"
              yLabel="bpm"
              xFormatter={fmtDuration}
              yFormatter={(v) => Math.round(v).toString()}
            />
          </Section>
        )}

        {paceArr && streams.time && isRun && (
          <Section title="Pace">
            <LineChart
              x={streams.time}
              y={paceArr}
              color={purple}
              yLabel="/mi"
              yInverted
              xFormatter={fmtDuration}
              yFormatter={fmtPace}
              clampY={[180, 1200]}
            />
          </Section>
        )}

        {streams.watts && streams.time && (streams.watts.some((w) => w > 0)) && (
          <Section title="Power">
            <LineChart
              x={streams.time}
              y={streams.watts}
              color="#f97316"
              yLabel="W"
              xFormatter={fmtDuration}
              yFormatter={(v) => Math.round(v).toString()}
            />
          </Section>
        )}

        {streams.altitude && streams.time && (
          <Section title="Elevation">
            <LineChart
              x={streams.time}
              y={streams.altitude.map((m) => m * 3.28084)}
              color="#22c55e"
              yLabel="ft"
              xFormatter={fmtDuration}
              yFormatter={(v) => Math.round(v).toString()}
              fill
            />
          </Section>
        )}

        {streams.cadence && streams.time && streams.cadence.some((c) => c > 0) && (
          <Section title={isRide ? "Cadence (rpm)" : "Cadence (spm)"}>
            <LineChart
              x={streams.time}
              y={streams.cadence.map((c) => (isRun ? c * 2 : c))}
              color="#3b82f6"
              yLabel={isRide ? "rpm" : "spm"}
              xFormatter={fmtDuration}
              yFormatter={(v) => Math.round(v).toString()}
            />
          </Section>
        )}
      </div>
    </main>
  );
}

function StatsGrid({
  activity,
  distMi,
  durSec,
  elevFt,
  avgPaceSPerMi,
  isRun,
  isRide,
}: {
  activity: ActivityRow;
  distMi: number | null;
  durSec: number;
  elevFt: number | null;
  avgPaceSPerMi: number | null;
  isRun: boolean;
  isRide: boolean;
}) {
  const tiles: Array<{ label: string; value: string; sub?: string }> = [];
  if (distMi != null) tiles.push({ label: "Distance", value: `${distMi.toFixed(2)} mi` });
  tiles.push({ label: "Time", value: fmtDuration(durSec) });
  if (isRun && avgPaceSPerMi) tiles.push({ label: "Avg Pace", value: `${fmtPace(avgPaceSPerMi)}/mi` });
  if (isRide && distMi && durSec > 0) {
    const mph = distMi / (durSec / 3600);
    tiles.push({ label: "Avg Speed", value: `${mph.toFixed(1)} mph` });
  }
  if (elevFt != null) tiles.push({ label: "Elevation", value: `${Math.round(elevFt)} ft` });
  if (activity.avg_hr) tiles.push({ label: "Avg HR", value: `${Math.round(activity.avg_hr)}`, sub: activity.max_hr ? `max ${activity.max_hr}` : undefined });
  if (activity.avg_watts) tiles.push({ label: "Avg Power", value: `${Math.round(activity.avg_watts)} W`, sub: activity.weighted_avg_watts ? `NP ${Math.round(activity.weighted_avg_watts)}` : undefined });
  if (activity.kilojoules) tiles.push({ label: "Energy", value: `${Math.round(activity.kilojoules)} kJ` });
  if (activity.tss) tiles.push({ label: "TSS", value: `${activity.tss}`, sub: activity.intensity_factor ? `IF ${activity.intensity_factor}` : undefined });
  if (activity.suffer_score) tiles.push({ label: "Suffer", value: `${activity.suffer_score}` });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05, ease: easing }}
      style={{
        marginTop: "1.5rem",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: "0.5rem",
      }}
    >
      {tiles.map((t, i) => (
        <div
          key={i}
          style={{
            padding: "0.75rem 0.875rem",
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: "0.6875rem", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {t.label}
          </div>
          <div style={{ fontSize: "1.125rem", fontWeight: 500, marginTop: "0.125rem" }}>{t.value}</div>
          {t.sub && <div style={{ fontSize: "0.75rem", opacity: 0.55, marginTop: "0.125rem" }}>{t.sub}</div>}
        </div>
      ))}
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: easing }}
      style={{ marginTop: "2rem" }}
    >
      <h2 style={{ fontSize: "0.875rem", opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.625rem" }}>
        {title}
      </h2>
      {children}
    </motion.section>
  );
}

function ZoneBars({ zones }: { zones: Record<string, number> }) {
  const total = Object.values(zones).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const order = ["z1", "z2", "z3", "z4", "z5"];

  return (
    <div>
      <div style={{ display: "flex", height: 14, borderRadius: 4, overflow: "hidden", background: "rgba(255,255,255,0.04)" }}>
        {order.map((z) => {
          const v = zones[z] ?? 0;
          const pct = (v / total) * 100;
          if (pct === 0) return null;
          return <div key={z} style={{ width: `${pct}%`, background: ZONE_COLORS[z] }} />;
        })}
      </div>
      <div style={{ marginTop: "0.5rem", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.375rem", fontSize: "0.75rem" }}>
        {order.map((z) => {
          const v = zones[z] ?? 0;
          const pct = (v / total) * 100;
          return (
            <div key={z} style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: ZONE_COLORS[z] }} />
              <span style={{ opacity: 0.65 }}>{z.toUpperCase()}</span>
              <span style={{ marginLeft: "auto", opacity: 0.85 }}>{Math.round(pct)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LineChart({
  x,
  y,
  color,
  yLabel,
  yInverted,
  xFormatter,
  yFormatter,
  fill,
  clampY,
}: {
  x: number[];
  y: number[];
  color: string;
  yLabel?: string;
  yInverted?: boolean;
  xFormatter?: (v: number) => string;
  yFormatter?: (v: number) => string;
  fill?: boolean;
  clampY?: [number, number];
}) {
  const W = 720;
  const H = 160;
  const PAD_L = 36;
  const PAD_R = 12;
  const PAD_T = 8;
  const PAD_B = 22;

  const n = Math.min(x.length, y.length);
  const xs = x.slice(0, n);
  const ys = y.slice(0, n);

  let yMin = Infinity;
  let yMax = -Infinity;
  for (const v of ys) {
    if (clampY && (v < clampY[0] || v > clampY[1])) continue;
    if (v < yMin) yMin = v;
    if (v > yMax) yMax = v;
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
    yMin = 0;
    yMax = 1;
  }
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const yPad = (yMax - yMin) * 0.05;
  yMin -= yPad;
  yMax += yPad;

  const xMin = xs[0];
  const xMax = xs[n - 1] || 1;

  const sx = (v: number) => PAD_L + ((v - xMin) / (xMax - xMin || 1)) * (W - PAD_L - PAD_R);
  const sy = (v: number) => {
    const t = (v - yMin) / (yMax - yMin || 1);
    const flipped = yInverted ? t : 1 - t;
    return PAD_T + flipped * (H - PAD_T - PAD_B);
  };

  const points: string[] = [];
  for (let i = 0; i < n; i++) {
    const v = ys[i];
    if (clampY && (v < clampY[0] || v > clampY[1])) continue;
    points.push(`${sx(xs[i]).toFixed(1)},${sy(v).toFixed(1)}`);
  }
  const linePath = "M " + points.join(" L ");
  const fillPath = fill && points.length > 0
    ? `M ${PAD_L},${H - PAD_B} L ${points.join(" L ")} L ${(W - PAD_R).toFixed(1)},${H - PAD_B} Z`
    : "";

  const yTicks = [yMin, (yMin + yMax) / 2, yMax];
  const xTicks = [xMin, (xMin + xMax) / 2, xMax];

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <rect x={PAD_L} y={PAD_T} width={W - PAD_L - PAD_R} height={H - PAD_T - PAD_B} fill="rgba(255,255,255,0.02)" rx={4} />

        {yTicks.map((t, i) => {
          const yy = sy(t);
          return (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={yy} y2={yy} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
              <text x={PAD_L - 4} y={yy + 3} fill="rgba(255,255,255,0.45)" fontSize="9" textAnchor="end">
                {yFormatter ? yFormatter(t) : t.toFixed(0)}
              </text>
            </g>
          );
        })}

        {xTicks.map((t, i) => {
          const xx = sx(t);
          return (
            <text key={i} x={xx} y={H - 6} fill="rgba(255,255,255,0.45)" fontSize="9" textAnchor="middle">
              {xFormatter ? xFormatter(t) : t.toFixed(0)}
            </text>
          );
        })}

        {fill && fillPath && <path d={fillPath} fill={color} fillOpacity={0.15} />}
        <path d={linePath} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />

        {yLabel && (
          <text x={PAD_L} y={PAD_T - 1} fill="rgba(255,255,255,0.45)" fontSize="9">
            {yLabel}
          </text>
        )}
      </svg>
    </div>
  );
}

function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtPace(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
