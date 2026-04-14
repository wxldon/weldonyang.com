"use client";

import { useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
import ScrambleText from "@/components/ScrambleText";
import LiveAge from "@/components/LiveAge";
import CookieParody from "@/components/CookieParody";
import Link from "next/link";

const easing = [0.22, 1, 0.36, 1] as const;

export default function Home() {
  const [animationPhase, setAnimationPhase] = useState<"scramble" | "move" | "complete">("scramble");
  const isScramble = animationPhase === "scramble";

  const handleScrambleComplete = () => {
    setTimeout(() => {
      setAnimationPhase("move");
    }, 300);
  };

  const handleMoveComplete = () => {
    setAnimationPhase("complete");
  };

  return (
    <main className="relative min-h-screen overflow-hidden px-6">
      <CookieParody />
      <LayoutGroup>
        <motion.div
          className={`relative z-10 flex flex-col items-center ${isScramble ? "justify-center h-screen" : "pt-8 pb-8"}`}
          layout
          transition={{
            layout: { duration: 0.8, ease: easing },
          }}
          onLayoutAnimationComplete={() => {
            if (animationPhase === "move") {
              handleMoveComplete();
            }
          }}
        >
          <motion.h1
            className="text-center font-medium tracking-tight"
            layout
            style={{ fontSize: isScramble ? "clamp(2.5rem, 8vw, 4rem)" : "clamp(1.25rem, 3vw, 1.5rem)" }}
            transition={{
              layout: { duration: 0.8, ease: easing },
              fontSize: { duration: 0.8, ease: easing },
            }}
          >
            <ScrambleText
              text="[WELDON YANG]"
              onComplete={handleScrambleComplete}
            />
          </motion.h1>
          <LiveAge show={animationPhase === "complete"} />
          {animationPhase === "complete" && (
            <motion.a
              href="https://github.com/wxldon"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 text-lg tracking-wide opacity-70 hover:opacity-100 transition-opacity"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 0.7, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
            >
              Take a peek at my <span className="underline" style={{ color: "#8b5cf6" }}>GitHub →</span>
            </motion.a>
          )}
          {animationPhase === "complete" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 0.7, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.5 }}
            >
              <Link
                href="/how-far-have-i-gone"
                className="mt-2 text-lg tracking-wide opacity-70 hover:opacity-100 transition-opacity"
              >
                How far have I gone? <span className="underline" style={{ color: "#8b5cf6" }}>→</span>
              </Link>
            </motion.div>
          )}
        </motion.div>
      </LayoutGroup>
    </main>
  );
}
