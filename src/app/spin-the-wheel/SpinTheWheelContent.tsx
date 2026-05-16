"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { WheelPartition } from "@/lib/wheel";
import type { MediaEntry } from "@/lib/media";

const TAU = Math.PI * 2;

/* ---------- Picking a distinct color for new slices -------------------
 * Tailwind-500 hues, well-spaced around the wheel. When the admin adds a
 * slice we score each palette entry by its minimum RGB distance to any
 * existing slice's color and pick the one with the largest score, so the
 * new slice automatically stands out against what's already on the wheel.
 */
const COLOR_PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#facc15",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e",
];

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return [128, 128, 128];
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return [128, 128, 128];
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbDistSq(a: [number, number, number], b: [number, number, number]) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function pickDistinctColor(existing: string[]): string {
  if (existing.length === 0) return COLOR_PALETTE[0];
  const usedRgb = existing.map(hexToRgb);
  let best = COLOR_PALETTE[0];
  let bestScore = -1;
  for (const cand of COLOR_PALETTE) {
    const candRgb = hexToRgb(cand);
    let minDist = Infinity;
    for (const ur of usedRgb) {
      const d = rgbDistSq(candRgb, ur);
      if (d < minDist) minDist = d;
    }
    if (minDist > bestScore) {
      bestScore = minDist;
      best = cand;
    }
  }
  return best;
}

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

/* ---------- Drag-to-reorder hook --------------------------------------
 * Native HTML5 DnD. Drop ON row X means "land at X's current visual
 * slot." Adjusts for the splice shift when dragging downward so the
 * visual semantics stay intuitive. Drag is only initiated from a
 * handle element (getHandleProps); the surrounding row accepts drops
 * (getRowProps) — that way clicking into inputs doesn't start a drag.
 */
function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  const adjusted = to > from ? to - 1 : to;
  next.splice(adjusted, 0, moved);
  return next;
}

function useDragReorder<T>(items: T[], setItems: (next: T[]) => void) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const finish = () => {
    setDragIdx(null);
    setOverIdx(null);
  };

  return {
    dragIdx,
    overIdx,
    getHandleProps: (idx: number) => ({
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        setDragIdx(idx);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(idx));
      },
      onDragEnd: finish,
    }),
    getRowProps: (idx: number) => ({
      onDragOver: (e: React.DragEvent) => {
        if (dragIdx === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (overIdx !== idx) setOverIdx(idx);
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        if (dragIdx === null || dragIdx === idx) {
          finish();
          return;
        }
        setItems(reorder(items, dragIdx, idx));
        finish();
      },
    }),
  };
}

/* ---------- Reusable confirm dialog ----------------------------------- */
function ConfirmDialog({
  open,
  message,
  detail,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: string;
  detail?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onCancel, onConfirm]);

  if (!open) return null;
  return (
    <div className="stw-confirm" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="stw-confirm-card" onClick={(e) => e.stopPropagation()}>
        <p className="stw-confirm-msg">{message}</p>
        {detail && <p className="stw-confirm-detail">{detail}</p>}
        <div className="stw-confirm-actions">
          <button className="stw-btn stw-btn-secondary" onClick={onCancel}>cancel</button>
          <button className="stw-btn stw-btn-danger" onClick={onConfirm} autoFocus>delete</button>
        </div>
      </div>
    </div>
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
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const dnd = useDragReorder(partitions, setPartitions);

  const update = (idx: number, patch: Partial<WheelPartition>) => {
    setPartitions(partitions.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const requestRemove = (idx: number) => {
    if (partitions.length <= 2) return;
    setConfirmIdx(idx);
  };

  const confirmRemove = () => {
    if (confirmIdx === null) return;
    setPartitions(partitions.filter((_, i) => i !== confirmIdx));
    setConfirmIdx(null);
  };

  const add = () => {
    const color = pickDistinctColor(partitions.map((p) => p.color));
    setPartitions([
      ...partitions,
      { id: -Date.now(), label: "new", color, position: partitions.length },
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
        {partitions.map((p, i) => {
          const isDragging = dnd.dragIdx === i;
          const isOver = dnd.overIdx === i && dnd.dragIdx !== null && dnd.dragIdx !== i;
          return (
            <div
              key={p.id}
              className={`stw-edit-row ${isDragging ? "is-dragging" : ""} ${isOver ? "is-over" : ""}`}
              {...dnd.getRowProps(i)}
            >
              <span
                {...dnd.getHandleProps(i)}
                className="stw-drag-handle"
                aria-label="drag to reorder"
                title="drag to reorder"
              >
                ⠿
              </span>
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
                onClick={() => requestRemove(i)}
                disabled={partitions.length <= 2}
                className="stw-edit-rm"
                aria-label="remove"
              >
                ✕
              </button>
            </div>
          );
        })}
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
      <ConfirmDialog
        open={confirmIdx !== null}
        message="Delete this slice?"
        detail={confirmIdx !== null ? partitions[confirmIdx]?.label : undefined}
        onConfirm={confirmRemove}
        onCancel={() => setConfirmIdx(null)}
      />
    </div>
  );
}

/* ---------- Media table ----------------------------------------------- */
type MediaDraft = {
  id: number;            // negative for new rows
  rating: string;        // string for free-form editing; parsed on save
  name: string;
  type: string;
  notes: string;
};

function toDraft(e: MediaEntry): MediaDraft {
  return {
    id: e.id,
    rating: e.rating == null ? "" : String(e.rating),
    name: e.name,
    type: e.type ?? "",
    notes: e.notes ?? "",
  };
}

function MediaTable({
  entries,
  isAdmin,
  onSaved,
}: {
  entries: MediaEntry[];
  isAdmin: boolean;
  onSaved: (e: MediaEntry[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<MediaDraft[]>(() => entries.map(toDraft));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const tempId = useRef(-1);
  const dnd = useDragReorder(drafts, setDrafts);

  // Keep drafts in sync with prop when not actively editing (e.g., after save).
  useEffect(() => {
    if (!editing) setDrafts(entries.map(toDraft));
  }, [entries, editing]);

  const startEdit = () => setEditing(true);
  const cancelEdit = () => {
    setDrafts(entries.map(toDraft));
    setEditing(false);
    setError(null);
  };
  const update = (idx: number, patch: Partial<MediaDraft>) => {
    setDrafts((d) => d.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };
  const addRow = () => {
    setDrafts((d) => [...d, { id: tempId.current--, rating: "", name: "", type: "", notes: "" }]);
  };
  const requestRemoveRow = (idx: number) => {
    const row = drafts[idx];
    const isEmpty = !row || (!row.name && !row.type && !row.notes && !row.rating);
    if (isEmpty) {
      setDrafts((d) => d.filter((_, i) => i !== idx));
      return;
    }
    setConfirmIdx(idx);
  };
  const confirmRemoveRow = () => {
    if (confirmIdx === null) return;
    setDrafts((d) => d.filter((_, i) => i !== confirmIdx));
    setConfirmIdx(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = drafts
        .filter((d) => d.name.trim() !== "")
        .map((d) => ({
          rating: d.rating.trim() === "" ? null : parseFloat(d.rating),
          name: d.name.trim(),
          type: d.type.trim() === "" ? null : d.type.trim(),
          notes: d.notes.trim() === "" ? null : d.notes.trim(),
        }));
      const res = await fetch("/api/admin/media", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: payload }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "save failed");
        return;
      }
      onSaved(json.entries);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const rows = editing ? drafts : entries.map(toDraft);

  return (
    <section className="stw-media">
      <div className="stw-media-header">
        <h2>watch list</h2>
        {isAdmin && !editing && (
          <button className="stw-btn stw-btn-secondary" onClick={startEdit}>
            edit
          </button>
        )}
        {isAdmin && editing && (
          <div className="stw-media-actions">
            <button className="stw-btn stw-btn-secondary" onClick={cancelEdit} disabled={saving}>
              cancel
            </button>
            <button className="stw-btn stw-btn-primary" onClick={save} disabled={saving}>
              {saving ? "saving…" : "save"}
            </button>
          </div>
        )}
      </div>

      {rows.length === 0 && !editing ? (
        <p className="stw-media-empty">nothing here yet.</p>
      ) : (
        <div className="stw-media-table-wrap">
          <table className="stw-media-table">
            <thead>
              <tr>
                {editing && <th className="col-drag" aria-label="drag" />}
                <th className="col-rating">rating</th>
                <th className="col-name">name</th>
                <th className="col-type">type</th>
                <th className="col-notes">notes</th>
                {editing && <th className="col-rm" aria-label="remove" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isDragging = editing && dnd.dragIdx === i;
                const isOver =
                  editing && dnd.overIdx === i && dnd.dragIdx !== null && dnd.dragIdx !== i;
                const rowProps = editing ? dnd.getRowProps(i) : {};
                return (
                <tr
                  key={row.id}
                  className={`${isDragging ? "is-dragging" : ""} ${isOver ? "is-over" : ""}`}
                  {...rowProps}
                >
                  {editing && (
                    <td className="col-drag">
                      <span
                        {...dnd.getHandleProps(i)}
                        className="stw-drag-handle"
                        aria-label="drag to reorder"
                        title="drag to reorder"
                      >
                        ⠿
                      </span>
                    </td>
                  )}
                  <td className="col-rating">
                    {editing ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.rating}
                        onChange={(e) => update(i, { rating: e.target.value })}
                        placeholder="—"
                      />
                    ) : row.rating === "" ? (
                      <span className="muted">—</span>
                    ) : (
                      row.rating
                    )}
                  </td>
                  <td className="col-name">
                    {editing ? (
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => update(i, { name: e.target.value })}
                      />
                    ) : (
                      row.name
                    )}
                  </td>
                  <td className="col-type">
                    {editing ? (
                      <input
                        type="text"
                        value={row.type}
                        onChange={(e) => update(i, { type: e.target.value })}
                        placeholder="movie / show / …"
                      />
                    ) : row.type === "" ? (
                      <span className="muted">—</span>
                    ) : (
                      row.type
                    )}
                  </td>
                  <td className="col-notes">
                    {editing ? (
                      <input
                        type="text"
                        value={row.notes}
                        onChange={(e) => update(i, { notes: e.target.value })}
                      />
                    ) : row.notes === "" ? (
                      <span className="muted">—</span>
                    ) : (
                      row.notes
                    )}
                  </td>
                  {editing && (
                    <td className="col-rm">
                      <button onClick={() => requestRemoveRow(i)} aria-label="remove">✕</button>
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin && editing && (
        <button className="stw-btn stw-btn-secondary stw-media-addbtn" onClick={addRow}>
          + add row
        </button>
      )}
      {error && <p className="stw-edit-error">{error}</p>}
      <ConfirmDialog
        open={confirmIdx !== null}
        message="Delete this row?"
        detail={confirmIdx !== null ? drafts[confirmIdx]?.name || undefined : undefined}
        onConfirm={confirmRemoveRow}
        onCancel={() => setConfirmIdx(null)}
      />
    </section>
  );
}

/* ---------- Main content ---------------------------------------------- */
export default function SpinTheWheelContent({
  initialPartitions,
  initialMedia,
  isAdmin,
}: {
  initialPartitions: WheelPartition[];
  initialMedia: MediaEntry[];
  isAdmin: boolean;
}) {
  const [partitions, setPartitions] = useState(initialPartitions);
  const [media, setMedia] = useState(initialMedia);
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

      <MediaTable
        entries={media}
        isAdmin={isAdmin}
        onSaved={(saved) => setMedia(saved)}
      />
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
.stw-edit-row.is-dragging { opacity: 0.4; }
.stw-edit-row.is-over { box-shadow: inset 0 2px 0 0 #8b5cf6; }
.stw-drag-handle {
  flex: 0 0 18px;
  width: 18px;
  text-align: center;
  color: rgba(255, 255, 255, 0.35);
  font-size: 1rem;
  cursor: grab;
  user-select: none;
  line-height: 1;
}
.stw-drag-handle:active { cursor: grabbing; }
.stw-drag-handle:hover { color: rgba(255, 255, 255, 0.75); }
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
.stw-btn-danger {
  background: #dc2626;
  color: #fff;
}
.stw-btn-danger:hover:not(:disabled) { background: #ef4444; }
.stw-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ---- Confirm dialog ---- */
.stw-confirm {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  animation: stw-confirm-in 0.15s ease-out;
}
@keyframes stw-confirm-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.stw-confirm-card {
  max-width: 380px;
  width: 100%;
  background: #111;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1.25rem 1.25rem 1rem;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
}
.stw-confirm-msg {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #f5f5f7;
}
.stw-confirm-detail {
  margin: 0.35rem 0 0;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.55);
  font-style: italic;
}
.stw-confirm-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 1.1rem;
}
.stw-edit-error {
  color: #f87171;
  font-size: 0.8rem;
  margin: 0.6rem 0 0;
}

/* ---- Media table ---- */
.stw-media {
  max-width: 920px;
  margin: 3rem auto 0;
}
.stw-media-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.85rem;
  gap: 0.5rem;
}
.stw-media-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
}
.stw-media-actions { display: flex; gap: 0.5rem; }
.stw-media-empty {
  text-align: center;
  color: rgba(255,255,255,0.35);
  padding: 2rem 0;
  font-size: 0.9rem;
}
.stw-media-table-wrap {
  overflow-x: auto;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.02);
}
.stw-media-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.stw-media-table th {
  text-align: left;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-size: 0.7rem;
  color: rgba(255,255,255,0.45);
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.02);
}
.stw-media-table td {
  padding: 0.55rem 0.85rem;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  color: #f5f5f7;
  vertical-align: middle;
}
.stw-media-table tr:last-child td { border-bottom: none; }
.stw-media-table .muted { color: rgba(255,255,255,0.3); }
.stw-media-table .col-rating { width: 78px; font-variant-numeric: tabular-nums; }
.stw-media-table .col-name   { font-weight: 500; }
.stw-media-table .col-type   { width: 110px; color: rgba(255,255,255,0.7); }
.stw-media-table .col-notes  { color: rgba(255,255,255,0.7); }
.stw-media-table .col-rm     { width: 36px; text-align: right; }
.stw-media-table .col-drag   { width: 24px; padding: 0 0.35rem; }
.stw-media-table tr.is-dragging { opacity: 0.4; }
.stw-media-table tr.is-over td { box-shadow: inset 0 2px 0 0 #8b5cf6; }
.stw-media-table input {
  width: 100%;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: inherit;
  border-radius: 5px;
  padding: 0.35rem 0.5rem;
  font-size: 0.875rem;
  font-family: inherit;
  box-sizing: border-box;
}
.stw-media-table .col-rm button {
  background: none;
  border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.55);
  border-radius: 5px;
  padding: 0.2rem 0.45rem;
  cursor: pointer;
  font-size: 0.78rem;
}
.stw-media-table .col-rm button:hover { color: #f87171; border-color: #f87171; }
.stw-media-addbtn { margin-top: 0.75rem; }
`;
