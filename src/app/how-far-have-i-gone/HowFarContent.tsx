"use client";

import { useRef, useEffect, useState, type ReactNode } from "react";
import { StravaStats } from "@/lib/strava";
import Link from "next/link";
import RouteMap from "@/components/maps/RouteMap";
import BayMap from "@/components/maps/BayMap";
import { RUN_ROUTE_SF_BOSTON, BIKE_ROUTE_SF_BOSTON } from "@/lib/routes";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toMiles(meters: number) {
  return (meters / 1000) * 0.621371;
}

function formatDistance(meters: number): string {
  const miles = toMiles(meters);
  if (miles >= 1000) return `${(miles / 1000).toFixed(1)}k`;
  return miles.toFixed(1);
}

function formatTime(seconds: number): { value: string; unit: string } {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return { value: `${hours}h ${minutes}m`, unit: "" };
  return { value: `${minutes}`, unit: "min" };
}

function formatElevation(meters: number): string {
  const feet = meters * 3.28084;
  return Math.round(feet).toLocaleString();
}

/* ------------------------------------------------------------------ */
/*  Scroll-triggered animation hook                                    */
/* ------------------------------------------------------------------ */

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

/* ------------------------------------------------------------------ */
/*  Animated Counter                                                   */
/* ------------------------------------------------------------------ */

function AnimatedNumber({
  value,
  duration = 2000,
  visible,
}: {
  value: number;
  duration?: number;
  visible: boolean;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [visible, value, duration]);

  return <>{display.toLocaleString()}</>;
}

/* ------------------------------------------------------------------ */
/*  Reusable section wrapper with scroll reveal                        */
/* ------------------------------------------------------------------ */

function RevealSection({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useInView(0.12);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(60px)",
        transition: `opacity 1s cubic-bezier(0.25,0.46,0.45,0.94) ${delay}s, transform 1s cubic-bezier(0.25,0.46,0.45,0.94) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero stat – Apple-style massive number                             */
/* ------------------------------------------------------------------ */

function HeroStat({
  value,
  unit,
  label,
  delay = 0,
  gradient,
}: {
  value: number;
  unit: string;
  label: string;
  delay?: number;
  gradient: string;
}) {
  const { ref, visible } = useInView(0.2);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(40px) scale(0.96)",
        transition: `all 1.2s cubic-bezier(0.25,0.46,0.45,0.94) ${delay}s`,
        textAlign: "center",
        padding: "3rem 1rem",
      }}
    >
      <p className="hfhig-stat-number" style={{ background: gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
        <AnimatedNumber value={value} visible={visible} />
        {unit && <span className="hfhig-stat-unit">{unit}</span>}
      </p>
      <p className="hfhig-stat-label">{label}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mini stat cards – used in activity grids                           */
/* ------------------------------------------------------------------ */

function MiniStat({
  value,
  label,
  delay = 0,
}: {
  value: string;
  label: string;
  delay?: number;
}) {
  const { ref, visible } = useInView(0.15);

  return (
    <div
      ref={ref}
      className="hfhig-mini-stat"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(30px)",
        transition: `all 0.8s cubic-bezier(0.25,0.46,0.45,0.94) ${delay}s`,
      }}
    >
      <span className="hfhig-mini-value">{value}</span>
      <span className="hfhig-mini-label">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Activity type section (Running / Cycling / Swimming)               */
/* ------------------------------------------------------------------ */

function ActivityBlock({
  icon,
  title,
  totals,
  accentColor,
  delay = 0,
}: {
  icon: string;
  title: string;
  totals: {
    count: number;
    distance: number;
    moving_time: number;
    elevation_gain: number;
  };
  accentColor: string;
  delay?: number;
}) {
  if (totals.count === 0) return null;
  const time = formatTime(totals.moving_time);

  return (
    <RevealSection delay={delay}>
      <div className="hfhig-activity-block">
        <div className="hfhig-activity-header">
          <span className="hfhig-activity-icon">{icon}</span>
          <h3 className="hfhig-activity-title" style={{ color: accentColor }}>
            {title}
          </h3>
        </div>
        <div className="hfhig-mini-grid">
          <MiniStat value={totals.count.toString()} label="Activities" delay={delay + 0.05} />
          <MiniStat value={`${formatDistance(totals.distance)} mi`} label="Distance" delay={delay + 0.1} />
          <MiniStat value={`${time.value}${time.unit}`} label="Moving Time" delay={delay + 0.15} />
          <MiniStat value={`${formatElevation(totals.elevation_gain)} ft`} label="Elevation" delay={delay + 0.2} />
        </div>
      </div>
    </RevealSection>
  );
}

/* ================================================================== */
/*  Main Content Component                                             */
/* ================================================================== */

export default function HowFarContent({ stats }: { stats: StravaStats }) {
  const totalDistance =
    stats.all_run_totals.distance +
    stats.all_ride_totals.distance +
    stats.all_swim_totals.distance;
  const totalTime =
    stats.all_run_totals.moving_time +
    stats.all_ride_totals.moving_time +
    stats.all_swim_totals.moving_time;
  const totalElevation =
    stats.all_run_totals.elevation_gain +
    stats.all_ride_totals.elevation_gain +
    stats.all_swim_totals.elevation_gain;
  const totalActivities =
    stats.all_run_totals.count +
    stats.all_ride_totals.count +
    stats.all_swim_totals.count;

  const totalMiles = toMiles(totalDistance);
  const totalHours = Math.round(totalTime / 3600);
  const totalFeet = Math.round(totalElevation * 3.28084);

  return (
    <>
      <style>{styles}</style>
      <main className="hfhig-page">
        {/* ---- Back link ---- */}
        <nav className="hfhig-nav">
          <Link href="/" className="hfhig-back">
            ← Back
          </Link>
        </nav>

        {/* ============================================================ */}
        {/*  HERO                                                         */}
        {/* ============================================================ */}
        <section className="hfhig-hero">
          <RevealSection>
            <p className="hfhig-eyebrow">Powered by Strava</p>
          </RevealSection>
          <RevealSection delay={0.15}>
            <h1 className="hfhig-title">
              How far<br />have I gone?
            </h1>
          </RevealSection>
          <RevealSection delay={0.3}>
            <p className="hfhig-subtitle">
              Every mile tracked. Every hill climbed.<br />
              Every second on the move.
            </p>
          </RevealSection>
        </section>

        {/* ============================================================ */}
        {/*  Big Numbers — all-time totals                                */}
        {/* ============================================================ */}
        <section className="hfhig-bignums">
          <RevealSection>
            <p className="hfhig-section-eyebrow">All Time</p>
          </RevealSection>

          <div className="hfhig-bignums-grid">
            <HeroStat
              value={Math.round(totalMiles)}
              unit=" mi"
              label="Total Distance"
              delay={0}
              gradient="linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)"
            />
            <HeroStat
              value={totalHours}
              unit=" hrs"
              label="Moving Time"
              delay={0.1}
              gradient="linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)"
            />
            <HeroStat
              value={totalFeet}
              unit=" ft"
              label="Elevation Gained"
              delay={0.2}
              gradient="linear-gradient(135deg, #55efc4 0%, #00b894 100%)"
            />
            <HeroStat
              value={totalActivities}
              unit=""
              label="Activities"
              delay={0.3}
              gradient="linear-gradient(135deg, #fd79a8 0%, #e84393 100%)"
            />
          </div>
        </section>

        {/* ============================================================ */}
        {/*  Map Visualizations                                           */}
        {/* ============================================================ */}
        <section className="hfhig-section">
          <RevealSection>
            <p className="hfhig-section-eyebrow">Where Could I Have Gone?</p>
            <h2 className="hfhig-section-heading">
              Plotting every<br />mile on the map.
            </h2>
            <p className="hfhig-section-body">
              Running and cycling laid end to end from San Francisco to Boston.
              Swimming lapped around the San Francisco Bay.
            </p>
          </RevealSection>

          <RevealSection delay={0.1}>
            <div className="hfhig-map-block">
              <div className="hfhig-map-header">
                <span className="hfhig-map-icon">🏃</span>
                <div>
                  <h3 className="hfhig-map-title" style={{ color: "#ff6b6b" }}>
                    Running
                  </h3>
                  <p className="hfhig-map-sub">San Francisco → Boston</p>
                </div>
              </div>
              <RouteMap
                route={RUN_ROUTE_SF_BOSTON}
                traveledMiles={toMiles(stats.all_run_totals.distance)}
                startLabel="San Francisco"
                endLabel="Boston"
                accentColor="#ff3b3b"
              />
            </div>
          </RevealSection>

          <RevealSection delay={0.15}>
            <div className="hfhig-map-block">
              <div className="hfhig-map-header">
                <span className="hfhig-map-icon">🚴</span>
                <div>
                  <h3 className="hfhig-map-title" style={{ color: "#74b9ff" }}>
                    Cycling
                  </h3>
                  <p className="hfhig-map-sub">San Francisco → Boston (scenic route)</p>
                </div>
              </div>
              <RouteMap
                route={BIKE_ROUTE_SF_BOSTON}
                traveledMiles={toMiles(stats.all_ride_totals.distance)}
                startLabel="San Francisco"
                endLabel="Boston"
                accentColor="#2563eb"
              />
            </div>
          </RevealSection>

          <RevealSection delay={0.2}>
            <div className="hfhig-map-block">
              <div className="hfhig-map-header">
                <span className="hfhig-map-icon">🏊</span>
                <div>
                  <h3 className="hfhig-map-title" style={{ color: "#55efc4" }}>
                    Swimming
                  </h3>
                  <p className="hfhig-map-sub">Laps around the San Francisco Bay</p>
                </div>
              </div>
              <BayMap
                traveledMiles={toMiles(stats.all_swim_totals.distance)}
                accentColor="#0ea5e9"
              />
            </div>
          </RevealSection>
        </section>

        {/* ============================================================ */}
        {/*  All-Time Breakdown                                           */}
        {/* ============================================================ */}
        <section className="hfhig-section hfhig-section--dark">
          <RevealSection>
            <h2 className="hfhig-section-heading">
              The full<br />picture.
            </h2>
            <p className="hfhig-section-body">
              A lifetime of runs, rides, and swims — broken down by activity.
            </p>
          </RevealSection>

          <div className="hfhig-activities">
            <ActivityBlock icon="🏃" title="Running" totals={stats.all_run_totals} accentColor="#ff6b6b" delay={0.1} />
            <ActivityBlock icon="🚴" title="Cycling" totals={stats.all_ride_totals} accentColor="#74b9ff" delay={0.2} />
            <ActivityBlock icon="🏊" title="Swimming" totals={stats.all_swim_totals} accentColor="#55efc4" delay={0.3} />
          </div>

          {stats.biggest_ride_distance > 0 && (
            <RevealSection delay={0.35}>
              <div className="hfhig-records">
                <div className="hfhig-record-item">
                  <span className="hfhig-record-value">
                    {formatDistance(stats.biggest_ride_distance)} mi
                  </span>
                  <span className="hfhig-record-label">Longest Ride</span>
                </div>
                <div className="hfhig-record-divider" />
                <div className="hfhig-record-item">
                  <span className="hfhig-record-value">
                    {formatElevation(stats.biggest_climb_elevation_gain)} ft
                  </span>
                  <span className="hfhig-record-label">Biggest Climb</span>
                </div>
              </div>
            </RevealSection>
          )}
        </section>

        {/* ============================================================ */}
        {/*  Year to Date                                                 */}
        {/* ============================================================ */}
        <section className="hfhig-section">
          <RevealSection>
            <p className="hfhig-section-eyebrow">Year to Date</p>
            <h2 className="hfhig-section-heading">
              This year,<br />so far.
            </h2>
          </RevealSection>

          <div className="hfhig-activities">
            <ActivityBlock icon="🏃" title="Running" totals={stats.ytd_run_totals} accentColor="#ff6b6b" delay={0.1} />
            <ActivityBlock icon="🚴" title="Cycling" totals={stats.ytd_ride_totals} accentColor="#74b9ff" delay={0.2} />
            <ActivityBlock icon="🏊" title="Swimming" totals={stats.ytd_swim_totals} accentColor="#55efc4" delay={0.3} />
          </div>
        </section>

        {/* ============================================================ */}
        {/*  Last 4 Weeks                                                 */}
        {/* ============================================================ */}
        <section className="hfhig-section hfhig-section--dark">
          <RevealSection>
            <p className="hfhig-section-eyebrow">Last 4 Weeks</p>
            <h2 className="hfhig-section-heading">
              What{"'"}s been<br />happening.
            </h2>
          </RevealSection>

          <div className="hfhig-activities">
            <ActivityBlock icon="🏃" title="Running" totals={stats.recent_run_totals} accentColor="#ff6b6b" delay={0.1} />
            <ActivityBlock icon="🚴" title="Cycling" totals={stats.recent_ride_totals} accentColor="#74b9ff" delay={0.2} />
            <ActivityBlock icon="🏊" title="Swimming" totals={stats.recent_swim_totals} accentColor="#55efc4" delay={0.3} />
          </div>
        </section>

        {/* ---- Footer ---- */}
        <footer className="hfhig-footer">
          <RevealSection>
            <p className="hfhig-footer-text">
              Data refreshed daily via&nbsp;
              <a href="https://strava.com" target="_blank" rel="noopener noreferrer" className="hfhig-strava-link">
                Strava
              </a>
            </p>
          </RevealSection>
        </footer>
      </main>
    </>
  );
}

/* ================================================================== */
/*  Styles (Apple-inspired)                                            */
/* ================================================================== */

const styles = `
/* ---- Page ---- */
.hfhig-page {
  background: #000;
  color: #f5f5f7;
  min-height: 100vh;
  overflow-x: hidden;
  font-family: var(--font-sans), -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* ---- Nav ---- */
.hfhig-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  padding: 1.25rem 2rem;
  background: rgba(0,0,0,0.72);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.hfhig-back {
  color: rgba(255,255,255,0.7);
  text-decoration: none;
  font-size: 0.875rem;
  letter-spacing: 0.02em;
  transition: color 0.3s;
}
.hfhig-back:hover {
  color: #fff;
}

/* ---- Hero ---- */
.hfhig-hero {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 6rem 2rem 4rem;
  position: relative;
}
.hfhig-hero::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 200px;
  background: linear-gradient(to bottom, transparent, #000);
  pointer-events: none;
}

.hfhig-eyebrow {
  font-size: 0.8125rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  margin-bottom: 1.5rem;
  font-weight: 400;
}

.hfhig-title {
  font-size: clamp(3rem, 10vw, 7rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.05;
  margin: 0 0 1.5rem;
  background: linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.6) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hfhig-subtitle {
  font-size: clamp(1rem, 2.5vw, 1.5rem);
  color: rgba(255,255,255,0.5);
  line-height: 1.5;
  max-width: 480px;
  font-weight: 400;
}

/* ---- Section eyebrow ---- */
.hfhig-section-eyebrow {
  font-size: 0.8125rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
  margin-bottom: 1rem;
  text-align: center;
  font-weight: 400;
}

/* ---- Big Numbers ---- */
.hfhig-bignums {
  padding: 6rem 2rem 8rem;
}
.hfhig-bignums-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  max-width: 900px;
  margin: 0 auto;
}

.hfhig-stat-number {
  font-size: clamp(2.5rem, 7vw, 5.5rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
  margin: 0;
}
.hfhig-stat-unit {
  font-size: 0.45em;
  font-weight: 400;
  letter-spacing: 0;
}
.hfhig-stat-label {
  font-size: 0.875rem;
  color: rgba(255,255,255,0.4);
  margin-top: 0.75rem;
  letter-spacing: 0.02em;
  font-weight: 400;
}

/* ---- Sections ---- */
.hfhig-section {
  padding: 7rem 2rem;
  max-width: 960px;
  margin: 0 auto;
}
.hfhig-section--dark {
  background: #0d0d0d;
  max-width: 100%;
  padding-left: 2rem;
  padding-right: 2rem;
}
.hfhig-section--dark > div,
.hfhig-section--dark > .hfhig-activities {
  max-width: 960px;
  margin-left: auto;
  margin-right: auto;
}

.hfhig-section-heading {
  font-size: clamp(2rem, 5.5vw, 4rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin: 0 0 1.25rem;
  text-align: center;
}
.hfhig-section-body {
  font-size: clamp(1rem, 2vw, 1.25rem);
  color: rgba(255,255,255,0.5);
  text-align: center;
  max-width: 520px;
  margin: 0 auto 3rem;
  line-height: 1.5;
  font-weight: 400;
}

/* ---- Map blocks ---- */
.hfhig-map-block {
  margin: 2.5rem auto 0;
  max-width: 960px;
}
.hfhig-map-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.hfhig-map-icon {
  font-size: 1.75rem;
}
.hfhig-map-title {
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0;
}
.hfhig-map-sub {
  font-size: 0.8125rem;
  color: rgba(255,255,255,0.4);
  margin: 0.15rem 0 0;
  letter-spacing: 0.02em;
}

/* ---- Activity blocks ---- */
.hfhig-activities {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 960px;
  margin: 0 auto;
}

.hfhig-activity-block {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px;
  padding: 2rem 2.5rem;
  transition: background 0.3s, border-color 0.3s;
}
.hfhig-activity-block:hover {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.1);
}

.hfhig-activity-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.75rem;
}
.hfhig-activity-icon {
  font-size: 1.5rem;
}
.hfhig-activity-title {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0;
}

/* ---- Mini stat grid ---- */
.hfhig-mini-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}
.hfhig-mini-stat {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.hfhig-mini-value {
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #fff;
}
.hfhig-mini-label {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.35);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-weight: 400;
}

/* ---- Records ---- */
.hfhig-records {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3rem;
  margin-top: 3rem;
  padding-top: 3rem;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.hfhig-record-divider {
  width: 1px;
  height: 56px;
  background: rgba(255,255,255,0.1);
}
.hfhig-record-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}
.hfhig-record-value {
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #dfe6e9 0%, #b2bec3 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.hfhig-record-label {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.35);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-weight: 400;
}

/* ---- Footer ---- */
.hfhig-footer {
  padding: 4rem 2rem;
  text-align: center;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.hfhig-footer-text {
  font-size: 0.8125rem;
  color: rgba(255,255,255,0.3);
  font-weight: 400;
}
.hfhig-strava-link {
  color: #fc4c02;
  text-decoration: none;
  transition: color 0.3s;
}
.hfhig-strava-link:hover {
  color: #ff6a33;
}

/* ---- Responsive ---- */
@media (max-width: 768px) {
  .hfhig-bignums-grid {
    grid-template-columns: 1fr 1fr;
    gap: 0;
  }
  .hfhig-mini-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.25rem;
  }
  .hfhig-activity-block {
    padding: 1.5rem 1.5rem;
    border-radius: 16px;
  }
  .hfhig-records {
    gap: 2rem;
  }
  .hfhig-section {
    padding: 5rem 1.25rem;
  }
  .hfhig-section--dark {
    padding-left: 1.25rem;
    padding-right: 1.25rem;
  }
}

@media (max-width: 480px) {
  .hfhig-bignums-grid {
    grid-template-columns: 1fr;
  }
  .hfhig-stat-number {
    font-size: clamp(2.5rem, 12vw, 4rem);
  }
  .hfhig-records {
    flex-direction: column;
    gap: 1.5rem;
  }
  .hfhig-record-divider {
    width: 60px;
    height: 1px;
  }
}
`;
