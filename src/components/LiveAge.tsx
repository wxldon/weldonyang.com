"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const BIRTHDATE = new Date("2000-05-09T03:00:00").getTime();

interface LiveAgeProps {
  show: boolean;
}

export default function LiveAge({ show }: LiveAgeProps) {
  const [age, setAge] = useState<string>("");

  useEffect(() => {
    if (!show) return;

    const updateAge = () => {
      const now = Date.now();
      const ageInMs = now - BIRTHDATE;
      const ageInYears = ageInMs / (1000 * 60 * 60 * 24 * 365.25);
      setAge(ageInYears.toFixed(8));
    };

    updateAge();
    const interval = setInterval(updateAge, 50);

    return () => clearInterval(interval);
  }, [show]);

  if (!show) return null;

  return (
    <motion.p
      className="mt-4 text-lg tracking-wide opacity-70"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 0.7, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {age} year old developer.
    </motion.p>
  );
}
