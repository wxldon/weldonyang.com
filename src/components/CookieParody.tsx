"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function CookieParody() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(true);
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  const handleChoice = (choice: "yes" | "no") => {
    setDismissed(true);
    setTimeout(() => setShow(false), 300);
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          className="fixed bottom-0 left-6 z-50"
          initial={{ y: -250, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -250, opacity: 0 }}
          transition={{ type: "spring", stiffness: 80, damping: 14 }}
        >
          <div
            className="border-x border-b px-10 py-8"
            style={{
              backgroundColor: "rgba(10, 10, 10, 0.85)",
              backdropFilter: "blur(20px)",
              borderColor: "rgba(139, 92, 246, 0.3)",
              boxShadow: "0 10px 40px rgba(139, 92, 246, 0.15), 0 0 80px rgba(139, 92, 246, 0.05)",
            }}
          >
            {/* Title */}
            <p className="text-base mb-2 opacity-90 text-center">
              Cookie Request 🍪
            </p>

            {/* Question */}
            <p className="text-sm mb-6 opacity-60 max-w-[400px] text-center">
              Allow Weldon to have some cookies?
            </p>

            {/* Buttons */}
            <div className="flex flex-row gap-3">
              <motion.button
                onClick={() => handleChoice("yes")}
                className="px-5 py-2.5 text-xs border transition-all"
                style={{
                  borderColor: "rgba(139, 92, 246, 0.6)",
                  backgroundColor: "rgba(139, 92, 246, 0.15)",
                  color: "#a78bfa",
                }}
                whileHover={{
                  backgroundColor: "rgba(139, 92, 246, 0.3)",
                  scale: 1.02,
                }}
                whileTap={{ scale: 0.98 }}
              >
                Eat up king
              </motion.button>
              <motion.button
                onClick={() => handleChoice("no")}
                className="px-5 py-2.5 text-xs border transition-all opacity-50 hover:opacity-80"
                style={{
                  borderColor: "rgba(255, 255, 255, 0.15)",
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Beat it fatty
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
