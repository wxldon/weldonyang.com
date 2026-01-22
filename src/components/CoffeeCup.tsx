"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, useAnimation, PanInfo, useMotionValue, useSpring } from "framer-motion";

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
  const [hasFallen, setHasFallen] = useState(false);
  const [spillDrops, setSpillDrops] = useState<SpillDrop[]>([]);
  const [spillStream, setSpillStream] = useState<{ active: boolean; side: "left" | "right" }>({
    active: false,
    side: "right",
  });

  // Physics-based tilt using spring
  const tiltValue = useMotionValue(0);
  const smoothTilt = useSpring(tiltValue, { stiffness: 150, damping: 12, mass: 0.5 });

  const controls = useAnimation();
  const cupRef = useRef<HTMLDivElement>(null);
  const dropId = useRef(0);
  const spillInterval = useRef<NodeJS.Timeout | null>(null);
  const lastVelocity = useRef(0);
  const lastPosition = useRef({ x: 0, y: 0 });
  const lastTime = useRef(Date.now());

  const createSpillDrop = useCallback((tiltDirection: "left" | "right", intensity: number = 1) => {
    if (!cupRef.current || coffeeLevel <= 0) return;

    const rect = cupRef.current.getBoundingClientRect();
    const dropX = tiltDirection === "right" ? rect.right - 15 : rect.left + 15;
    const dropY = rect.top + 15;

    setSpillDrops((prev) => [
      ...prev.slice(-25),
      {
        id: dropId.current++,
        x: dropX,
        y: dropY,
        size: (4 + Math.random() * 6) * intensity,
        velocityX: tiltDirection === "right"
          ? (2 + Math.random() * 4) * intensity
          : (-2 - Math.random() * 4) * intensity,
      },
    ]);
  }, [coffeeLevel]);

  // Monitor tilt for spilling
  useEffect(() => {
    const unsubscribe = smoothTilt.on("change", (latest) => {
      const spillThreshold = 30;
      if (Math.abs(latest) > spillThreshold && coffeeLevel > 0 && isDragging) {
        setSpillStream({
          active: true,
          side: latest > 0 ? "right" : "left",
        });
      } else if (!isDragging || Math.abs(latest) < spillThreshold - 10) {
        setSpillStream({ active: false, side: "right" });
      }
    });
    return () => unsubscribe();
  }, [smoothTilt, coffeeLevel, isDragging]);

  // Handle continuous spilling when tilted
  useEffect(() => {
    if (spillStream.active && coffeeLevel > 0) {
      const currentTilt = Math.abs(smoothTilt.get());
      const spillRate = Math.min(2, (currentTilt - 25) / 20); // More tilt = faster spill

      spillInterval.current = setInterval(() => {
        createSpillDrop(spillStream.side, spillRate);
        setCoffeeLevel((prev) => Math.max(0, prev - spillRate * 0.5));
      }, 40);
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
  }, [spillStream.active, spillStream.side, createSpillDrop, coffeeLevel, smoothTilt]);

  const handleDragStart = () => {
    setIsDragging(true);
    lastTime.current = Date.now();
  };

  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const now = Date.now();
    const deltaTime = Math.max(1, now - lastTime.current);

    // Calculate acceleration (change in velocity over time)
    const currentVelocityX = info.velocity.x;
    const acceleration = (currentVelocityX - lastVelocity.current) / deltaTime * 10;

    // Calculate position-based tilt (cup tilts opposite to movement direction due to inertia)
    const velocityTilt = -currentVelocityX * 0.015;

    // Calculate acceleration-based tilt (sudden movements cause more tilt)
    const accelerationTilt = -acceleration * 0.8;

    // Combine tilts with limits
    let totalTilt = velocityTilt + accelerationTilt;
    totalTilt = Math.max(-70, Math.min(70, totalTilt));

    tiltValue.set(totalTilt);

    lastVelocity.current = currentVelocityX;
    lastPosition.current = { x: info.point.x, y: info.point.y };
    lastTime.current = now;
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    setSpillStream({ active: false, side: "right" });

    // Let the tilt naturally settle back to 0
    tiltValue.set(0);

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
          createSpillDrop(info.velocity.x > 0 ? "right" : "left", 1.2);
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
    tiltValue.set(0);
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
            y: [0, 80, 250, 500],
            x: [0, drop.velocityX * 15, drop.velocityX * 25, drop.velocityX * 30],
            scale: [1, 0.9, 0.7, 0.3],
            opacity: [1, 1, 0.8, 0],
          }}
          transition={{
            duration: 1,
            ease: [0.25, 0.46, 0.45, 0.94],
            times: [0, 0.25, 0.55, 1],
          }}
        />
      ))}

      {/* Spill stream when pouring */}
      {spillStream.active && coffeeLevel > 0 && cupRef.current && (
        <motion.div
          className="fixed pointer-events-none z-40"
          style={{
            left: spillStream.side === "right"
              ? cupRef.current.getBoundingClientRect().right - 12
              : cupRef.current.getBoundingClientRect().left + 6,
            top: cupRef.current.getBoundingClientRect().top + 10,
            width: 6,
            height: 35,
            background: "linear-gradient(to bottom, rgba(101, 67, 33, 0.9), rgba(101, 67, 33, 0.2))",
            borderRadius: "0 0 4px 4px",
            transformOrigin: "top center",
            transform: `rotate(${spillStream.side === "right" ? 20 : -20}deg)`,
          }}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          exit={{ scaleY: 0, opacity: 0 }}
          transition={{ duration: 0.1 }}
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
          style={{ rotate: smoothTilt }}
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
                  transformOrigin: "bottom center",
                }}
              />
              {/* Coffee surface - reacts to tilt */}
              <motion.div
                className="absolute top-0 left-0 right-0 h-3"
                style={{
                  background: "linear-gradient(to bottom, rgba(180, 120, 60, 0.9), rgba(139, 90, 43, 0.8))",
                  transformOrigin: "center center",
                  skewX: useSpring(tiltValue, { stiffness: 100, damping: 8 }),
                }}
              />
              {/* Surface shine */}
              <motion.div
                className="absolute top-0 left-0 right-0 h-1"
                style={{
                  background: "linear-gradient(to bottom, rgba(255,255,255,0.4), transparent)",
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
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs opacity-50 font-mono">
              {Math.round(coffeeLevel)}%
            </div>
          )}
        </motion.div>
      </motion.div>
    </>
  );
}
