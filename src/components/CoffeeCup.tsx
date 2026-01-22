"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, useAnimation, PanInfo } from "framer-motion";

interface SpillDrop {
  id: number;
  x: number;
  y: number;
  size: number;
  velocityX: number;
}

export default function CoffeeCup() {
  const [isDragging, setIsDragging] = useState(false);
  const [coffeeLevel, setCoffeeLevel] = useState(100);
  const [coffeeTilt, setCoffeeTilt] = useState(0);
  const [hasFallen, setHasFallen] = useState(false);
  const [spillDrops, setSpillDrops] = useState<SpillDrop[]>([]);
  const [spillStream, setSpillStream] = useState<{ active: boolean; side: "left" | "right" }>({
    active: false,
    side: "right",
  });
  const controls = useAnimation();
  const cupRef = useRef<HTMLDivElement>(null);
  const dropId = useRef(0);
  const spillInterval = useRef<NodeJS.Timeout | null>(null);

  const createSpillDrop = useCallback((tiltDirection: "left" | "right") => {
    if (!cupRef.current || coffeeLevel <= 0) return;

    const rect = cupRef.current.getBoundingClientRect();
    const dropX = tiltDirection === "right" ? rect.right - 15 : rect.left + 15;
    const dropY = rect.top + 15;

    setSpillDrops((prev) => [
      ...prev.slice(-20), // Keep max 20 drops
      {
        id: dropId.current++,
        x: dropX,
        y: dropY,
        size: 4 + Math.random() * 6,
        velocityX: tiltDirection === "right" ? 2 + Math.random() * 3 : -2 - Math.random() * 3,
      },
    ]);
  }, [coffeeLevel]);

  // Handle continuous spilling when tilted
  useEffect(() => {
    if (spillStream.active && coffeeLevel > 0) {
      spillInterval.current = setInterval(() => {
        createSpillDrop(spillStream.side);
        setCoffeeLevel((prev) => Math.max(0, prev - 0.8));
      }, 50);
    } else {
      if (spillInterval.current) {
        clearInterval(spillInterval.current);
        spillInterval.current = null;
      }
    }

    return () => {
      if (spillInterval.current) {
        clearInterval(spillInterval.current);
      }
    };
  }, [spillStream.active, spillStream.side, createSpillDrop, coffeeLevel]);

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Calculate tilt based on velocity
    const velocityX = info.velocity.x;
    const tilt = Math.max(-60, Math.min(60, velocityX * 0.08));
    setCoffeeTilt(tilt);

    // Start spilling when tilted enough
    const spillThreshold = 25;
    if (Math.abs(tilt) > spillThreshold && coffeeLevel > 0) {
      setSpillStream({
        active: true,
        side: tilt > 0 ? "right" : "left",
      });
    } else {
      setSpillStream({ active: false, side: "right" });
    }
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    setCoffeeTilt(0);
    setSpillStream({ active: false, side: "right" });

    const cupElement = cupRef.current;
    if (!cupElement) return;

    const rect = cupElement.getBoundingClientRect();
    const cupCenterX = rect.left + rect.width / 2;
    const cupCenterY = rect.top + rect.height / 2;

    // Check if in home zone (top right corner)
    const isInHomeZone = cupCenterX > window.innerWidth - 150 && cupCenterY < 150;

    if (isInHomeZone) {
      controls.start({ x: 0, y: 0, rotate: 0 });
    } else {
      setHasFallen(true);
      // Spill remaining coffee as it falls
      const remainingDrops = Math.floor(coffeeLevel / 5);
      for (let i = 0; i < remainingDrops; i++) {
        setTimeout(() => {
          createSpillDrop(info.velocity.x > 0 ? "right" : "left");
        }, i * 30);
      }

      controls.start({
        y: window.innerHeight + 200,
        rotate: info.velocity.x > 0 ? 180 : -180,
        transition: { duration: 0.8, ease: "easeIn" },
      });
    }
  };

  // Clean up old spill drops
  useEffect(() => {
    const cleanup = setInterval(() => {
      setSpillDrops((prev) => prev.filter((drop) => Date.now() - drop.id < 2000));
    }, 500);
    return () => clearInterval(cleanup);
  }, []);

  const resetCup = () => {
    setHasFallen(false);
    setCoffeeLevel(100);
    setSpillDrops([]);
    controls.start({ x: 0, y: 0, rotate: 0 });
  };

  if (hasFallen) {
    return (
      <button
        onClick={resetCup}
        className="fixed top-4 right-4 z-50 px-3 py-1 text-xs rounded-full border border-current opacity-50 hover:opacity-100 transition-opacity"
      >
        Reset cup
      </button>
    );
  }

  return (
    <>
      {/* Spill drops with physics */}
      {spillDrops.map((drop) => (
        <motion.div
          key={drop.id}
          className="fixed rounded-full pointer-events-none z-40"
          style={{
            left: drop.x,
            top: drop.y,
            width: drop.size,
            height: drop.size,
            backgroundColor: "rgba(101, 67, 33, 0.85)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
          }}
          initial={{ scale: 1, y: 0, x: 0, opacity: 1 }}
          animate={{
            y: [0, 100, 300, 600],
            x: [0, drop.velocityX * 20, drop.velocityX * 35, drop.velocityX * 40],
            scale: [1, 0.9, 0.7, 0.3],
            opacity: [1, 1, 0.8, 0],
          }}
          transition={{
            duration: 1.2,
            ease: "easeIn",
            times: [0, 0.3, 0.6, 1],
          }}
        />
      ))}

      {/* Spill stream when pouring */}
      {spillStream.active && coffeeLevel > 0 && (
        <motion.div
          className="fixed pointer-events-none z-40"
          style={{
            left: cupRef.current
              ? spillStream.side === "right"
                ? cupRef.current.getBoundingClientRect().right - 12
                : cupRef.current.getBoundingClientRect().left + 6
              : 0,
            top: cupRef.current ? cupRef.current.getBoundingClientRect().top + 10 : 0,
            width: 6,
            height: 30,
            background: "linear-gradient(to bottom, rgba(101, 67, 33, 0.9), rgba(101, 67, 33, 0.3))",
            borderRadius: "0 0 4px 4px",
            transform: `rotate(${spillStream.side === "right" ? 15 : -15}deg)`,
          }}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          exit={{ scaleY: 0, opacity: 0 }}
        />
      )}

      {/* Coffee cup */}
      <motion.div
        ref={cupRef}
        drag
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        animate={controls}
        className="fixed top-4 right-4 z-50 cursor-grab active:cursor-grabbing select-none"
        whileDrag={{ scale: 1.05 }}
      >
        <motion.div
          animate={{ rotate: coffeeTilt }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="relative"
        >
          {/* Cup body */}
          <div
            className="relative w-14 h-16 rounded-b-2xl border-2 overflow-hidden"
            style={{
              borderColor: "rgba(150, 150, 150, 0.6)",
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              backdropFilter: "blur(8px)",
            }}
          >
            {/* Coffee liquid */}
            <div className="absolute bottom-0 left-0 right-0 overflow-hidden" style={{ height: `${coffeeLevel}%` }}>
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-full"
                style={{
                  background: "linear-gradient(to bottom, rgba(139, 90, 43, 0.8), rgba(101, 67, 33, 0.9))",
                }}
                animate={{
                  x: coffeeTilt * 0.3,
                  skewX: coffeeTilt * 0.4,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              />
              {/* Coffee surface shine */}
              <motion.div
                className="absolute top-0 left-0 right-0 h-2"
                style={{
                  background: "linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)",
                }}
                animate={{
                  x: coffeeTilt * 0.5,
                }}
              />
            </div>
          </div>

          {/* Cup handle */}
          <div
            className="absolute top-3 -right-3 w-3 h-7 rounded-r-full border-2"
            style={{
              borderColor: "rgba(150, 150, 150, 0.6)",
              borderLeft: "none",
              backgroundColor: "transparent",
            }}
          />

          {/* Coffee level indicator */}
          {coffeeLevel < 100 && coffeeLevel > 0 && (
            <div
              className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs opacity-50 font-mono"
            >
              {Math.round(coffeeLevel)}%
            </div>
          )}
        </motion.div>
      </motion.div>
    </>
  );
}
