"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Camera } from "@/lib/cameras";

const REFRESH_MS = 30_000;

function relativeTime(unixSec: number | null, now: number): string {
  if (!unixSec) return "—";
  const diff = Math.max(0, Math.floor(now / 1000 - unixSec));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function freshnessClass(unixSec: number | null, now: number): string {
  if (!unixSec) return "stale";
  const diff = now / 1000 - unixSec;
  if (diff < 120) return "fresh";
  if (diff < 600) return "warm";
  return "stale";
}

function compass(deg: number | null): string {
  if (deg == null) return "";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

function CameraTile({
  camera,
  bust,
  now,
  onSelect,
}: {
  camera: Camera;
  bust: number;
  now: number;
  onSelect: (c: Camera) => void;
}) {
  const fresh = freshnessClass(camera.lastFrameTs, now);
  const dir = compass(camera.azimuthDeg);

  return (
    <button
      type="button"
      className="bsr-tile"
      onClick={() => onSelect(camera)}
      aria-label={`${camera.name}, ${camera.distanceMi.toFixed(0)} miles away`}
    >
      <div className="bsr-tile-img-wrap">
        <img
          className="bsr-tile-img"
          src={`${camera.thumbUrl}?rqts=${bust}`}
          alt=""
          loading="lazy"
          decoding="async"
        />
        <div className={`bsr-fresh-dot bsr-fresh-${fresh}`} aria-hidden="true" />
      </div>
      <div className="bsr-tile-meta">
        <span className="bsr-tile-name">{camera.name}</span>
        <span className="bsr-tile-sub">
          {camera.distanceMi.toFixed(0)} mi
          {camera.county ? ` · ${camera.county}` : ""}
          {dir ? ` · ${dir}` : ""}
        </span>
        <span className="bsr-tile-ts">{relativeTime(camera.lastFrameTs, now)}</span>
      </div>
    </button>
  );
}

function CameraDetail({
  camera,
  bust,
  now,
  onClose,
}: {
  camera: Camera;
  bust: number;
  now: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="bsr-modal" onClick={onClose}>
      <div className="bsr-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="bsr-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <img
          className="bsr-modal-img"
          src={`${camera.frameUrl}?rqts=${bust}`}
          alt={camera.name}
        />
        <div className="bsr-modal-info">
          <h3 className="bsr-modal-title">{camera.name}</h3>
          <p className="bsr-modal-sub">
            {camera.county || "—"} · {camera.distanceMi.toFixed(1)} mi from SF ·{" "}
            {camera.elevationFt ? `${camera.elevationFt.toLocaleString()} ft` : "—"} ·{" "}
            facing {compass(camera.azimuthDeg) || "—"}
          </p>
          <p className="bsr-modal-ts">
            Last frame {relativeTime(camera.lastFrameTs, now)}
          </p>
          <a
            className="bsr-modal-link"
            href={camera.viewerUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open pan-tilt-zoom view on alertcalifornia.org →
          </a>
        </div>
      </div>
    </div>
  );
}

export default function BikingScoutingContent({
  cameras,
  center,
}: {
  cameras: Camera[];
  center: { lat: number; lng: number; radiusMi: number };
}) {
  const [now, setNow] = useState(() => Date.now());
  const [bust, setBust] = useState(() => Math.floor(Date.now() / 1000));
  const [selected, setSelected] = useState<Camera | null>(null);
  const [query, setQuery] = useState("");
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      setBust(Math.floor(Date.now() / 1000));
    };
    tickRef.current = window.setInterval(tick, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cameras;
    return cameras.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.county.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
  }, [cameras, query]);

  const freshCount = useMemo(
    () =>
      cameras.filter(
        (c) => c.lastFrameTs && now / 1000 - c.lastFrameTs < 120,
      ).length,
    [cameras, now],
  );

  return (
    <>
      <style>{styles}</style>
      <main className="bsr-page">
        <nav className="bsr-nav">
          <Link href="/" className="bsr-back">
            ← Back
          </Link>
          <span className="bsr-nav-status">
            <span className="bsr-fresh-dot bsr-fresh-fresh bsr-pulse" /> live ·{" "}
            refreshes every 30s
          </span>
        </nav>

        <section className="bsr-hero">
          <p className="bsr-eyebrow">Biking Scouting Report</p>
          <h1 className="bsr-title">
            Is it<br />ridable out there?
          </h1>
          <p className="bsr-subtitle">
            {cameras.length} fire-watch towers within {center.radiusMi} miles of San
            Francisco. {freshCount} reporting in the last 2 minutes.
            <br />
            Look for smoke, fog, or socked-in ridges before you clip in.
          </p>

          <div className="bsr-search-wrap">
            <input
              type="search"
              placeholder="Filter by name, county, or ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bsr-search"
            />
          </div>
        </section>

        <section className="bsr-grid-wrap">
          {filtered.length === 0 ? (
            <p className="bsr-empty">No cameras match {`"${query}"`}.</p>
          ) : (
            <div className="bsr-grid">
              {filtered.map((c) => (
                <CameraTile
                  key={`${c.id}-${c.name}`}
                  camera={c}
                  bust={bust}
                  now={now}
                  onSelect={setSelected}
                />
              ))}
            </div>
          )}
        </section>

        <footer className="bsr-footer">
          <p>
            Imagery courtesy of{" "}
            <a
              href="https://alertcalifornia.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="bsr-credit-link"
            >
              ALERTCalifornia
            </a>
            {" "}/ UC San Diego ·{" "}
            <a
              href="https://alertcalifornia.org/terms-of-use/"
              target="_blank"
              rel="noopener noreferrer"
              className="bsr-credit-link"
            >
              Terms
            </a>
          </p>
        </footer>

        {selected && (
          <CameraDetail
            camera={selected}
            bust={bust}
            now={now}
            onClose={() => setSelected(null)}
          />
        )}
      </main>
    </>
  );
}

const styles = `
.bsr-page {
  background: #000;
  color: #f5f5f7;
  min-height: 100vh;
  font-family: var(--font-sans), -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  padding-bottom: 4rem;
}

.bsr-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.75rem;
  background: rgba(0,0,0,0.72);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.bsr-back {
  color: rgba(255,255,255,0.7);
  text-decoration: none;
  font-size: 0.875rem;
  letter-spacing: 0.02em;
}
.bsr-back:hover { color: #fff; }
.bsr-nav-status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  color: rgba(255,255,255,0.45);
  text-transform: uppercase;
}

.bsr-hero {
  text-align: center;
  padding: 4rem 1.5rem 2rem;
  max-width: 760px;
  margin: 0 auto;
}
.bsr-eyebrow {
  font-size: 0.8125rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.42);
  margin: 0 0 1rem;
}
.bsr-title {
  font-size: clamp(2.5rem, 8vw, 5.5rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.05;
  margin: 0 0 1.25rem;
  background: linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.55) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.bsr-subtitle {
  font-size: clamp(1rem, 2vw, 1.25rem);
  color: rgba(255,255,255,0.55);
  line-height: 1.55;
  margin: 0 auto 2rem;
  max-width: 540px;
}

.bsr-search-wrap {
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
}
.bsr-search {
  width: 100%;
  max-width: 360px;
  padding: 0.7rem 1rem;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04);
  color: #fff;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
}
.bsr-search:focus {
  border-color: rgba(139,92,246,0.55);
  background: rgba(255,255,255,0.07);
}
.bsr-search::placeholder { color: rgba(255,255,255,0.35); }

.bsr-grid-wrap {
  max-width: 1280px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 0;
}
.bsr-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.9rem;
}

.bsr-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: inherit;
  padding: 0;
  transition: transform 0.2s ease, border-color 0.2s, background 0.2s;
}
.bsr-tile:hover {
  transform: translateY(-2px);
  border-color: rgba(139,92,246,0.45);
  background: rgba(255,255,255,0.06);
}
.bsr-tile:focus-visible {
  outline: 2px solid #8b5cf6;
  outline-offset: 2px;
}

.bsr-tile-img-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #111;
  overflow: hidden;
}
.bsr-tile-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: opacity 0.2s;
}

.bsr-fresh-dot {
  position: absolute;
  top: 0.55rem;
  right: 0.55rem;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  box-shadow: 0 0 0 2px rgba(0,0,0,0.55);
}
.bsr-fresh-fresh { background: #22c55e; }
.bsr-fresh-warm  { background: #f59e0b; }
.bsr-fresh-stale { background: #6b7280; }
.bsr-pulse {
  position: relative;
  box-shadow: 0 0 0 0 rgba(34,197,94,0.65);
  animation: bsr-pulse 1.8s infinite;
}
@keyframes bsr-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.55); }
  70%  { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
  100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
}

.bsr-tile-meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.65rem 0.8rem 0.8rem;
}
.bsr-tile-name {
  font-size: 0.92rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bsr-tile-sub {
  font-size: 0.72rem;
  color: rgba(255,255,255,0.5);
  letter-spacing: 0.02em;
  text-transform: capitalize;
}
.bsr-tile-ts {
  font-size: 0.7rem;
  color: rgba(255,255,255,0.35);
  letter-spacing: 0.04em;
  margin-top: 0.1rem;
}

.bsr-empty {
  text-align: center;
  color: rgba(255,255,255,0.45);
  padding: 3rem 1rem;
  font-size: 0.95rem;
}

.bsr-footer {
  text-align: center;
  margin-top: 3rem;
  padding: 1.5rem 1rem;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.35);
  border-top: 1px solid rgba(255,255,255,0.05);
}
.bsr-credit-link {
  color: rgba(255,255,255,0.55);
  text-decoration: none;
  border-bottom: 1px solid rgba(255,255,255,0.2);
}
.bsr-credit-link:hover { color: #fff; border-color: #fff; }

/* ---- Modal ---- */
.bsr-modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0,0,0,0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  animation: bsr-fade 0.18s ease-out;
}
@keyframes bsr-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.bsr-modal-card {
  position: relative;
  max-width: 1100px;
  width: 100%;
  background: #0d0d0d;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 18px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.bsr-modal-img {
  width: 100%;
  height: auto;
  max-height: 75vh;
  object-fit: contain;
  background: #000;
  display: block;
}
.bsr-modal-info {
  padding: 1.25rem 1.5rem 1.5rem;
}
.bsr-modal-title {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0 0 0.35rem;
}
.bsr-modal-sub {
  margin: 0 0 0.4rem;
  font-size: 0.85rem;
  color: rgba(255,255,255,0.55);
  text-transform: capitalize;
}
.bsr-modal-ts {
  margin: 0 0 0.9rem;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.35);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.bsr-modal-link {
  display: inline-block;
  font-size: 0.9rem;
  color: #c4b5fd;
  text-decoration: none;
  border-bottom: 1px solid rgba(196,181,253,0.4);
}
.bsr-modal-link:hover { color: #ddd6fe; border-color: #ddd6fe; }

.bsr-modal-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 1;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(0,0,0,0.55);
  color: #fff;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, border-color 0.2s;
}
.bsr-modal-close:hover {
  background: rgba(0,0,0,0.85);
  border-color: rgba(255,255,255,0.4);
}

@media (max-width: 600px) {
  .bsr-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.6rem; }
  .bsr-tile-meta { padding: 0.55rem 0.65rem 0.7rem; }
  .bsr-tile-name { font-size: 0.85rem; }
  .bsr-hero { padding: 3rem 1rem 1.5rem; }
}
`;
