"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function CookieParody() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Show after a delay when page loads
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
          className="fixed top-0 left-4 z-50"
          initial={{ y: -200, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -200, opacity: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
        >
          <div
            className="border border-t-0 px-8 py-6"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(10px)",
              borderColor: "rgba(150, 150, 150, 0.3)",
              borderRadius: 0,
            }}
          >
            <p className="text-sm mb-5">
              Do you allow Weldon to have some cookies?
            </p>
            <div className="flex flex-row gap-3">
              <button
                onClick={() => handleChoice("yes")}
                className="px-4 py-2 text-xs border transition-colors hover:brightness-125"
                style={{
                  borderColor: "rgba(139, 92, 246, 0.5)",
                  backgroundColor: "rgba(139, 92, 246, 0.1)",
                  borderRadius: 0,
                }}
              >
                Yes, he&apos;s a good worker
              </button>
              <button
                onClick={() => handleChoice("no")}
                className="px-4 py-2 text-xs border transition-colors opacity-60 hover:opacity-100"
                style={{
                  borderColor: "rgba(150, 150, 150, 0.3)",
                  backgroundColor: "rgba(150, 150, 150, 0.05)",
                  borderRadius: 0,
                }}
              >
                No because I&apos;m selfish
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
