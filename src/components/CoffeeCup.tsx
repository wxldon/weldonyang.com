"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, useAnimation, PanInfo, useMotionValue, useSpring, useTransform } from "framer-motion";

interface SpillDrop {
  id: number;
  x: number;
  y: number;
  size: number;
  velocityX: number;
  velocityY: number;
}

export default function CoffeeCup() {
  const [isDragging, setIsDragging] = useState(false);
  const [coffeeLevel, setCoffeeLevel] = useState(100);
  const [hasFallen, setHasFallen] = useState(false);
  const [spillDrops, setSpillDrops] = useState<SpillDrop[]>([]);

  // Physics-based tilt using spring
  const tiltValue = useMotionValue(0);
  const smoothTilt = useSpring(tiltValue, { stiffness: 150, damping: 12, mass: 0.5 });

  // Coffee surface angle - opposite to cup tilt (liquid stays level)
  const coffeeSurfaceAngle = useTransform(smoothTilt, (tilt) => -tilt * 0.8);

  // Coffee offset - liquid shifts to the lower side
  const coffeeOffset = useTransform(smoothTilt, (tilt) => tilt * 0.4);

  const controls = useAnimation();
  const cupRef = useRef<HTMLDivElement>(null);
  const dropId = useRef(0);
  const lastVelocity = useRef(0);
  const lastTime = useRef(Date.now());

  const createSpillDrop = useCallback((cupRect: DOMRect, tiltAngle: number) => {
    if (coffeeLevel <= 0) return;

    // Determine which side is lower (where coffee spills from)
    const spillsRight = tiltAngle > 0;
    const tiltRad = (Math.abs(tiltAngle) * Math.PI) / 180;

    // Calculate spill point at the rim of the cup
    const cupCenterX = cupRect.left + cupRect.width / 2;
    const cupTop = cupRect.top;
    const rimOffset = (cupRect.width / 2) * Math.cos(tiltRad);

    const dropX = spillsRight ? cupCenterX + rimOffset - 5 : cupCenterX - rimOffset + 5;
    const dropY = cupTop + 5;

    // Initial velocity based on tilt angle
    const speed = 2 + Math.abs(tiltAngle) * 0.1;
    const velocityX = spillsRight ? speed + Math.random() * 2 : -speed - Math.random() * 2;
    const velocityY = 1 + Math.random() * 2;

    setSpillDrops((prev) => [
      ...prev.slice(-30),
      {
        id: dropId.current++,
        x: dropX,
        y: dropY,
        size: 5 + Math.random() * 5,
        velocityX,
        velocityY,
      },
    ]);

    setCoffeeLevel((prev) => Math.max(0, prev - 0.6));
  }, [coffeeLevel]);

  // Check for spilling based on tilt
  useEffect(() => {
    let spillTimer: NodeJS.Timeout | null = null;

    const unsubscribe = smoothTilt.on("change", (tilt) => {
      const spillThreshold = 35;

      if (Math.abs(tilt) > spillThreshold && coffeeLevel > 0 && isDragging && cupRef.current) {
        if (!spillTimer) {
          spillTimer = setInterval(() => {
            if (cupRef.current) {
              createSpillDrop(cupRef.current.getBoundingClientRect(), smoothTilt.get());
            }
          }, 50);
        }
      } else {
        if (spillTimer) {
          clearInterval(spillTimer);
          spillTimer = null;
        }
      }
    });

    return () => {
      unsubscribe();
      if (spillTimer) clearInterval(spillTimer);
    };
  }, [smoothTilt, coffeeLevel, isDragging, createSpillDrop]);

  const handleDragStart = () => {
    setIsDragging(true);
    lastTime.current = Date.now();
  };

  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const now = Date.now();
    const deltaTime = Math.max(1, now - lastTime.current);

    const currentVelocityX = info.velocity.x;
    const acceleration = (currentVelocityX - lastVelocity.current) / deltaTime * 10;

    // Inertia-based tilt
    const velocityTilt = -currentVelocityX * 0.018;
    const accelerationTilt = -acceleration * 0.6;

    let totalTilt = velocityTilt + accelerationTilt;
    totalTilt = Math.max(-75, Math.min(75, totalTilt));

    tiltValue.set(totalTilt);

    lastVelocity.current = currentVelocityX;
    lastTime.current = now;
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    tiltValue.set(0);

    const cupElement = cupRef.current;
    if (!cupElement) return;

    const rect = cupElement.getBoundingClientRect();
    const cupCenterX = rect.left + rect.width / 2;
    const cupCenterY = rect.top + rect.height / 2;

    const isInHomeZone = cupCenterX > window.innerWidth - 150 && cupCenterY < 150;

    if (isInHomeZone) {
      controls.start({ x: 0, y: 0, rotate: 0 });
    } else {
      setHasFallen(true);

      // Spill remaining coffee as it falls
      const spillDirection = info.velocity.x > 0 ? 1 : -1;
      const remainingDrops = Math.floor(coffeeLevel / 4);

      for (let i = 0; i < remainingDrops; i++) {
        setTimeout(() => {
          if (cupRef.current) {
            const fallRect = cupRef.current.getBoundingClientRect();
            setSpillDrops((prev) => [
              ...prev.slice(-30),
              {
                id: dropId.current++,
                x: fallRect.left + fallRect.width / 2 + (Math.random() - 0.5) * 20,
                y: fallRect.top + Math.random() * 10,
                size: 4 + Math.random() * 6,
                velocityX: spillDirection * (3 + Math.random() * 4),
                velocityY: -2 + Math.random() * 4,
              },
            ]);
          }
        }, i * 25);
      }

      controls.start({
        y: window.innerHeight + 200,
        rotate: info.velocity.x > 0 ? 200 : -200,
        transition: { duration: 1, ease: "easeIn" },
      });
    }
  };

  // Clean up old drops
  useEffect(() => {
    const cleanup = setInterval(() => {
      setSpillDrops((prev) => {
        const now = Date.now();
        return prev.filter((drop) => now - drop.id < 3000);
      });
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
      {/* Realistic falling coffee drops */}
      {spillDrops.map((drop) => (
        <motion.div
          key={drop.id}
          className="fixed rounded-full pointer-events-none z-40"
          style={{
            width: drop.size,
            height: drop.size,
            backgroundColor: "rgba(101, 67, 33, 0.9)",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          }}
          initial={{
            x: drop.x,
            y: drop.y,
            scale: 1,
            opacity: 1,
          }}
          animate={{
            x: drop.x + drop.velocityX * 80,
            y: drop.y + window.innerHeight,
            scale: [1, 1.1, 0.8, 0.4],
            opacity: [1, 1, 0.9, 0],
          }}
          transition={{
            duration: 1.5,
            ease: [0.215, 0.61, 0.355, 1],
            y: { duration: 1.5, ease: [0.55, 0.055, 0.675, 0.19] }, // Gravity curve
            scale: { duration: 1.5, times: [0, 0.2, 0.6, 1] },
            opacity: { duration: 1.5, times: [0, 0.5, 0.8, 1] },
          }}
        />
      ))}

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
            {/* Coffee liquid container */}
            <div
              className="absolute bottom-0 left-0 right-0 overflow-hidden"
              style={{ height: `${coffeeLevel}%` }}
            >
              {/* Coffee liquid that shifts based on tilt */}
              <motion.div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(to bottom, rgba(139, 90, 43, 0.85), rgba(80, 50, 25, 0.95))",
                  x: coffeeOffset,
                }}
              />

              {/* Coffee surface that stays level (tilts opposite to cup) */}
              <motion.div
                className="absolute top-0 left-[-20%] right-[-20%] h-4"
                style={{
                  background: "linear-gradient(to bottom, rgba(160, 100, 50, 0.95) 0%, rgba(139, 90, 43, 0.9) 50%, transparent 100%)",
                  rotate: coffeeSurfaceAngle,
                  transformOrigin: "center center",
                  x: coffeeOffset,
                }}
              />

              {/* Surface highlight/reflection */}
              <motion.div
                className="absolute top-0 left-[-10%] right-[-10%] h-1"
                style={{
                  background: "linear-gradient(90deg, transparent 20%, rgba(255,255,255,0.3) 50%, transparent 80%)",
                  rotate: coffeeSurfaceAngle,
                  x: coffeeOffset,
                }}
              />
            </div>

            {/* Cup rim highlight */}
            <div
              className="absolute top-0 left-0 right-0 h-1 rounded-t"
              style={{
                background: "linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)",
              }}
            />
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

          {coffeeLevel <= 0 && (
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs opacity-50">
              empty
            </div>
          )}
        </motion.div>
      </motion.div>
    </>
  );
}
