"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import ScrambleText from "@/components/ScrambleText";
import GradientCursor from "@/components/GradientCursor";
import LiveAge from "@/components/LiveAge";
import CoffeeCup from "@/components/CoffeeCup";

export default function Home() {
  const [animationPhase, setAnimationPhase] = useState<"scramble" | "move" | "complete">("scramble");

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
      <GradientCursor />
      <motion.div
        className="relative z-10 flex flex-col items-center justify-center"
        initial={{
          height: "100vh",
        }}
        animate={animationPhase === "scramble" ? {
          height: "100vh",
        } : {
          height: "auto",
          paddingTop: "2rem",
          paddingBottom: "2rem",
        }}
        transition={{
          duration: 0.8,
          ease: [0.22, 1, 0.36, 1],
        }}
        onAnimationComplete={() => {
          if (animationPhase === "move") {
            handleMoveComplete();
          }
        }}
      >
        <motion.h1
          className="text-center font-medium tracking-tight"
          initial={{
            fontSize: "clamp(2.5rem, 8vw, 4rem)",
          }}
          animate={animationPhase === "scramble" ? {
            fontSize: "clamp(2.5rem, 8vw, 4rem)",
          } : {
            fontSize: "clamp(1.25rem, 3vw, 1.5rem)",
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
        <LiveAge show={animationPhase === "complete"} />
      </motion.div>
      {animationPhase === "complete" && <CoffeeCup />}
    </main>
  );
}
