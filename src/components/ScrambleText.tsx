"use client";

import { useEffect, useState } from "react";

const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

interface ScrambleTextProps {
  text: string;
  className?: string;
}

export default function ScrambleText({ text, className }: ScrambleTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    let iteration = 0;
    const totalIterations = text.length * 3;

    const interval = setInterval(() => {
      setDisplayText(
        text
          .split("")
          .map((char, index) => {
            if (char === " ") return " ";
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
      }
    }, 40);

    return () => clearInterval(interval);
  }, [text]);

  const handleMouseEnter = () => {
    setIsHovering(true);
    let iteration = 0;
    const totalIterations = text.length * 2;

    const interval = setInterval(() => {
      setDisplayText(
        text
          .split("")
          .map((char, index) => {
            if (char === " ") return " ";
            if (index < iteration / 2) {
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
        setIsHovering(false);
      }
    }, 30);
  };

  return (
    <span
      className={className}
      onMouseEnter={handleMouseEnter}
      style={{ cursor: "default" }}
    >
      {displayText}
    </span>
  );
}
