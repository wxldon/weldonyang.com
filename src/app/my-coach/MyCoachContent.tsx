"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  ActivityRow,
  AthleteProfile,
  RecommendationRow,
  ScheduleRow,
} from "@/lib/db";

type State =
  | { kind: "needs_db" }
  | { kind: "needs_seed"; hasTemplates: boolean; hasSchedule: boolean }
  | {
      kind: "ready";
      date: string;
      profile: AthleteProfile | null;
      schedule: ScheduleRow | null;
      recommendation: RecommendationRow | null;
      completed: ActivityRow | null;
    };

interface Segment {
  phase: string;
  duration_min?: number;
  target?: string;
  hr_range?: [number, number] | null;
  pace_range_per_km_s?: [number, number] | null;
  power_range_w?: [number, number] | null;
  reps?: number | null;
  notes?: string;
}

interface Prescribed {
  name?: string;
  sport?: string;
  total_duration_min?: number;
  segments?: Segment[];
  rest?: boolean;
  note?: string;
}

const purple = "#8b5cf6";

export default function MyCoachContent({ state }: { state: State }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);

  async function generate(force = false) {
    setGenerating(true);
    try {
      await fetch(`/api/coach${force ? "?force=1" : ""}`, { method: "POST" });
      startTransition(() => router.refresh());
    } finally {
      setGenerating(false);
    }
  }

  if (state.kind === "needs_db") {
    return (
      <Shell>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "1rem" }}>My Coach</h1>
        <p style={{ opacity: 0.7 }}>
          Database not initialized. Run <code style={code}>src/lib/db/schema.sql</code> on your Neon instance, then refresh.
        </p>
      </Shell>
    );
  }

  if (state.kind === "needs_seed") {
    return (
      <Shell>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "1rem" }}>My Coach</h1>
        <p style={{ opacity: 0.7, lineHeight: 1.6 }}>
          Setup needed:
          {!state.hasTemplates && <> seed <code style={code}>workout_templates</code>.</>}
          {!state.hasSchedule && <> seed <code style={code}>workout_schedule</code>.</>}
        </p>
      </Shell>
    );
  }

  const { date, recommendation, schedule, completed } = state;

  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <h1 style={{ fontSize: "1.75rem" }}>My workout today</h1>
        <span style={{ opacity: 0.5, fontSize: "0.875rem" }}>{date}</span>
      </div>

      {schedule && (
        <p style={{ opacity: 0.55, fontSize: "0.875rem", marginBottom: "1.5rem" }}>
          Scheduled: {schedule.template_tags.join(" / ")}
          {schedule.sport ? ` · ${schedule.sport}` : ""}
        </p>
      )}

      {!recommendation && (
        <div style={card}>
          <p style={{ opacity: 0.7, marginBottom: "1rem" }}>No prescription yet for today.</p>
          <button
            onClick={() => generate(false)}
            disabled={generating || isPending}
            style={btn}
          >
            {generating || isPending ? "Generating…" : "Generate today's workout"}
          </button>
        </div>
      )}

      {recommendation && <WorkoutCard prescribed={recommendation.prescribed as Prescribed} reasoning={recommendation.reasoning} />}

      {recommendation && (
        <div style={{ marginTop: "1.5rem" }}>
          <CompletionStatus completed={completed} />
        </div>
      )}

      {recommendation && (
        <div style={{ marginTop: "2rem", display: "flex", gap: "0.75rem" }}>
          <button
            onClick={() => generate(true)}
            disabled={generating || isPending}
            style={{ ...btn, background: "transparent", border: `1px solid ${purple}`, color: purple }}
          >
            {generating || isPending ? "Regenerating…" : "Regenerate"}
          </button>
        </div>
      )}

      <div style={{ marginTop: "3rem" }}>
        <Link href="/" style={{ opacity: 0.5, fontSize: "0.875rem" }}>← home</Link>
      </div>
    </Shell>
  );
}

function WorkoutCard({ prescribed, reasoning }: { prescribed: Prescribed; reasoning: string | null }) {
  if (prescribed.rest) {
    return (
      <div style={card}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Rest day</h2>
        <p style={{ opacity: 0.75 }}>{prescribed.note ?? "Recover. Stretch. Sleep."}</p>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.25rem" }}>{prescribed.name ?? "Workout"}</h2>
        <span style={{ opacity: 0.5, fontSize: "0.875rem" }}>
          {prescribed.sport} · {prescribed.total_duration_min} min
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {(prescribed.segments ?? []).map((seg, i) => (
          <SegmentRow key={i} seg={seg} />
        ))}
      </div>

      {reasoning && (
        <p style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.08)", opacity: 0.65, fontSize: "0.875rem", lineHeight: 1.55 }}>
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
        gridTemplateColumns: "100px 1fr auto",
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
      <span style={{ opacity: 0.65, alignSelf: "center" }}>
        {seg.duration_min ? `${seg.duration_min} min` : ""}
      </span>
    </div>
  );
}

function formatTarget(seg: Segment): string {
  const parts: string[] = [];
  if (seg.target) parts.push(seg.target);
  if (seg.hr_range) parts.push(`HR ${seg.hr_range[0]}–${seg.hr_range[1]}`);
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

function CompletionStatus({ completed }: { completed: ActivityRow | null }) {
  if (!completed) {
    return (
      <div style={{ ...statusPill, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)" }}>
        Not yet completed
      </div>
    );
  }
  const km = completed.distance_m ? (completed.distance_m / 1000).toFixed(2) : null;
  const min = completed.moving_time_s ? Math.round(completed.moving_time_s / 60) : null;
  return (
    <div style={{ ...statusPill, background: "rgba(139, 92, 246, 0.12)", color: purple, border: `1px solid ${purple}` }}>
      Completed ✓ · {completed.name}
      <span style={{ opacity: 0.7, marginLeft: "0.5rem" }}>
        {km ? `${km} km` : ""}{min ? ` · ${min} min` : ""}{completed.avg_hr ? ` · avg HR ${Math.round(completed.avg_hr)}` : ""}
      </span>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: "3rem 1.5rem" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>{children}</div>
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
