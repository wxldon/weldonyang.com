"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface PlannedItem {
  id: number;
  date: string;
  template_tags: string[];
  sport: string | null;
  notes: string | null;
  is_fixed: boolean;
  is_rest: boolean;
  position: number;
}

interface Completion {
  activity_id: number;
  type: string;
  name: string | null;
  distance_m: number | null;
  moving_time_s: number | null;
  avg_hr: number | null;
}

interface CalendarDay {
  date: string;
  day_of_week: number;
  items: PlannedItem[];
  completions: Completion[];
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayOfWeekFromStr(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function formatDuration(seconds: number): string {
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function Calendar({ isAdmin, today }: { isAdmin: boolean; today: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [days, setDays] = useState<CalendarDay[] | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const dow = dayOfWeekFromStr(today);
  const from = addDaysStr(today, -dow);
  const to = addDaysStr(from, 13);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/calendar?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setDays(d.days);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  async function handleDrop(targetDate: string) {
    if (dragId == null || !days) return;
    const movedId = dragId;
    setDropTarget(null);
    setDragId(null);

    const previous = days;
    const sourceDay = days.find((d) => d.items.some((i) => i.id === movedId));
    const item = sourceDay?.items.find((i) => i.id === movedId);
    if (!item || sourceDay?.date === targetDate) return;

    const optimistic = days.map((d) => {
      if (d.date === sourceDay?.date) {
        return { ...d, items: d.items.filter((i) => i.id !== movedId) };
      }
      if (d.date === targetDate) {
        return { ...d, items: [...d.items, { ...item, date: targetDate }] };
      }
      return d;
    });
    setDays(optimistic);

    try {
      const res = await fetch("/api/admin/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: movedId, new_date: targetDate }),
      });
      if (!res.ok) {
        setDays(previous);
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setDays(previous);
    }
  }

  if (!days) {
    return <div style={{ opacity: 0.4, fontSize: "0.875rem", padding: "1rem 0" }}>Loading calendar…</div>;
  }

  const weeks: CalendarDay[][] = [days.slice(0, 7), days.slice(7, 14)];

  return (
    <div style={{ marginTop: "2.5rem" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <h2 style={{ fontSize: "1.125rem", opacity: 0.85 }}>Schedule</h2>
        {isAdmin && (
          <span style={{ opacity: 0.5, fontSize: "0.75rem" }}>drag to move</span>
        )}
      </div>

      <div style={{ display: "grid", gap: "0.75rem" }}>
        {weeks.map((week, wi) => (
          <div
            key={wi}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "0.5rem",
            }}
          >
            {week.map((day) => (
              <DayCell
                key={day.date}
                day={day}
                today={today}
                isToday={day.date === today}
                isAdmin={isAdmin}
                isDropTarget={dropTarget === day.date}
                onDragStart={(id) => setDragId(id)}
                onDragEnd={() => {
                  setDragId(null);
                  setDropTarget(null);
                }}
                onDragOver={(e) => {
                  if (dragId != null) {
                    e.preventDefault();
                    setDropTarget(day.date);
                  }
                }}
                onDragLeave={() => {
                  if (dropTarget === day.date) setDropTarget(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(day.date);
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayCell({
  day,
  today,
  isToday,
  isAdmin,
  isDropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  day: CalendarDay;
  today: string;
  isToday: boolean;
  isAdmin: boolean;
  isDropTarget: boolean;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const dateNum = parseInt(day.date.slice(8, 10), 10);
  const isPast = day.date < today;

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        minHeight: 96,
        padding: "0.5rem",
        background: isToday
          ? "rgba(139, 92, 246, 0.10)"
          : isDropTarget
            ? "rgba(139, 92, 246, 0.18)"
            : "rgba(255,255,255,0.025)",
        border: isToday
          ? "1px solid #8b5cf6"
          : isDropTarget
            ? "1px dashed #8b5cf6"
            : "1px solid rgba(255,255,255,0.06)",
        borderRadius: 8,
        opacity: isPast && !day.completions.length ? 0.45 : 1,
        display: "flex",
        flexDirection: "column",
        gap: "0.375rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: "0.6875rem", opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {DAY_NAMES[day.day_of_week]}
        </span>
        <span style={{ fontSize: "0.875rem", fontWeight: isToday ? 600 : 400 }}>{dateNum}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {day.items.map((item) => (
          <ItemChip key={item.id} item={item} isAdmin={isAdmin} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        ))}
      </div>

      {day.completions.map((c) => (
        <div
          key={c.activity_id}
          style={{
            fontSize: "0.6875rem",
            color: "#8b5cf6",
            background: "rgba(139, 92, 246, 0.10)",
            padding: "0.25rem 0.4375rem",
            borderRadius: 4,
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: "0.4375rem",
          }}
        >
          <span style={{ fontSize: "0.8125rem", lineHeight: 1 }}>✓</span>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, textAlign: "left" }}>
            <span>{c.distance_m ? `${(c.distance_m / 1609.344).toFixed(1)} mi` : c.type}</span>
            {c.moving_time_s ? <span style={{ opacity: 0.85 }}>{formatDuration(c.moving_time_s)}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

function ItemChip({
  item,
  isAdmin,
  onDragStart,
  onDragEnd,
}: {
  item: PlannedItem;
  isAdmin: boolean;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
}) {
  const label = item.is_rest
    ? "rest"
    : item.is_fixed
      ? item.notes || item.sport || "fixed"
      : item.template_tags.join(" / ") || item.sport || "—";

  return (
    <div
      draggable={isAdmin}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(item.id);
      }}
      onDragEnd={onDragEnd}
      style={{
        fontSize: "0.75rem",
        padding: "0.25rem 0.4375rem",
        background: item.is_fixed
          ? "rgba(255,255,255,0.06)"
          : item.is_rest
            ? "rgba(255,255,255,0.03)"
            : "rgba(139, 92, 246, 0.14)",
        borderRadius: 4,
        cursor: isAdmin ? "grab" : "default",
        userSelect: "none",
        opacity: item.is_rest ? 0.6 : 1,
      }}
    >
      {label}
    </div>
  );
}
