import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TypingTextProps {
  lines: string[];
  speed?: number;
  delay?: number;
  loop?: boolean;
  className?: string;
  cursorClassName?: string;
}

const TypingText = ({ lines, speed = 80, delay = 1500, loop = true, className = "", cursorClassName = "" }: TypingTextProps) => {
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [displayText, setDisplayText] = useState("");

  const currentLine = lines[lineIndex] || "";

  useEffect(() => {
    if (lines.length === 0) return;

    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting && charIndex <= currentLine.length) {
      // Typing
      setDisplayText(currentLine.slice(0, charIndex));
      if (charIndex === currentLine.length) {
        // Finished typing, wait then delete
        timeout = setTimeout(() => setIsDeleting(true), delay);
      } else {
        timeout = setTimeout(() => setCharIndex(c => c + 1), speed);
      }
    } else if (isDeleting && charIndex >= 0) {
      // Deleting
      setDisplayText(currentLine.slice(0, charIndex));
      if (charIndex === 0) {
        setIsDeleting(false);
        const nextIndex = lineIndex + 1;
        if (nextIndex >= lines.length) {
          if (loop) {
            setLineIndex(0);
          }
          // If not loop, stop
        } else {
          setLineIndex(nextIndex);
        }
      } else {
        timeout = setTimeout(() => setCharIndex(c => c - 1), speed / 2);
      }
    }

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, currentLine, lines, lineIndex, speed, delay, loop]);

  // Reset charIndex when lineIndex changes
  useEffect(() => {
    setCharIndex(0);
    setIsDeleting(false);
  }, [lineIndex]);

  return (
    <span className={className}>
      {displayText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
        className={`inline-block w-[2px] h-[1em] bg-primary ml-0.5 align-middle ${cursorClassName}`}
      />
    </span>
  );
};

export default TypingText;
