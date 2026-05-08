"use client";

import { useState } from "react";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import ScrambleText from "@/components/ScrambleText";
import LiveAge from "@/components/LiveAge";
import CookieParody from "@/components/CookieParody";
import Link from "next/link";

const easing = [0.22, 1, 0.36, 1] as const;

type SectionId = "fitness" | "now" | "coding";

const SECTIONS: { id: SectionId; label: string; color: string }[] = [
  { id: "fitness", label: "fitness accolades",  color: "#fc4c02" },
  { id: "now",     label: "what I'm doing now", color: "#22c55e" },
  { id: "coding",  label: "coding portfolio",   color: "#8b5cf6" },
];

const FALLBACK_LINKS: { href: string; label: string }[] = [
  { href: "/how-far-have-i-gone",   label: "how far have I gone" },
  { href: "/my-coach",              label: "my coach" },
  { href: "/biking-scouting-report", label: "biking scouting report" },
  { href: "https://github.com/wxldon", label: "github" },
];

/* SVG frame that draws around the active panel.
 * Two paths start at top-center and trace opposite halves of a rectangle,
 * meeting again at bottom-center. stroke-dashoffset animates from full path
 * length down to 0, giving the "rectangle drawing itself" feel. */
function PanelFrame({ color, drawn }: { color: string; drawn: boolean }) {
  // viewBox 0 0 100 100, stretched non-uniformly; vector-effect keeps stroke
  // width consistent. Each path has pathLength=100 so the dash math is simple.
  return (
    <svg
      className="panel-frame"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M 50 1 L 99 1 L 99 99 L 50 99"
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        pathLength={100}
        style={{
          strokeDasharray: 100,
          strokeDashoffset: drawn ? 0 : 100,
          transition:
            "stroke-dashoffset 0.6s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.35s ease-out",
        }}
      />
      <path
        d="M 50 1 L 1 1 L 1 99 L 50 99"
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        pathLength={100}
        style={{
          strokeDasharray: 100,
          strokeDashoffset: drawn ? 0 : 100,
          transition:
            "stroke-dashoffset 0.6s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.35s ease-out",
        }}
      />
    </svg>
  );
}

export default function Home() {
  const [animationPhase, setAnimationPhase] = useState<"scramble" | "move" | "complete">("scramble");
  const [active, setActive] = useState<SectionId | null>(null);
  const isScramble = animationPhase === "scramble";

  const handleScrambleComplete = () => {
    setTimeout(() => setAnimationPhase("move"), 300);
  };
  const handleMoveComplete = () => setAnimationPhase("complete");

  const activeColor = SECTIONS.find((s) => s.id === active)?.color ?? "#8b5cf6";

  return (
    <main className="relative min-h-screen overflow-hidden px-6">
      <CookieParody />
      <LayoutGroup>
        <motion.div
          className={`relative z-10 flex flex-col items-center ${
            isScramble ? "justify-center h-screen" : "pt-8 pb-12"
          }`}
          layout
          transition={{ layout: { duration: 0.8, ease: easing } }}
          onLayoutAnimationComplete={() => {
            if (animationPhase === "move") handleMoveComplete();
          }}
        >
          <motion.h1
            className="text-center font-medium tracking-tight"
            layout
            style={{
              fontSize: isScramble
                ? "clamp(2.5rem, 8vw, 4rem)"
                : "clamp(1.25rem, 3vw, 1.5rem)",
            }}
            transition={{
              layout: { duration: 0.8, ease: easing },
              fontSize: { duration: 0.8, ease: easing },
            }}
          >
            <ScrambleText text="[WELDON YANG]" onComplete={handleScrambleComplete} />
          </motion.h1>
          <LiveAge show={animationPhase === "complete"} />

          {animationPhase === "complete" && (
            <>
              <motion.p
                className="lead"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 0.85, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.25 }}
              >
                I split my time between
              </motion.p>

              <motion.div
                className="cat-row"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.45 }}
              >
                {SECTIONS.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActive(active === s.id ? null : s.id)}
                    className={`cat-btn ${active === s.id ? "is-active" : ""}`}
                    style={{ color: s.color }}
                  >
                    {s.label}
                    <span
                      className="cat-underline"
                      style={{ background: s.color }}
                    />
                    {i < SECTIONS.length - 1 && (
                      <span className="cat-sep" aria-hidden="true">,</span>
                    )}
                  </button>
                ))}
                <span className="cat-period" aria-hidden="true">.</span>
              </motion.div>

              <motion.p
                className="cat-hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: active ? 0 : 0.5 }}
                transition={{ duration: 0.3 }}
              >
                (click to view details)
              </motion.p>

              <div
                className="panel-wrap"
                style={{
                  height: active ? "clamp(220px, 36vh, 320px)" : 0,
                  marginTop: active ? "2.25rem" : 0,
                  pointerEvents: active ? "auto" : "none",
                }}
              >
                <PanelFrame color={activeColor} drawn={active !== null} />
                <AnimatePresence mode="wait">
                  {active && (
                    <motion.div
                      key={active}
                      className="panel-body"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{
                        duration: 0.4,
                        ease: easing,
                        delay: 0.35, // wait for frame to mostly draw
                      }}
                    >
                      <h2 className="panel-title" style={{ color: activeColor }}>
                        {SECTIONS.find((s) => s.id === active)?.label}
                      </h2>
                      <p className="panel-empty">
                        filling this in soon
                        <span className="panel-cursor" style={{ background: activeColor }} />
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <motion.nav
                className="footer-nav"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.35 }}
                transition={{ duration: 0.5, delay: 0.8 }}
              >
                {FALLBACK_LINKS.map((l, i) => (
                  <span key={l.href}>
                    {l.href.startsWith("/") ? (
                      <Link href={l.href} className="footer-link">
                        {l.label}
                      </Link>
                    ) : (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="footer-link"
                      >
                        {l.label}
                      </a>
                    )}
                    {i < FALLBACK_LINKS.length - 1 && (
                      <span className="footer-sep">·</span>
                    )}
                  </span>
                ))}
              </motion.nav>
            </>
          )}
        </motion.div>
      </LayoutGroup>

      <style>{`
        .lead {
          margin: 1.5rem 0 0.75rem;
          font-size: clamp(0.95rem, 2vw, 1.15rem);
          letter-spacing: 0.02em;
          color: rgba(255, 255, 255, 0.85);
        }
        .cat-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: baseline;
          gap: 0.15rem 0.6rem;
          font-size: clamp(1.4rem, 3.6vw, 2.1rem);
          letter-spacing: -0.01em;
          line-height: 1.4;
          max-width: 720px;
        }
        .cat-btn {
          position: relative;
          background: none;
          border: none;
          padding: 0;
          font: inherit;
          font-weight: 600;
          letter-spacing: inherit;
          color: inherit;
          cursor: pointer;
          line-height: 1.2;
          transition: filter 0.2s ease;
        }
        .cat-btn:hover { filter: brightness(1.18); }
        .cat-btn:focus-visible {
          outline: 2px solid currentColor;
          outline-offset: 4px;
          border-radius: 2px;
        }
        .cat-underline {
          display: block;
          height: 2px;
          margin-top: 2px;
          width: 0;
          transition: width 0.25s linear;
        }
        .cat-btn:hover .cat-underline,
        .cat-btn.is-active .cat-underline {
          width: 100%;
        }
        .cat-sep {
          color: rgba(255, 255, 255, 0.55);
          font-weight: 400;
          margin-left: 0.05em;
        }
        .cat-period {
          color: rgba(255, 255, 255, 0.55);
          font-weight: 400;
          margin-left: -0.4rem;
          align-self: baseline;
        }
        .cat-hint {
          margin-top: 0.6rem;
          font-size: 0.82rem;
          color: rgba(255, 255, 255, 0.45);
          letter-spacing: 0.04em;
          height: 1.2em;
        }

        .panel-wrap {
          position: relative;
          width: min(720px, calc(100vw - 3rem));
          overflow: hidden;
          transition:
            height 0.55s cubic-bezier(0.22, 1, 0.36, 1),
            margin-top 0.55s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .panel-frame {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
        .panel-body {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          text-align: center;
        }
        .panel-title {
          font-size: clamp(1rem, 2.4vw, 1.35rem);
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin: 0 0 0.6rem;
          opacity: 0.95;
        }
        .panel-empty {
          font-size: 0.95rem;
          color: rgba(255, 255, 255, 0.55);
          letter-spacing: 0.02em;
          font-style: italic;
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          margin: 0;
        }
        .panel-cursor {
          display: inline-block;
          width: 8px;
          height: 1em;
          animation: blink 1.1s steps(2, end) infinite;
        }
        @keyframes blink {
          50% { opacity: 0; }
        }

        .footer-nav {
          margin-top: 2.5rem;
          font-size: 0.78rem;
          letter-spacing: 0.04em;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0;
        }
        .footer-link {
          color: inherit;
          text-decoration: none;
          padding: 0 0.45rem;
          transition: color 0.2s ease;
        }
        .footer-link:hover { color: #fff; }
        .footer-sep {
          color: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </main>
  );
}
