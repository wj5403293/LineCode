import { useEffect, useRef, useState } from 'react';

const DEFAULT_INTERVAL_MS = 16;

function nextStep(backlog: number): number {
  if (backlog > 240) return 12;
  if (backlog > 120) return 8;
  if (backlog > 48) return 4;
  return 1;
}

export function useTypewriterText(
  text: string,
  enabled: boolean,
  intervalMs = DEFAULT_INTERVAL_MS,
): string {
  const [visibleText, setVisibleText] = useState(text);
  const visibleRef = useRef(text);
  const targetRef = useRef(text);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stop = () => {
      if (!timerRef.current) return;
      clearInterval(timerRef.current);
      timerRef.current = null;
    };

    targetRef.current = text;

    if (!enabled) {
      stop();
      visibleRef.current = text;
      setVisibleText(text);
      return stop;
    }

    if (!text.startsWith(visibleRef.current)) {
      visibleRef.current = text;
      setVisibleText(text);
      return stop;
    }

    if (visibleRef.current === text || timerRef.current) {
      return stop;
    }

    timerRef.current = setInterval(() => {
      const current = visibleRef.current;
      const target = targetRef.current;
      if (current === target) {
        stop();
        return;
      }

      const backlog = target.length - current.length;
      const nextLength = Math.min(target.length, current.length + nextStep(backlog));
      const nextText = target.slice(0, nextLength);
      visibleRef.current = nextText;
      setVisibleText(nextText);
    }, intervalMs);

    return stop;
  }, [text, enabled, intervalMs]);

  return visibleText;
}
