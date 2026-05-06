"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  ActivityRow,
  AthleteProfile,
  RecommendationRow,
} from "@/lib/db";
import type { WeatherSummary } from "@/lib/weather";
import Calendar from "./Calendar";
import ActivitySection from "./ActivitySection";
import type { ActivityHeader } from "./page";

type State =
  | { kind: "needs_db" }
  | { kind: "needs_seed"; hasTemplates: boolean; hasSchedule: boolean }
  | {
      kind: "ready";
      date: string;
      profile: AthleteProfile | null;
      recommendation: RecommendationRow | null;
      completed: Omit<ActivityRow, "raw"> | null;
    };

interface Segment {
  phase: string;
  duration_min?: number | null;
  duration_s?: number | null;
  distance_mi?: number | null;
  distance_km?: number | null;
  target?: string;
  hr_range?: [number, number] | null;
  pace_range_per_km_s?: [number, number] | null;
  pace_range_per_mi_s?: [number, number] | null;
  power_range_w?: [number, number] | null;
  reps?: number | null;
  notes?: string;
}

interface FixedItem {
  sport?: string | null;
  notes?: string | null;
  is_fixed?: boolean;
  is_rest?: boolean;
}

interface Prescribed {
  name?: string;
  sport?: string;
  total_duration_min?: number;
  segments?: Segment[];
  rest?: boolean;
  note?: string;
  fixed_items?: FixedItem[];
}

const purple = "#8b5cf6";

export default function MyCoachContent({
  state,
  isAdmin,
  weather,
  activities,
}: {
  state: State;
  isAdmin: boolean;
  weather: WeatherSummary | null;
  activities: ActivityHeader[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  async function generate(force = false) {
    setGenerating(true);
    setAdminMenuOpen(false);
    try {
      await fetch(`/api/coach${force ? "?force=1" : ""}`, { method: "POST" });
      startTransition(() => router.refresh());
    } finally {
      setGenerating(false);
    }
  }

  if (state.kind === "needs_db") {
    return (
      <Shell isAdmin={isAdmin}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "1rem" }}>My Coach</h1>
        <p style={{ opacity: 0.7 }}>
          Database not initialized. Run <code style={code}>src/lib/db/schema.sql</code> on Neon.
        </p>
      </Shell>
    );
  }

  if (state.kind === "needs_seed") {
    return (
      <Shell isAdmin={isAdmin}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "1rem" }}>My Coach</h1>
        <p style={{ opacity: 0.7, lineHeight: 1.6 }}>
          Setup needed:
          {!state.hasTemplates && <> seed <code style={code}>workout_templates</code>.</>}
          {!state.hasSchedule && <> seed <code style={code}>workout_schedule</code>.</>}
        </p>
      </Shell>
    );
  }

  const { date, profile, recommendation, completed } = state;
  const goal = profile?.fitness_goal ?? null;

  return (
    <Shell isAdmin={isAdmin}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <h1 style={{ fontSize: "1.75rem" }}>My workout today</h1>
        <span style={{ opacity: 0.5, fontSize: "0.875rem" }}>{date}</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginBottom: "1.5rem" }}>
        {goal && (
          <div
            style={{
              display: "inline-block",
              padding: "0.25rem 0.625rem",
              borderRadius: 999,
              background: "rgba(139, 92, 246, 0.12)",
              border: `1px solid ${purple}`,
              color: purple,
              fontSize: "0.8125rem",
            }}
          >
            Goal: {goal}
          </div>
        )}
        {weather && <WeatherStrip weather={weather} />}
      </div>

      {!recommendation && (
        <div style={card}>
          <p style={{ opacity: 0.7, marginBottom: "1rem" }}>No prescription yet for today.</p>
          {isAdmin ? (
            <button onClick={() => generate(false)} disabled={generating} style={btn}>
              {generating ? "Generating…" : "Generate today's workout"}
            </button>
          ) : (
            <p style={{ opacity: 0.5, fontSize: "0.875rem" }}>Check back after the daily 5am UTC run.</p>
          )}
        </div>
      )}

      {recommendation && (
        <div style={{ position: "relative" }}>
          <WorkoutCard
            prescribed={recommendation.prescribed as Prescribed}
            reasoning={recommendation.reasoning}
          />
          {isAdmin && (
            <div style={{ position: "absolute", top: "0.875rem", right: "0.875rem" }}>
              <button
                onClick={() => setAdminMenuOpen((v) => !v)}
                style={gearBtn}
                aria-label="admin actions"
              >
                ⚙
              </button>
              {adminMenuOpen && (
                <div style={menu}>
                  <button onClick={() => generate(true)} disabled={generating} style={menuItem}>
                    {generating ? "Regenerating…" : "Regenerate workout"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {recommendation && (
        <div style={{ marginTop: "1.25rem" }}>
          <CompletionStatus completed={completed} />
        </div>
      )}

      <Calendar isAdmin={isAdmin} today={date} />

      {activities.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          {activities.map((a) => (
            <ActivitySection
              key={a.activity.id}
              activity={a.activity}
              localDate={a.localDate}
            />
          ))}
        </div>
      )}

      <div style={{ marginTop: "3rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/" style={{ opacity: 0.5, fontSize: "0.875rem" }}>← home</Link>
        <Link href="/admin" style={{ opacity: 0.4, fontSize: "0.75rem" }}>
          {isAdmin ? "admin (signed in)" : "admin"}
        </Link>
      </div>
    </Shell>
  );
}

function WorkoutCard({ prescribed, reasoning }: { prescribed: Prescribed; reasoning: string | null }) {
  if (prescribed.rest) {
    return (
      <div style={card}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Rest / Cross-train</h2>
        <p style={{ opacity: 0.75 }}>{prescribed.note ?? "Recover. Stretch. Sleep."}</p>
        {prescribed.fixed_items && prescribed.fixed_items.length > 0 && (
          <ul style={{ marginTop: "0.75rem", paddingLeft: "1.25rem", opacity: 0.7, fontSize: "0.875rem" }}>
            {prescribed.fixed_items.map((f, i) => (
              <li key={i}>
                {f.notes ?? f.sport}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "1rem", paddingRight: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem" }}>{prescribed.name ?? "Workout"}</h2>
        <span style={{ opacity: 0.5, fontSize: "0.875rem" }}>
          {prescribed.sport}
          {prescribed.total_duration_min ? ` · ${prescribed.total_duration_min} min` : ""}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {(prescribed.segments ?? []).map((seg, i) => (
          <SegmentRow key={i} seg={seg} />
        ))}
      </div>

      {reasoning && (
        <p style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.08)", opacity: 0.7, fontSize: "0.875rem", lineHeight: 1.55 }}>
          {reasoning}
        </p>
      )}
    </div>
  );
}

function SegmentRow({ seg }: { seg: Segment }) {
  const targetText = formatTarget(seg);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "110px 1fr auto",
        gap: "0.75rem",
        padding: "0.625rem 0.75rem",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 6,
        fontSize: "0.9375rem",
      }}
    >
      <span style={{ opacity: 0.55, textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.05em", alignSelf: "center" }}>
        {seg.phase}
        {seg.reps ? ` ×${seg.reps}` : ""}
      </span>
      <span style={{ alignSelf: "center" }}>{targetText}</span>
      <span style={{ opacity: 0.65, alignSelf: "center" }}>{formatAmount(seg)}</span>
    </div>
  );
}

function formatAmount(seg: Segment): string {
  if (seg.duration_min != null) return `${seg.duration_min} min`;
  if (seg.duration_s != null) {
    const m = Math.floor(seg.duration_s / 60);
    const s = seg.duration_s % 60;
    if (m === 0) return `${s} sec`;
    if (s === 0) return `${m} min`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  if (seg.distance_mi != null) return `${seg.distance_mi} mi`;
  if (seg.distance_km != null) return `${seg.distance_km} km`;
  return "";
}

function formatTarget(seg: Segment): string {
  const parts: string[] = [];
  if (seg.target) parts.push(seg.target);
  if (seg.hr_range) parts.push(`HR ${seg.hr_range[0]}–${seg.hr_range[1]}`);
  if (seg.pace_range_per_mi_s) parts.push(`${formatPace(seg.pace_range_per_mi_s[0])}–${formatPace(seg.pace_range_per_mi_s[1])}/mi`);
  if (seg.pace_range_per_km_s) parts.push(`${formatPace(seg.pace_range_per_km_s[0])}–${formatPace(seg.pace_range_per_km_s[1])}/km`);
  if (seg.power_range_w) parts.push(`${seg.power_range_w[0]}–${seg.power_range_w[1]} W`);
  if (seg.notes) parts.push(`— ${seg.notes}`);
  return parts.join(" · ");
}

function formatPace(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function WeatherStrip({ weather }: { weather: WeatherSummary }) {
  const nextChange = weather.events.find((e) => e.kind === "rain-start" || e.kind === "rain-stop");
  const sunEvent = weather.events.find((e) => e.kind === "sunset" || e.kind === "sunrise");

  const bits: string[] = [];
  if (nextChange) bits.push(nextChange.label.toLowerCase());
  if (sunEvent) bits.push(sunEvent.label.toLowerCase());
  if (weather.windMph >= 12) bits.push(`wind ${weather.windMph}${weather.gustMph > weather.windMph + 5 ? `g${weather.gustMph}` : ""} mph`);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.25rem 0.625rem",
        borderRadius: 999,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        fontSize: "0.8125rem",
        color: "rgba(255,255,255,0.85)",
      }}
      title={`H ${weather.todayHighF}° / L ${weather.todayLowF}° · feels like ${weather.feelsLikeF}° · UV ${weather.uvMax}`}
    >
      <span aria-hidden="true">{weather.emoji}</span>
      <span>
        {weather.tempF}°F · {weather.conditions.toLowerCase()}
      </span>
      {bits.length > 0 && (
        <span style={{ opacity: 0.65 }}>· {bits.join(" · ")}</span>
      )}
    </div>
  );
}

function CompletionStatus({ completed }: { completed: Omit<ActivityRow, "raw"> | null }) {
  if (!completed) {
    return (
      <div style={{ ...statusPill, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)" }}>
        Not yet completed
      </div>
    );
  }
  const mi = completed.distance_m ? (completed.distance_m / 1609.344).toFixed(2) : null;
  const dur = completed.moving_time_s ? formatDurationLong(completed.moving_time_s) : null;
  return (
    <div style={{ ...statusPill, background: "rgba(139, 92, 246, 0.12)", color: purple, border: `1px solid ${purple}` }}>
      Completed ✓ · {completed.name}
      <span style={{ opacity: 0.7, marginLeft: "0.5rem" }}>
        {mi ? `${mi} mi` : ""}{dur ? ` · ${dur}` : ""}{completed.avg_hr ? ` · avg HR ${Math.round(completed.avg_hr)}` : ""}
      </span>
    </div>
  );
}

function formatDurationLong(seconds: number): string {
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

function Shell({ children, isAdmin }: { children: React.ReactNode; isAdmin: boolean }) {
  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: "3rem 1.5rem" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {isAdmin && (
          <div style={{ position: "fixed", top: 16, right: 16, fontSize: "0.6875rem", color: purple, opacity: 0.65, padding: "0.25rem 0.5rem", background: "rgba(139, 92, 246, 0.10)", borderRadius: 4 }}>
            admin mode
          </div>
        )}
        {children}
      </div>
    </main>
  );
}

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  padding: "1.5rem",
};

const btn: React.CSSProperties = {
  background: purple,
  color: "#fff",
  border: "none",
  padding: "0.625rem 1.25rem",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: "0.9375rem",
};

const gearBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.7)",
  border: "1px solid rgba(255,255,255,0.10)",
  width: 28,
  height: 28,
  borderRadius: 999,
  cursor: "pointer",
  fontSize: "0.875rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};

const menu: React.CSSProperties = {
  position: "absolute",
  top: 36,
  right: 0,
  background: "#0a0a0a",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 6,
  padding: "0.25rem",
  minWidth: 200,
  zIndex: 10,
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
};

const menuItem: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  color: "#fff",
  border: "none",
  padding: "0.5rem 0.75rem",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: "0.875rem",
  textAlign: "left",
};

const statusPill: React.CSSProperties = {
  display: "inline-block",
  padding: "0.5rem 0.875rem",
  borderRadius: 999,
  fontSize: "0.875rem",
};

const code: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  padding: "0.125rem 0.375rem",
  borderRadius: 4,
  fontSize: "0.85em",
};
