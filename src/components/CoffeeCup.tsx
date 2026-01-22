"use client";

import { useState, useRef, useEffect } from "react";
import { motion, useAnimation, PanInfo } from "framer-motion";

export default function CoffeeCup() {
  const [isDragging, setIsDragging] = useState(false);
  const [coffeeLevel, setCoffeeLevel] = useState(100);
  const [coffeeTilt, setCoffeeTilt] = useState(0);
  const [hasFallen, setHasFallen] = useState(false);
  const [spillDrops, setSpillDrops] = useState<{ id: number; x: number; y: number }[]>([]);
  const controls = useAnimation();
  const cupRef = useRef<HTMLDivElement>(null);
  const lastPos = useRef({ x: 0, y: 0 });
  const dropId = useRef(0);

  const homeZone = { x: 60, y: 60 };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const velocityX = info.velocity.x;
    const tilt = Math.max(-45, Math.min(45, velocityX * 0.1));
    setCoffeeTilt(tilt);

    // Spill coffee based on tilt intensity
    if (Math.abs(tilt) > 15 && coffeeLevel > 0) {
      const spillAmount = Math.abs(tilt) * 0.05;
      setCoffeeLevel((prev) => Math.max(0, prev - spillAmount));

      // Create spill drops
      if (cupRef.current && Math.random() > 0.7) {
        const rect = cupRef.current.getBoundingClientRect();
        const dropX = tilt > 0 ? rect.right - 10 : rect.left + 10;
        const dropY = rect.top + 20;

        setSpillDrops((prev) => [
          ...prev,
          { id: dropId.current++, x: dropX, y: dropY },
        ]);
      }
    }

    lastPos.current = { x: info.point.x, y: info.point.y };
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    setCoffeeTilt(0);

    const cupElement = cupRef.current;
    if (!cupElement) return;

    const rect = cupElement.getBoundingClientRect();
    const cupCenterX = rect.left + rect.width / 2;
    const cupCenterY = rect.top + rect.height / 2;

    // Check if in home zone (top right corner)
    const isInHomeZone = cupCenterX > window.innerWidth - 150 && cupCenterY < 150;

    if (isInHomeZone) {
      // Snap back to corner
      controls.start({ x: 0, y: 0, rotate: 0 });
    } else {
      // Fall off screen
      setHasFallen(true);
      controls.start({
        y: window.innerHeight + 200,
        rotate: info.velocity.x > 0 ? 180 : -180,
        transition: { duration: 0.8, ease: "easeIn" },
      });
    }
  };

  // Clean up spill drops after animation
  useEffect(() => {
    if (spillDrops.length > 0) {
      const timer = setTimeout(() => {
        setSpillDrops((prev) => prev.slice(1));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [spillDrops]);

  // Reset cup after falling
  const resetCup = () => {
    setHasFallen(false);
    setCoffeeLevel(100);
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
      {/* Spill drops */}
      {spillDrops.map((drop) => (
        <motion.div
          key={drop.id}
          className="fixed w-2 h-2 rounded-full pointer-events-none z-40"
          style={{
            left: drop.x,
            top: drop.y,
            backgroundColor: "rgba(101, 67, 33, 0.8)",
          }}
          initial={{ scale: 1, y: 0 }}
          animate={{ scale: 0, y: 200, opacity: 0 }}
          transition={{ duration: 1, ease: "easeIn" }}
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
        whileDrag={{ scale: 1.1 }}
      >
        <motion.div
          animate={{ rotate: coffeeTilt }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="relative"
        >
          {/* Cup body */}
          <div
            className="relative w-12 h-14 rounded-b-xl border-2 overflow-hidden"
            style={{
              borderColor: "rgba(150, 150, 150, 0.5)",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(4px)",
            }}
          >
            {/* Coffee liquid */}
            <motion.div
              className="absolute bottom-0 left-0 right-0"
              style={{
                backgroundColor: "rgba(101, 67, 33, 0.7)",
                height: `${coffeeLevel}%`,
              }}
              animate={{
                skewX: coffeeTilt * 0.5,
              }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            />
          </div>

          {/* Cup handle */}
          <div
            className="absolute top-2 -right-3 w-3 h-6 rounded-r-full border-2"
            style={{
              borderColor: "rgba(150, 150, 150, 0.5)",
              borderLeft: "none",
              backgroundColor: "transparent",
            }}
          />
        </motion.div>
      </motion.div>
    </>
  );
}
