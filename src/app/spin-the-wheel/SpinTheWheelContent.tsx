"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { WheelPartition } from "@/lib/wheel";

const TAU = Math.PI * 2;

/* ---------- click sound (Web Audio) ----------------------------------- */
function makeClicker() {
  let ctx: AudioContext | null = null;
  let buffer: AudioBuffer | null = null;

  function ensure() {
    if (typeof window === "undefined") return null;
    if (!ctx) {
      type WithWebkit = typeof window & { webkitAudioContext?: typeof AudioContext };
      const w = window as WithWebkit;
      const Ctor = window.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (!buffer && ctx) {
      // 40 ms decaying white noise — short, dry, peg-tick.
      const sampleRate = ctx.sampleRate;
      const len = Math.floor(sampleRate * 0.04);
      buffer = ctx.createBuffer(1, len, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 14);
      }
    }
    return ctx;
  }

  return {
    prime() { ensure(); },
    click() {
      const c = ensure();
      if (!c || !buffer) return;
      const src = c.createBufferSource();
      src.buffer = buffer;
      const g = c.createGain();
      g.gain.value = 0.25;
      src.connect(g).connect(c.destination);
      src.start();
    },
  };
}

/* ---------- SVG path for a pie slice ---------------------------------- */
function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const sx = cx + r * Math.cos(startAngle);
  const sy = cy + r * Math.sin(startAngle);
  const ex = cx + r * Math.cos(endAngle);
  const ey = cy + r * Math.sin(endAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey} Z`;
}

/* ---------- Wheel component ------------------------------------------- */
function Wheel({
  partitions,
  angle,
}: {
  partitions: WheelPartition[];
  angle: number;
}) {
  const r = 180;
  const cx = 200;
  const cy = 200;
  const n = partitions.length;
  const sliceAngle = TAU / n;

  return (
    <svg
      viewBox="0 0 400 400"
      className="wheel-svg"
      style={{ transform: `rotate(${angle}rad)` }}
    >
      {partitions.map((p, i) => {
        // Start of slice i in the wheel's own frame, before applying `angle`.
        // We offset by -π/2 so slice 0 starts at the top (where the pointer is).
        const start = -Math.PI / 2 + i * sliceAngle;
        const end = start + sliceAngle;
        const mid = start + sliceAngle / 2;
        const labelX = cx + r * 0.62 * Math.cos(mid);
        const labelY = cy + r * 0.62 * Math.sin(mid);

        return (
          <g key={p.id}>
            <path
              d={arcPath(cx, cy, r, start, end)}
              fill={p.color}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={2}
            />
            <text
              x={labelX}
              y={labelY}
              transform={`rotate(${(mid * 180) / Math.PI + 90} ${labelX} ${labelY})`}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={Math.max(11, 18 - n * 0.4)}
              fontWeight={600}
              fill="#fff"
              style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.45)", strokeWidth: 2 }}
            >
              {p.label}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={18} fill="#0a0a0a" stroke="rgba(255,255,255,0.4)" strokeWidth={2} />
    </svg>
  );
}

/* ---------- Edit panel ------------------------------------------------- */
function EditPanel({
  partitions,
  setPartitions,
  onSaved,
}: {
  partitions: WheelPartition[];
  setPartitions: (p: WheelPartition[]) => void;
  onSaved: (p: WheelPartition[]) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (idx: number, patch: Partial<WheelPartition>) => {
    setPartitions(partitions.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const remove = (idx: number) => {
    if (partitions.length <= 2) return;
    setPartitions(partitions.filter((_, i) => i !== idx));
  };

  const add = () => {
    setPartitions([
      ...partitions,
      { id: -Date.now(), label: "new", color: "#8b5cf6", position: partitions.length },
    ]);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/wheel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partitions: partitions.map((p) => ({ label: p.label, color: p.color })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "save failed");
        return;
      }
      onSaved(json.partitions);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stw-edit">
      <div className="stw-edit-header">
        <span>Edit wheel</span>
        <span className="stw-edit-count">{partitions.length} slices</span>
      </div>
      <div className="stw-edit-rows">
        {partitions.map((p, i) => (
          <div key={p.id} className="stw-edit-row">
            <input
              type="color"
              value={p.color}
              onChange={(e) => update(i, { color: e.target.value })}
              aria-label="color"
            />
            <input
              type="text"
              value={p.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="label"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={partitions.length <= 2}
              className="stw-edit-rm"
              aria-label="remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="stw-edit-actions">
        <button type="button" onClick={add} className="stw-btn stw-btn-secondary">
          + add slice
        </button>
        <button type="button" onClick={save} disabled={saving} className="stw-btn stw-btn-primary">
          {saving ? "saving…" : "save"}
        </button>
      </div>
      {error && <p className="stw-edit-error">{error}</p>}
    </div>
  );
}

/* ---------- Main content ---------------------------------------------- */
export default function SpinTheWheelContent({
  initialPartitions,
  isAdmin,
}: {
  initialPartitions: WheelPartition[];
  isAdmin: boolean;
}) {
  const [partitions, setPartitions] = useState(initialPartitions);
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<WheelPartition | null>(null);

  const clickerRef = useRef<ReturnType<typeof makeClicker> | null>(null);
  if (clickerRef.current === null && typeof window !== "undefined") {
    clickerRef.current = makeClicker();
  }

  const partitionsRef = useRef(partitions);
  useEffect(() => { partitionsRef.current = partitions; }, [partitions]);

  // Which slice is currently under the pointer at the top of the wheel?
  // Slice i starts at -π/2 + i * sliceAngle in the wheel's own frame.
  // After rotation by `angle`, the world-frame start of slice i is
  // (-π/2 + i*sliceAngle + angle). The pointer is at world angle -π/2.
  // So pointer crosses into slice i when -π/2 == (-π/2 + i*sliceAngle + angle) mod 2π
  // -> i = (-angle / sliceAngle) mod N
  const currentIndex = useMemo(() => {
    const n = partitions.length;
    if (n === 0) return 0;
    const sliceAngle = TAU / n;
    const idx = Math.floor(((-angle / sliceAngle) % n + n) % n);
    return idx;
  }, [angle, partitions.length]);

  const spin = useCallback(() => {
    if (spinning) return;
    const n = partitionsRef.current.length;
    if (n < 2) return;

    clickerRef.current?.prime();

    setResult(null);
    setSpinning(true);

    const sliceAngle = TAU / n;

    // Physics constants. Friction is linear damping; peg potential
    // creates the "tip over" feel as the wheel slows.
    const friction = 0.6;                          // s⁻¹  (linear damping)
    const pegAmp   = 0.45 * sliceAngle;            // tuned so fast spins coast through pegs
                                                   //   but a slow wheel can fall back

    // Random direction + magnitude. Range chosen so we typically see
    // 6–14 full rotations before the wheel really starts struggling
    // against the pegs.
    const sign = Math.random() < 0.5 ? -1 : 1;
    let omega = sign * (16 + Math.random() * 10);  // rad/s
    let theta = angle;
    let lastIdx = currentIndex;
    let lastTimestamp: number | null = null;
    let restFrames = 0;                            // count of "essentially stopped" frames

    const step = (ts: number) => {
      if (lastTimestamp === null) {
        lastTimestamp = ts;
        requestAnimationFrame(step);
        return;
      }
      let dt = (ts - lastTimestamp) / 1000;
      lastTimestamp = ts;
      // Clamp dt so a stalled tab doesn't catapult the wheel on resume.
      if (dt > 1 / 30) dt = 1 / 30;

      // Sub-step for stability with stiff peg force at small ω.
      const substeps = 4;
      const h = dt / substeps;
      for (let s = 0; s < substeps; s++) {
        // pegForce(theta) = -pegAmp * sin(N*theta). Slice 0 starts at top,
        // so peg crests are at theta = (k + 0.5) * sliceAngle, valleys at
        // theta = k * sliceAngle (slice centers).
        const pegForce = -pegAmp * Math.sin(n * theta);
        const accel = -friction * omega + pegForce;
        omega += accel * h;
        theta += omega * h;
      }

      // Click on each peg crossing (i.e., slice change under the pointer).
      const sa = TAU / n;
      const idx = Math.floor(((-theta / sa) % n + n) % n);
      if (idx !== lastIdx) {
        // Multiple slice steps in one frame possible at high ω; just click once.
        clickerRef.current?.click();
        lastIdx = idx;
      }

      setAngle(theta);

      // Termination: ω small AND we're near the bottom of a peg valley
      // (i.e., slice center) so we don't freeze mid-climb.
      const nearCenter = Math.abs(Math.sin(n * theta)) < 0.05;
      if (Math.abs(omega) < 0.15 && nearCenter) {
        restFrames++;
      } else {
        restFrames = 0;
      }

      if (restFrames > 6 || Math.abs(omega) < 0.02) {
        setSpinning(false);
        const finalIdx = Math.floor(((-theta / sa) % n + n) % n);
        setResult(partitionsRef.current[finalIdx] ?? null);
        return;
      }

      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, [spinning, angle, currentIndex]);

  return (
    <main className="stw-page">
      <style>{styles}</style>
      <nav className="stw-nav">
        <Link href="/" className="stw-back">← back</Link>
        {isAdmin && <span className="stw-admin-badge">admin</span>}
      </nav>

      <section className="stw-hero">
        <h1 className="stw-title">Spin the Wheel</h1>
        <p className="stw-sub">click the wheel to spin</p>
      </section>

      <section className="stw-stage">
        <div className="stw-pointer" aria-hidden="true" />
        <button
          type="button"
          className="stw-wheel-button"
          onClick={spin}
          disabled={spinning || partitions.length < 2}
          aria-label="spin"
        >
          <Wheel partitions={partitions} angle={angle} />
        </button>
      </section>

      <section className="stw-result">
        {result ? (
          <>
            <span className="stw-result-label" style={{ color: result.color }}>
              {result.label}
            </span>
          </>
        ) : (
          <span className="stw-result-hint">
            {spinning ? "spinning…" : "—"}
          </span>
        )}
      </section>

      {isAdmin && (
        <EditPanel
          partitions={partitions}
          setPartitions={setPartitions}
          onSaved={(saved) => setPartitions(saved)}
        />
      )}
    </main>
  );
}

const styles = `
.stw-page {
  background: #000;
  color: #f5f5f7;
  min-height: 100vh;
  font-family: var(--font-sans), -apple-system, BlinkMacSystemFont, sans-serif;
  padding: 0 1.5rem 4rem;
  -webkit-font-smoothing: antialiased;
}

.stw-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  margin: 0 -1.5rem 1.5rem;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.stw-back { color: rgba(255,255,255,0.65); text-decoration: none; font-size: 0.875rem; }
.stw-back:hover { color: #fff; }
.stw-admin-badge {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  background: rgba(139, 92, 246, 0.18);
  border: 1px solid rgba(139, 92, 246, 0.45);
  color: #c4b5fd;
}

.stw-hero {
  text-align: center;
  padding: 1rem 0 2rem;
}
.stw-title {
  margin: 0;
  font-size: clamp(2rem, 6vw, 3.25rem);
  font-weight: 700;
  letter-spacing: -0.02em;
}
.stw-sub {
  margin: 0.4rem 0 0;
  color: rgba(255,255,255,0.5);
  font-size: 0.95rem;
}

.stw-stage {
  position: relative;
  width: min(440px, 90vw);
  aspect-ratio: 1;
  margin: 0 auto;
}
.stw-pointer {
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 14px solid transparent;
  border-right: 14px solid transparent;
  border-top: 26px solid #f5f5f7;
  z-index: 2;
  filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5));
}
.stw-wheel-button {
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 50%;
  filter: drop-shadow(0 12px 30px rgba(0,0,0,0.55));
  transition: transform 0.2s ease;
}
.stw-wheel-button:not(:disabled):hover { transform: scale(1.01); }
.stw-wheel-button:focus-visible {
  outline: 2px solid #8b5cf6;
  outline-offset: 6px;
}
.wheel-svg {
  width: 100%;
  height: 100%;
  display: block;
  /* No CSS transition: the physics loop drives the angle per frame. */
  transition: none;
}

.stw-result {
  margin: 1.75rem auto 0;
  text-align: center;
  min-height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stw-result-label {
  font-size: clamp(1.5rem, 4vw, 2.25rem);
  font-weight: 700;
  letter-spacing: -0.01em;
}
.stw-result-hint {
  color: rgba(255,255,255,0.35);
  font-size: 0.95rem;
  letter-spacing: 0.04em;
}

/* ---- Edit panel ---- */
.stw-edit {
  max-width: 520px;
  margin: 2rem auto 0;
  padding: 1.25rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
}
.stw-edit-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.6);
  margin-bottom: 0.85rem;
}
.stw-edit-count { color: rgba(255,255,255,0.35); }
.stw-edit-rows {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.stw-edit-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.stw-edit-row input[type="color"] {
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}
.stw-edit-row input[type="text"] {
  flex: 1;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: #fff;
  border-radius: 6px;
  padding: 0.45rem 0.7rem;
  font-size: 0.9rem;
}
.stw-edit-rm {
  background: none;
  border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.5);
  border-radius: 6px;
  padding: 0 0.6rem;
  height: 36px;
  cursor: pointer;
  font-size: 0.85rem;
}
.stw-edit-rm:hover:not(:disabled) { color: #f87171; border-color: #f87171; }
.stw-edit-rm:disabled { opacity: 0.35; cursor: not-allowed; }

.stw-edit-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.9rem;
  justify-content: flex-end;
}
.stw-btn {
  border-radius: 6px;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  cursor: pointer;
  border: none;
}
.stw-btn-primary {
  background: #8b5cf6;
  color: #fff;
}
.stw-btn-secondary {
  background: transparent;
  color: #c4b5fd;
  border: 1px solid rgba(139, 92, 246, 0.5);
}
.stw-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.stw-edit-error {
  color: #f87171;
  font-size: 0.8rem;
  margin: 0.6rem 0 0;
}
`;
