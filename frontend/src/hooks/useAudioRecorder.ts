import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Hook that wraps the browser MediaRecorder API.
 * Returns a Blob of audio/webm when the user stops recording.
 */
export function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const resolveRef = useRef<((blob: Blob) => void) | null>(null);

  // Tick the elapsed counter every second while recording
  useEffect(() => {
    if (recording) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [recording]);

  /** Start recording – returns a Promise<Blob> that resolves when stopped */
  const startRecording = useCallback((): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Pick best supported MIME
        const mimeType = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/ogg;codecs=opus",
          "audio/mp4",
        ].find((m) => MediaRecorder.isTypeSupported(m)) || "";

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];
        resolveRef.current = resolve;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          resolveRef.current?.(blob);
          resolveRef.current = null;
        };

        recorder.onerror = () => {
          stream.getTracks().forEach((t) => t.stop());
          reject(new Error("Recording failed"));
        };

        recorder.start(250); // collect data every 250ms
        setRecording(true);
      } catch (err) {
        reject(err);
      }
    });
  }, []);

  /** Stop the current recording (triggers the promise to resolve) */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  return { recording, elapsed, startRecording, stopRecording };
}
