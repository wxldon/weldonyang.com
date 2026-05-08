"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Camera } from "@/lib/cameras";
import type { WindStation, WindSpot, SpotHour } from "@/lib/wind";
import { describeCode } from "@/lib/weather";
import type { BuoyCam } from "@/lib/buoy-cams";
import type { DestinationCam } from "@/lib/destination-cams";
import type { WeatherSummary } from "@/lib/weather";

const ScoutingMap = dynamic(() => import("./ScoutingMap"), { ssr: false });

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

function useEscapeAndScrollLock(onClose: () => void) {
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
}

type WeatherTarget = {
  primaryUrl: string;
  primaryLabel: string;
  fallbackUrl: string;
};

function weatherAppTarget(lat: number, lng: number, label: string): WeatherTarget {
  const search = `https://www.google.com/search?q=${encodeURIComponent(
    `weather ${label} ${lat.toFixed(3)},${lng.toFixed(3)}`,
  )}`;
  if (typeof navigator === "undefined") {
    return { primaryUrl: search, primaryLabel: "Open in Google Weather", fallbackUrl: search };
  }
  const ua = navigator.userAgent;
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isMac = /Macintosh/.test(ua) && !isAppleMobile;
  const isAndroid = /Android/.test(ua);
  const isWindows = /Windows NT/.test(ua);

  if (isAppleMobile || isMac) {
    return {
      primaryUrl: "weather://",
      primaryLabel: "Open in Apple Weather",
      fallbackUrl: search,
    };
  }
  if (isWindows) {
    return {
      primaryUrl: "bingweather:",
      primaryLabel: "Open in MSN Weather",
      fallbackUrl: search,
    };
  }
  if (isAndroid) {
    return {
      primaryUrl: search,
      primaryLabel: "Open in Google Weather",
      fallbackUrl: search,
    };
  }
  return { primaryUrl: search, primaryLabel: "Open in Google Weather", fallbackUrl: search };
}

function fmtHourLabel(iso: string, isFirst: boolean): string {
  const m = iso.match(/T(\d{2}):/);
  if (!m) return iso;
  if (isFirst) return "Now";
  let h = parseInt(m[1], 10);
  const ampm = h >= 12 ? "p" : "a";
  h = h % 12 || 12;
  return `${h}${ampm}`;
}

function HourCard({ h, isFirst }: { h: SpotHour; isFirst: boolean }) {
  const desc = describeCode(h.weatherCode, true);
  const arrowDeg = h.directionDeg + 180;
  return (
    <div className="bsr-hour-card">
      <div className="bsr-hour-time">{fmtHourLabel(h.timeIso, isFirst)}</div>
      <div className="bsr-hour-emoji" aria-hidden="true">{desc.emoji}</div>
      <div className="bsr-hour-temp">{h.tempF}°</div>
      <div className="bsr-hour-wind">
        <svg
          width="9"
          height="9"
          viewBox="0 0 10 10"
          aria-hidden="true"
          style={{ transform: `rotate(${arrowDeg}deg)` }}
        >
          <path d="M5 0 L9 8 L5 6 L1 8 Z" fill="currentColor" />
        </svg>
        <span>{h.windMph}</span>
      </div>
      {h.gustMph > h.windMph + 2 && (
        <div className="bsr-hour-gust">g{h.gustMph}</div>
      )}
      {h.precipPct >= 20 && (
        <div className="bsr-hour-precip">{h.precipPct}%</div>
      )}
    </div>
  );
}

function SpotDetail({
  spot,
  onClose,
}: {
  spot: WindSpot;
  onClose: () => void;
}) {
  useEscapeAndScrollLock(onClose);
  const target = useMemo(
    () => weatherAppTarget(spot.lat, spot.lng, spot.name),
    [spot.lat, spot.lng, spot.name],
  );

  return (
    <div className="bsr-modal" onClick={onClose}>
      <div className="bsr-modal-card bsr-modal-card--spot" onClick={(e) => e.stopPropagation()}>
        <button className="bsr-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="bsr-spot-header">
          <div>
            <h3 className="bsr-modal-title">{spot.name}</h3>
            <p className="bsr-modal-sub">
              {spot.windMph} mph
              {spot.directionLabel ? ` from ${spot.directionLabel}` : ""}
              {spot.gustMph ? ` · gusts ${spot.gustMph}` : ""}
              {spot.tempF != null ? ` · ${spot.tempF}°F` : ""}
            </p>
            <p className="bsr-modal-ts bsr-spot-caveat">
              Open-Meteo gridded forecast · no anemometer at this spot
            </p>
          </div>
          <a
            className="bsr-spot-app-btn"
            href={target.primaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (target.primaryUrl === target.fallbackUrl) return;
              const fallback = target.fallbackUrl;
              setTimeout(() => {
                if (!document.hidden) window.open(fallback, "_blank", "noopener");
              }, 800);
              e.stopPropagation();
            }}
          >
            {target.primaryLabel} →
          </a>
        </div>

        <div className="bsr-hours-strip" role="list">
          {spot.forecast24h.map((h, i) => (
            <HourCard key={h.timeIso} h={h} isFirst={i === 0} />
          ))}
        </div>

        <p className="bsr-spot-tip">Scroll the strip for the next 24 hours →</p>
      </div>
    </div>
  );
}

function BuoyDetail({
  buoy,
  bust,
  onClose,
}: {
  buoy: BuoyCam;
  bust: number;
  onClose: () => void;
}) {
  useEscapeAndScrollLock(onClose);
  return (
    <div className="bsr-modal" onClick={onClose}>
      <div className="bsr-modal-card bsr-modal-card--wide" onClick={(e) => e.stopPropagation()}>
        <button className="bsr-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="bsr-buoy-strip">
          <img
            className="bsr-buoy-img"
            src={`${buoy.imageUrl}&ts=${bust}`}
            alt={`${buoy.shortName} buoy panorama`}
          />
        </div>
        <div className="bsr-modal-info">
          <h3 className="bsr-modal-title">{buoy.shortName}</h3>
          <p className="bsr-modal-sub">
            NDBC station {buoy.id} · {buoy.distanceMi.toFixed(0)} mi from SF
          </p>
          <p className="bsr-modal-ts">360° panorama · refreshes ~hourly</p>
          <a
            className="bsr-modal-link"
            href={buoy.stationUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open station data on ndbc.noaa.gov →
          </a>
        </div>
      </div>
    </div>
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
  useEscapeAndScrollLock(onClose);

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
  cameras: initialCameras,
  winds,
  spotWinds,
  buoys,
  destinations,
  weather,
  center,
  serverNowMs,
}: {
  cameras: Camera[];
  winds: WindStation[];
  spotWinds: WindSpot[];
  buoys: BuoyCam[];
  destinations: DestinationCam[];
  weather: WeatherSummary | null;
  center: { lat: number; lng: number; radiusMi: number };
  serverNowMs: number;
}) {
  // Seed from the server timestamp so SSR + first-client render match
  // exactly. The mount effect below replaces these with the live clock.
  const [cameras, setCameras] = useState(initialCameras);
  const [now, setNow] = useState(serverNowMs);
  const [bust, setBust] = useState(Math.floor(serverNowMs / 1000));
  const [selected, setSelected] = useState<Camera | null>(null);
  const [selectedBuoy, setSelectedBuoy] = useState<BuoyCam | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<WindSpot | null>(null);
  const [query, setQuery] = useState("");
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    let aborted = false;
    const tick = async () => {
      setNow(Date.now());
      setBust(Math.floor(Date.now() / 1000));
      try {
        const r = await fetch("/api/cameras", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { cameras: Camera[] };
        if (!aborted && Array.isArray(j.cameras)) setCameras(j.cameras);
      } catch {
        /* network blip — keep prior list */
      }
    };
    // Fire once on mount so the SSR-frozen `now` jumps to live time
    // (and we re-fetch any cameras that updated since the page was rendered).
    tick();
    tickRef.current = window.setInterval(tick, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      aborted = true;
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
        (c) => c.lastFrameTs && now / 1000 - c.lastFrameTs < 180,
      ).length,
    [cameras, now],
  );

  const windSummary = useMemo(() => {
    if (winds.length === 0) return null;
    const speeds = winds.map((w) => w.windMph);
    const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const peak = winds.reduce((m, w) => (w.windMph > m.windMph ? w : m), winds[0]);
    return { avg, peak };
  }, [winds]);

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
            Francisco. {freshCount} updated in the last 3 minutes.
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

        {weather && (
          <section className="bsr-weather-wrap">
            <div className="bsr-weather-card">
              <div className="bsr-weather-now">
                <span className="bsr-weather-emoji" aria-hidden="true">{weather.emoji}</span>
                <div className="bsr-weather-now-text">
                  <div className="bsr-weather-temp">
                    {weather.tempF}°<span className="bsr-weather-feels"> · feels {weather.feelsLikeF}°</span>
                  </div>
                  <div className="bsr-weather-cond">{weather.conditions} in San Francisco</div>
                </div>
              </div>

              <div className="bsr-weather-stats">
                <div className="bsr-weather-stat">
                  <span className="bsr-weather-stat-label">High / Low</span>
                  <span className="bsr-weather-stat-value">
                    {weather.todayHighF}° / {weather.todayLowF}°
                  </span>
                </div>
                <div className="bsr-weather-stat">
                  <span className="bsr-weather-stat-label">Wind</span>
                  <span className="bsr-weather-stat-value">
                    {weather.windMph} mph
                    {weather.gustMph > weather.windMph + 2
                      ? <span className="bsr-weather-gust"> · gusts {weather.gustMph}</span>
                      : null}
                  </span>
                </div>
                <div className="bsr-weather-stat">
                  <span className="bsr-weather-stat-label">Today rainfall</span>
                  <span className="bsr-weather-stat-value">
                    {weather.todayPrecipIn > 0 ? `${weather.todayPrecipIn.toFixed(2)}″` : "none"}
                  </span>
                </div>
                <div className="bsr-weather-stat">
                  <span className="bsr-weather-stat-label">UV peak</span>
                  <span className="bsr-weather-stat-value">{weather.uvMax.toFixed(0)}</span>
                </div>
                {weather.air && (
                  <div className="bsr-weather-stat">
                    <span className="bsr-weather-stat-label">AQI</span>
                    <span className="bsr-weather-stat-value">
                      <span
                        className="bsr-aqi-badge"
                        style={{
                          background: weather.air.color,
                          boxShadow: `0 0 0 1.5px ${weather.air.color}40`,
                        }}
                        aria-hidden="true"
                      />
                      {weather.air.usAqi}
                      <span className="bsr-aqi-cat"> {weather.air.category}</span>
                    </span>
                  </div>
                )}
              </div>

              {weather.events.length > 0 && (
                <ul className="bsr-weather-events">
                  {weather.events.slice(0, 4).map((ev) => (
                    <li key={ev.kind + ev.whenIso} className={`bsr-weather-event bsr-event-${ev.kind}`}>
                      <span className="bsr-event-bullet" aria-hidden="true" />
                      {ev.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        <section className="bsr-map-wrap">
          <div className="bsr-map-header">
            <div className="bsr-legend">
              <span className="bsr-legend-item">
                <span className="bsr-legend-dot bsr-legend-cam" /> {cameras.length} cameras
              </span>
              <span className="bsr-legend-item">
                <span className="bsr-legend-dot bsr-legend-wind" /> {winds.length} wind stations
              </span>
              {spotWinds.length > 0 && (
                <span className="bsr-legend-item">
                  <span className="bsr-legend-dot bsr-legend-spot" /> {spotWinds.length} spot forecasts
                </span>
              )}
              {buoys.length > 0 && (
                <span className="bsr-legend-item">
                  <span className="bsr-legend-dot bsr-legend-buoy" /> {buoys.length} ocean buoys
                </span>
              )}
              {windSummary && (
                <span className="bsr-legend-item bsr-legend-stat">
                  avg {windSummary.avg.toFixed(0)} mph · peak {windSummary.peak.windMph} mph at{" "}
                  {windSummary.peak.name.toLowerCase()}
                </span>
              )}
            </div>
            <div className="bsr-wind-legend">
              <span><span className="bsr-wind-swatch" style={{ background: "#22c55e" }} /> &lt;6</span>
              <span><span className="bsr-wind-swatch" style={{ background: "#facc15" }} /> 6–13</span>
              <span><span className="bsr-wind-swatch" style={{ background: "#f97316" }} /> 14–21</span>
              <span><span className="bsr-wind-swatch" style={{ background: "#ef4444" }} /> 22+</span>
              <span className="bsr-wind-legend-note">mph</span>
            </div>
          </div>
          <ScoutingMap
            cameras={cameras}
            winds={winds}
            spotWinds={spotWinds}
            buoys={buoys}
            onSelectCamera={setSelected}
            onSelectBuoy={setSelectedBuoy}
            onSelectSpot={setSelectedSpot}
          />
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

        {destinations.length > 0 && (
          <section className="bsr-dest-wrap">
            <div className="bsr-dest-header">
              <h2 className="bsr-dest-title">Destination cams</h2>
              <p className="bsr-dest-sub">
                Outside the 75-mile radius — National Park webcams for trip planning.
              </p>
            </div>
            <div className="bsr-dest-grid">
              {destinations.map((d) => (
                <a
                  key={d.id}
                  href={d.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bsr-dest-tile"
                >
                  <div className="bsr-dest-img-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="bsr-dest-img"
                      src={`${d.imageUrl}?ts=${bust}`}
                      alt={`${d.park} — ${d.name}`}
                      loading="lazy"
                    />
                  </div>
                  <div className="bsr-dest-meta">
                    <span className="bsr-dest-park">{d.park}</span>
                    <span className="bsr-dest-name">{d.name}</span>
                    <span className="bsr-dest-refresh">{d.refreshNote}</span>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

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
            {" · "}wind via{" "}
            <a
              href="https://mesonet.agron.iastate.edu/"
              target="_blank"
              rel="noopener noreferrer"
              className="bsr-credit-link"
            >
              Iowa State Mesonet
            </a>
            {" · "}weather + AQI via{" "}
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="bsr-credit-link"
            >
              Open-Meteo
            </a>
            {buoys.length > 0 && (
              <>
                {" · "}buoy panoramas via{" "}
                <a
                  href="https://www.ndbc.noaa.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bsr-credit-link"
                >
                  NOAA NDBC
                </a>
              </>
            )}
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
        {selectedBuoy && (
          <BuoyDetail
            buoy={selectedBuoy}
            bust={bust}
            onClose={() => setSelectedBuoy(null)}
          />
        )}
        {selectedSpot && (
          <SpotDetail
            spot={selectedSpot}
            onClose={() => setSelectedSpot(null)}
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
  z-index: 9999;
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
.bsr-modal-card--wide { max-width: min(1400px, 96vw); }
.bsr-modal-card--spot { max-width: min(960px, 95vw); }

/* ---- Spot detail modal ---- */
.bsr-spot-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.5rem 1rem;
}
.bsr-spot-header > div { min-width: 0; flex: 1; }
.bsr-spot-caveat {
  color: rgba(250, 204, 21, 0.7);
  letter-spacing: 0.02em;
  text-transform: none;
}
.bsr-spot-app-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  padding: 0.55rem 0.9rem;
  border-radius: 999px;
  background: rgba(196,181,253,0.12);
  border: 1px solid rgba(196,181,253,0.35);
  color: #ddd6fe;
  font-size: 0.82rem;
  font-weight: 500;
  text-decoration: none;
  letter-spacing: 0.01em;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.bsr-spot-app-btn:hover {
  background: rgba(196,181,253,0.2);
  border-color: rgba(196,181,253,0.6);
  color: #fff;
}

.bsr-hours-strip {
  display: flex;
  gap: 0.45rem;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.5rem 1.5rem 1.25rem;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
}
.bsr-hours-strip::-webkit-scrollbar { height: 6px; }
.bsr-hours-strip::-webkit-scrollbar-track { background: transparent; }
.bsr-hours-strip::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.15);
  border-radius: 999px;
}
.bsr-hour-card {
  flex: 0 0 auto;
  width: 64px;
  scroll-snap-align: start;
  padding: 0.6rem 0.4rem 0.55rem;
  border-radius: 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  font-variant-numeric: tabular-nums;
}
.bsr-hour-time {
  font-size: 0.7rem;
  color: rgba(255,255,255,0.55);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.bsr-hour-emoji { font-size: 1.4rem; line-height: 1; margin: 0.1rem 0; }
.bsr-hour-temp {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
}
.bsr-hour-wind {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  color: rgba(255,255,255,0.75);
  font-size: 0.78rem;
}
.bsr-hour-wind svg { color: #c4b5fd; }
.bsr-hour-gust {
  font-size: 0.68rem;
  color: #fb923c;
  letter-spacing: 0.02em;
}
.bsr-hour-precip {
  font-size: 0.68rem;
  color: #60a5fa;
}
.bsr-spot-tip {
  margin: 0;
  padding: 0 1.5rem 1.1rem;
  font-size: 0.7rem;
  color: rgba(255,255,255,0.3);
  letter-spacing: 0.04em;
  text-align: right;
}

@media (max-width: 600px) {
  .bsr-spot-header {
    flex-direction: column;
    align-items: stretch;
  }
  .bsr-spot-app-btn { align-self: flex-start; }
  .bsr-hour-card { width: 58px; }
}
.bsr-buoy-strip {
  width: 100%;
  background: #000;
  overflow-x: auto;
  overflow-y: hidden;
}
.bsr-buoy-img {
  display: block;
  height: 220px;
  width: auto;
  max-width: none;
  image-rendering: auto;
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

/* ---- Destination cams ---- */
.bsr-dest-wrap {
  max-width: 1280px;
  margin: 2.5rem auto 0;
  padding: 0 1.25rem 0;
}
.bsr-dest-header {
  margin-bottom: 1rem;
}
.bsr-dest-title {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0 0 0.25rem;
  color: #fff;
}
.bsr-dest-sub {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(255,255,255,0.5);
}
.bsr-dest-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.85rem;
}
.bsr-dest-tile {
  display: flex;
  flex-direction: column;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 14px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s ease, border-color 0.2s, background 0.2s;
}
.bsr-dest-tile:hover {
  transform: translateY(-2px);
  border-color: rgba(96,165,250,0.45);
  background: rgba(255,255,255,0.06);
}
.bsr-dest-img-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #111;
  overflow: hidden;
}
.bsr-dest-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.bsr-dest-meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.65rem 0.85rem 0.85rem;
}
.bsr-dest-park {
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
}
.bsr-dest-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
}
.bsr-dest-refresh {
  font-size: 0.72rem;
  color: rgba(255,255,255,0.4);
  margin-top: 0.15rem;
}

@media (max-width: 600px) {
  .bsr-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.6rem; }
  .bsr-tile-meta { padding: 0.55rem 0.65rem 0.7rem; }
  .bsr-tile-name { font-size: 0.85rem; }
  .bsr-hero { padding: 3rem 1rem 1.5rem; }
  .bsr-map { height: 380px; }
  .bsr-buoy-img { height: 160px; }
  .bsr-dest-grid { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.6rem; }
}

/* ---- Weather ---- */
.bsr-weather-wrap {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0.5rem 1.25rem 1rem;
}
.bsr-weather-card {
  display: grid;
  grid-template-columns: minmax(220px, 1.1fr) 1.4fr auto;
  gap: 1.5rem;
  align-items: center;
  padding: 1rem 1.4rem;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(139,92,246,0.08), rgba(255,255,255,0.04));
  border: 1px solid rgba(255,255,255,0.08);
}
.bsr-weather-now {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}
.bsr-weather-emoji {
  font-size: 2.4rem;
  line-height: 1;
}
.bsr-weather-temp {
  font-size: 1.8rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
}
.bsr-weather-feels {
  font-size: 0.78rem;
  font-weight: 400;
  color: rgba(255,255,255,0.45);
  letter-spacing: 0.02em;
}
.bsr-weather-cond {
  margin-top: 0.25rem;
  font-size: 0.85rem;
  color: rgba(255,255,255,0.6);
}
.bsr-weather-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.9rem;
}
.bsr-weather-stat {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}
.bsr-weather-stat-label {
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
}
.bsr-weather-stat-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
  font-variant-numeric: tabular-nums;
}
.bsr-weather-gust {
  font-size: 0.78rem;
  font-weight: 400;
  color: rgba(255,255,255,0.5);
}
.bsr-aqi-badge {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  margin-right: 0.4rem;
  vertical-align: middle;
}
.bsr-aqi-cat {
  font-size: 0.72rem;
  font-weight: 400;
  color: rgba(255,255,255,0.55);
  margin-left: 0.35rem;
  letter-spacing: 0.01em;
}
.bsr-weather-events {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 200px;
  border-left: 1px solid rgba(255,255,255,0.1);
  padding-left: 1.1rem;
}
.bsr-weather-event {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.7);
  letter-spacing: 0.01em;
}
.bsr-event-bullet {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255,255,255,0.5);
  flex: 0 0 auto;
}
.bsr-event-rain-start .bsr-event-bullet { background: #60a5fa; }
.bsr-event-rain-stop  .bsr-event-bullet { background: #22c55e; }
.bsr-event-sunrise    .bsr-event-bullet { background: #fbbf24; }
.bsr-event-sunset     .bsr-event-bullet { background: #f97316; }

@media (max-width: 900px) {
  .bsr-weather-card {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  .bsr-weather-events {
    border-left: none;
    border-top: 1px solid rgba(255,255,255,0.08);
    padding-left: 0;
    padding-top: 0.85rem;
  }
}
@media (max-width: 600px) {
  .bsr-weather-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* ---- Map ---- */
.bsr-map-wrap {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.25rem 1.5rem;
}
.bsr-map-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.25rem 0.75rem;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.55);
  letter-spacing: 0.02em;
}
.bsr-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem 1.1rem;
  align-items: center;
}
.bsr-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.bsr-legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  display: inline-block;
}
.bsr-legend-cam { background: #c4b5fd; box-shadow: 0 0 0 1.5px rgba(255,255,255,0.4); }
.bsr-legend-buoy { background: #38bdf8; box-shadow: 0 0 0 1.5px rgba(255,255,255,0.4); }
.bsr-legend-spot {
  background: transparent;
  border: 1.5px dashed #facc15;
  box-shadow: none;
  width: 10px;
  height: 10px;
}
.bsr-legend-wind {
  background: linear-gradient(90deg, #22c55e, #facc15, #f97316, #ef4444);
}
.bsr-legend-stat {
  color: rgba(255,255,255,0.4);
  text-transform: capitalize;
}
.bsr-wind-legend {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.72rem;
  color: rgba(255,255,255,0.5);
}
.bsr-wind-legend span { display: inline-flex; align-items: center; gap: 0.3rem; }
.bsr-wind-swatch {
  width: 10px; height: 10px; border-radius: 3px;
  display: inline-block;
}
.bsr-wind-legend-note { color: rgba(255,255,255,0.35); margin-left: 0.1rem; }

.bsr-map {
  width: 100%;
  height: 520px;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.08);
  background: #0d0d0d;
}

/* Leaflet UI tweaks for the dark theme */
.bsr-map .leaflet-container {
  background: #0a0a0a;
  font-family: inherit;
}
.bsr-map .leaflet-control-attribution {
  background: rgba(0,0,0,0.55);
  color: rgba(255,255,255,0.55);
  font-size: 0.65rem;
}
.bsr-map .leaflet-control-attribution a {
  color: rgba(255,255,255,0.75);
}
.bsr-map .leaflet-control-zoom a {
  background: rgba(0,0,0,0.7);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.15);
}
.bsr-map .leaflet-control-zoom a:hover {
  background: rgba(0,0,0,0.9);
  color: #fff;
}
.bsr-map .leaflet-popup-content-wrapper,
.bsr-map .leaflet-popup-tip {
  background: #111;
  color: #f5f5f7;
  border: 1px solid rgba(255,255,255,0.1);
}
.bsr-map .leaflet-popup-content {
  font-size: 0.78rem;
  line-height: 1.4;
  margin: 0.6rem 0.8rem;
}
.bsr-map .leaflet-popup-close-button {
  color: rgba(255,255,255,0.5);
}

/* Camera marker (small purple dot) */
.bsr-cam-icon { background: transparent !important; border: none !important; }
.bsr-cam-pin {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #c4b5fd;
  border: 1.5px solid rgba(0,0,0,0.85);
  box-shadow: 0 0 0 1.5px rgba(196,181,253,0.4), 0 0 6px rgba(139,92,246,0.5);
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.bsr-cam-pin:hover {
  transform: scale(1.4);
  box-shadow: 0 0 0 2px rgba(196,181,253,0.6), 0 0 12px rgba(139,92,246,0.85);
}

/* Buoy marker (cyan wave glyph) */
.bsr-buoy-icon { background: transparent !important; border: none !important; }
.bsr-buoy-pin {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: linear-gradient(135deg, #0ea5e9, #0369a1);
  border: 1.5px solid rgba(255,255,255,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 0 0 1.5px rgba(14,165,233,0.35), 0 1px 4px rgba(0,0,0,0.5);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.bsr-buoy-pin:hover {
  transform: scale(1.2);
  box-shadow: 0 0 0 2px rgba(14,165,233,0.55), 0 0 12px rgba(14,165,233,0.7);
}

/* Wind marker (pill with arrow + mph) */
.bsr-wind-icon { background: transparent !important; border: none !important; }
.bsr-wind-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 2px 6px 2px 5px;
  border-radius: 999px;
  background: rgba(0,0,0,0.85);
  color: var(--wind-color, #fff);
  border: 1px solid var(--wind-color, rgba(255,255,255,0.4));
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
  line-height: 1;
  pointer-events: auto;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.6);
}
.bsr-wind-pill:hover { filter: brightness(1.25); }

/* Spot-forecast pill — distinguished by a dashed border + named label */
.bsr-spot-icon { background: transparent !important; border: none !important; }
.bsr-wind-pill--spot {
  border-style: dashed;
  border-color: var(--wind-color, #facc15);
  background: rgba(0,0,0,0.92);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.6);
}
.bsr-wind-arrow {
  flex: 0 0 auto;
  display: block;
  transform-origin: 50% 50%;
}
.bsr-wind-mph {
  color: #fff;
  font-variant-numeric: tabular-nums;
}
.bsr-wind-calm {
  display: inline-block;
  width: 10px;
  text-align: center;
  color: var(--wind-color);
  font-weight: 700;
}
`;
