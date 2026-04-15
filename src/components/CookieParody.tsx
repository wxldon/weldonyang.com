"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ResponseState = null | "yes" | "no";

export default function CookieParody() {
  const [show, setShow] = useState(false);
  const [response, setResponse] = useState<ResponseState>(null);
  const [cardSize, setCardSize] = useState<{ w: number; h: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(true);
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  const handleChoice = (choice: "yes" | "no") => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setCardSize({ w: rect.width, h: rect.height });
    }
    setResponse(choice);
    setTimeout(() => setShow(false), 1800);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed bottom-5 left-5 z-50"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
        >
          <div
            ref={cardRef}
            className="relative rounded-2xl px-7 py-6 overflow-hidden"
            style={{
              backgroundColor: "rgba(12, 12, 14, 0.88)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(139, 92, 246, 0.2)",
              boxShadow:
                "0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(139, 92, 246, 0.08), 0 0 80px rgba(139, 92, 246, 0.06)",
              maxWidth: 340,
              ...(cardSize ? { minWidth: cardSize.w, minHeight: cardSize.h } : {}),
            }}
          >
            {/* Subtle gradient glow at top */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.5), transparent)",
              }}
            />

            <AnimatePresence mode="wait">
              {response === null ? (
                <motion.div
                  key="question"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Cookie icon */}
                  <motion.div
                    className="text-center mb-3"
                    animate={{
                      rotate: [0, -8, 8, -4, 0],
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      repeatDelay: 3,
                      ease: "easeInOut",
                    }}
                  >
                    <span className="text-4xl select-none">🍪</span>
                  </motion.div>

                  {/* Title */}
                  <p
                    className="text-base font-bold tracking-wide text-center mb-1"
                    style={{ color: "#e2e0e7" }}
                  >
                    Cookie Request
                  </p>

                  {/* Question */}
                  <p
                    className="text-sm text-center mb-5 leading-relaxed"
                    style={{ color: "rgba(255, 255, 255, 0.5)" }}
                  >
                    Allow Weldon to have some cookies?
                  </p>

                  {/* Buttons */}
                  <div className="flex flex-col gap-2.5">
                    <motion.button
                      onClick={() => handleChoice("yes")}
                      className="w-full px-5 py-2.5 text-sm font-bold tracking-wide rounded-lg transition-all cursor-pointer"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(139, 92, 246, 0.35), rgba(109, 40, 217, 0.45))",
                        border: "1px solid rgba(139, 92, 246, 0.5)",
                        color: "#c4b5fd",
                      }}
                      whileHover={{
                        background:
                          "linear-gradient(135deg, rgba(139, 92, 246, 0.5), rgba(109, 40, 217, 0.6))",
                        scale: 1.02,
                        boxShadow: "0 4px 20px rgba(139, 92, 246, 0.25)",
                      }}
                      whileTap={{ scale: 0.97 }}
                    >
                      Eat up king 👑
                    </motion.button>
                    <motion.button
                      onClick={() => handleChoice("no")}
                      className="w-full px-5 py-2.5 text-sm tracking-wide rounded-lg transition-all cursor-pointer"
                      style={{
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        color: "rgba(255, 255, 255, 0.4)",
                      }}
                      whileHover={{
                        background: "rgba(255, 255, 255, 0.08)",
                        color: "rgba(255, 255, 255, 0.6)",
                        scale: 1.02,
                      }}
                      whileTap={{ scale: 0.97 }}
                    >
                      Beat it fatty
                    </motion.button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="response"
                  className="flex flex-col items-center justify-center"
                  style={{
                    minHeight: cardSize ? cardSize.h - 48 : "auto",
                  }}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 20,
                  }}
                >
                  <motion.span
                    className="text-4xl block mb-3 select-none"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.4 }}
                  >
                    {response === "yes" ? "😋" : "😔"}
                  </motion.span>
                  <p
                    className="text-sm font-bold"
                    style={{
                      color:
                        response === "yes" ? "#c4b5fd" : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {response === "yes"
                      ? "Cookies secured. Thank you."
                      : "Fine... no cookies then."}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
