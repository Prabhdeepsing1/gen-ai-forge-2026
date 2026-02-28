import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Reveals text word-by-word with a configurable delay.
 * Used to slow down chat responses that arrive all at once.
 *
 * @param delayMs  – ms between each word (default 30)
 */
export function useTypewriter(delayMs = 30) {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const cancelRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  /** Start revealing `fullText` word-by-word. Returns a Promise that resolves when done. */
  const typewrite = useCallback(
    (fullText: string): Promise<string> => {
      cancelRef.current = false;
      setIsTyping(true);
      setDisplayedText("");

      const words = fullText.split(/(\s+)/); // keeps whitespace as separate items
      let idx = 0;
      let buffer = "";

      return new Promise<string>((resolve) => {
        const tick = () => {
          if (cancelRef.current || idx >= words.length) {
            setDisplayedText(fullText); // ensure final state is complete
            setIsTyping(false);
            resolve(fullText);
            return;
          }

          // Reveal 1-3 words per tick for natural pacing
          const chunk = Math.min(2, words.length - idx);
          for (let c = 0; c < chunk; c++) {
            buffer += words[idx++];
          }
          setDisplayedText(buffer);
          timerRef.current = setTimeout(tick, delayMs);
        };
        tick();
      });
    },
    [delayMs]
  );

  /** Stop the typewriter immediately (shows full text) */
  const cancel = useCallback(() => {
    cancelRef.current = true;
    clearTimeout(timerRef.current);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => cancel(), [cancel]);

  return { displayedText, isTyping, typewrite, cancel };
}
