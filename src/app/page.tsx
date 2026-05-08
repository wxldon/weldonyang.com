"use client";

import { useEffect, useState } from "react";
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

/* macOS-style terminal that types `ls` out and reveals four folders.
 * Used for the coding-portfolio section instead of the SVG frame box. */
function CodingTerminal() {
  const command = "ls";
  const [typed, setTyped] = useState(0);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    // Brief pause so the prompt is readable before the typing kicks off.
    timeouts.push(
      setTimeout(() => {
        let i = 0;
        const tick = () => {
          if (cancelled) return;
          i++;
          setTyped(i);
          if (i < command.length) {
            timeouts.push(setTimeout(tick, 130));
          } else {
            timeouts.push(
              setTimeout(() => {
                if (!cancelled) setShowResult(true);
              }, 350),
            );
          }
        };
        tick();
      }, 500),
    );

    return () => {
      cancelled = true;
      for (const t of timeouts) clearTimeout(t);
    };
  }, []);

  const Prompt = () => (
    <span className="t-prompt">
      <span className="t-host">weldon@Macbook-Pro</span>{" "}
      <span className="t-path">/Users/weldon</span>{" "}
      <span className="t-sigil">%</span>{" "}
    </span>
  );

  return (
    <div className="terminal" role="presentation">
      <div className="terminal-titlebar">
        <span className="t-dot t-dot--red" aria-hidden="true" />
        <span className="t-dot t-dot--yellow" aria-hidden="true" />
        <span className="t-dot t-dot--green" aria-hidden="true" />
        <span className="t-title">weldon — -zsh — 80×24</span>
      </div>
      <div className="terminal-body">
        <div className="t-line">
          <Prompt />
          <span className="t-input">{command.slice(0, typed)}</span>
          {!showResult && <span className="t-cursor" aria-hidden="true" />}
        </div>
        {showResult && (
          <>
            <motion.div
              className="t-line t-ls"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <span className="t-dir">swift</span>
              <span className="t-dir">C</span>
              <span className="t-dir">python</span>
              <span className="t-dir">java</span>
            </motion.div>
            <motion.div
              className="t-line"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25, delay: 0.12 }}
            >
              <Prompt />
              <span className="t-cursor" aria-hidden="true" />
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}

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
                  height: active ? "clamp(240px, 38vh, 340px)" : 0,
                  marginTop: active ? "2.25rem" : 0,
                  pointerEvents: active ? "auto" : "none",
                }}
              >
                <PanelFrame
                  color={activeColor}
                  drawn={active !== null && active !== "coding"}
                />
                <AnimatePresence mode="wait">
                  {active === "coding" ? (
                    <motion.div
                      key="coding-terminal"
                      className="panel-body terminal-stage"
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.35, ease: easing }}
                    >
                      <CodingTerminal />
                    </motion.div>
                  ) : active ? (
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
                  ) : null}
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

        /* ---- Coding terminal ---- */
        .terminal-stage {
          padding: 0;
          align-items: stretch;
          justify-content: stretch;
        }
        .terminal {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #1d1d1d;
          border-radius: 10px;
          overflow: hidden;
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.06),
            0 18px 40px -20px rgba(0, 0, 0, 0.7);
          font-family: 'SF Mono', Menlo, Monaco, 'Cascadia Code',
            'Roboto Mono', Consolas, monospace;
        }
        .terminal-titlebar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.55rem 0.85rem;
          background: linear-gradient(180deg, #3a3a3c 0%, #2c2c2e 100%);
          border-bottom: 1px solid rgba(0, 0, 0, 0.4);
          position: relative;
        }
        .t-dot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          display: inline-block;
          flex: 0 0 auto;
          box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.25);
        }
        .t-dot--red    { background: #ff5f57; }
        .t-dot--yellow { background: #febc2e; }
        .t-dot--green  { background: #28c941; }
        .t-title {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          font-size: 0.72rem;
          color: rgba(255, 255, 255, 0.55);
          letter-spacing: 0.02em;
          font-family: inherit;
          white-space: nowrap;
          pointer-events: none;
        }
        .terminal-body {
          flex: 1;
          padding: 0.85rem 1rem 1rem;
          font-size: 0.85rem;
          line-height: 1.55;
          color: #e6e6e6;
          overflow: auto;
          text-align: left;
        }
        .t-line {
          display: block;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .t-prompt {
          color: #e6e6e6;
        }
        .t-host  { color: #28c941; }
        .t-path  { color: #5ec9f8; }
        .t-sigil { color: #c4b5fd; }
        .t-input { color: #ffffff; }
        .t-ls {
          display: flex;
          flex-wrap: wrap;
          gap: 1.25rem;
          margin: 0.15rem 0 0.35rem;
        }
        .t-dir {
          color: #6db6f5;
          font-weight: 600;
        }
        .t-cursor {
          display: inline-block;
          width: 0.55em;
          height: 1em;
          background: #e6e6e6;
          margin-left: 1px;
          vertical-align: text-bottom;
          animation: t-blink 1s steps(2, end) infinite;
        }
        @keyframes t-blink {
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
