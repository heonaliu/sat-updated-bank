import { useEffect, useRef, useState } from 'react';

const FLUSH_INTERVAL_MS = 5000;

// Tracks time spent on one question, ticking every second for display and
// periodically flushing the accumulated delta (plus one final flush on
// unmount/question-change) via onFlush(totalSeconds) so progress already
// logged survives leaving and returning to a question later. Pass
// paused=true (e.g. once the answer is checked) to freeze the timer at its
// current value; flipping it back to false (e.g. "Clear response & try
// again") resumes counting from there.
export function useQuestionTimer(sessionKey, initialSeconds, onFlush, paused) {
  const [displaySec, setDisplaySec] = useState(initialSeconds);
  const baseRef = useRef(initialSeconds);
  const startRef = useRef(Date.now());
  const onFlushRef = useRef(onFlush);
  onFlushRef.current = onFlush;

  useEffect(() => {
    if (!sessionKey || paused) {
      setDisplaySec(initialSeconds);
      return undefined;
    }

    baseRef.current = initialSeconds;
    startRef.current = Date.now();
    setDisplaySec(initialSeconds);

    const tick = setInterval(() => {
      setDisplaySec(baseRef.current + Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);

    const flush = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      if (elapsed > 0) {
        baseRef.current += elapsed;
        startRef.current = Date.now();
        onFlushRef.current(baseRef.current);
      }
    }, FLUSH_INTERVAL_MS);

    return () => {
      clearInterval(tick);
      clearInterval(flush);
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      if (elapsed > 0) onFlushRef.current(baseRef.current + elapsed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-arm only when the question or paused state changes
  }, [sessionKey, paused]);

  return displaySec;
}

export function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
