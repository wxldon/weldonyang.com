"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import ScrambleText from "@/components/ScrambleText";
import GradientCursor from "@/components/GradientCursor";

export default function Home() {
  const [animationPhase, setAnimationPhase] = useState<"scramble" | "move">("scramble");

  const handleScrambleComplete = () => {
    setTimeout(() => {
      setAnimationPhase("move");
    }, 300);
  };

  return (
    <main className="relative min-h-screen overflow-hidden px-6">
      <GradientCursor />
      <motion.div
        className="relative z-10 flex items-center justify-center"
        initial={{
          height: "100vh",
        }}
        animate={animationPhase === "move" ? {
          height: "auto",
          paddingTop: "2rem",
          paddingBottom: "2rem",
        } : {
          height: "100vh",
        }}
        transition={{
          duration: 0.8,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <motion.h1
          className="text-center font-medium tracking-tight"
          initial={{
            fontSize: "clamp(2.5rem, 8vw, 4rem)",
          }}
          animate={animationPhase === "move" ? {
            fontSize: "clamp(1.25rem, 3vw, 1.5rem)",
          } : {
            fontSize: "clamp(2.5rem, 8vw, 4rem)",
          }}
          transition={{
            duration: 0.8,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <ScrambleText
            text="[WELDON YANG]"
            onComplete={handleScrambleComplete}
          />
        </motion.h1>
      </motion.div>
    </main>
  );
}
