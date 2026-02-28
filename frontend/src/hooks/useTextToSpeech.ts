import { useState, useCallback, useRef } from "react";

/**
 * Hook wrapping the browser SpeechSynthesis API for text-to-speech.
 */
export function useTextToSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  /** Strip markdown formatting so spoken text sounds natural */
  const stripMarkdown = (md: string): string =>
    md
      .replace(/```[\s\S]*?```/g, "code block omitted")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/#{1,6}\s+/g, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^[-*+]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .trim();

  /** Speak the given text. Pass an id to track which message is speaking. */
  const speak = useCallback((text: string, id?: string) => {
    // Cancel any current speech first
    window.speechSynthesis.cancel();

    const plain = stripMarkdown(text);
    if (!plain) return;

    const utt = new SpeechSynthesisUtterance(plain);
    utt.rate = 1.0;
    utt.pitch = 1.0;

    // Prefer a good English voice (Google UK English / Microsoft Zira, etc.)
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Google") || v.name.includes("Microsoft") || v.name.includes("Samantha"))
    );
    if (preferred) utt.voice = preferred;

    utt.onend = () => {
      setSpeaking(false);
      setSpeakingId(null);
    };
    utt.onerror = () => {
      setSpeaking(false);
      setSpeakingId(null);
    };

    utteranceRef.current = utt;
    setSpeaking(true);
    setSpeakingId(id ?? null);
    window.speechSynthesis.speak(utt);
  }, []);

  /** Stop speaking */
  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setSpeakingId(null);
  }, []);

  return { speaking, speakingId, speak, stop };
}
