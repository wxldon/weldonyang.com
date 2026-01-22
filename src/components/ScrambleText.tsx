"use client";

import { useEffect, useState, useRef } from "react";

const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const preserveChars = [" ", "[", "]"];

interface ScrambleTextProps {
  text: string;
  className?: string;
  onComplete?: () => void;
}

export default function ScrambleText({ text, className, onComplete }: ScrambleTextProps) {
  const hasScrambled = useRef(false);
  const [displayText, setDisplayText] = useState(
    text.split("").map((char) => (preserveChars.includes(char) ? char : characters[Math.floor(Math.random() * characters.length)])).join("")
  );

  useEffect(() => {
    if (hasScrambled.current) return;
    hasScrambled.current = true;

    const duration = 2000;
    const intervalTime = duration / (text.length * 3);
    let iteration = 0;
    const totalIterations = text.length * 3;

    const interval = setInterval(() => {
      setDisplayText(
        text
          .split("")
          .map((char, index) => {
            if (preserveChars.includes(char)) return char;
            if (index < iteration / 3) {
              return text[index];
            }
            return characters[Math.floor(Math.random() * characters.length)];
          })
          .join("")
      );

      iteration += 1;

      if (iteration > totalIterations) {
        clearInterval(interval);
        setDisplayText(text);
        onComplete?.();
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [text, onComplete]);

  return (
    <span className={className}>
      {displayText}
    </span>
  );
}
