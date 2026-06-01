import { useEffect, useRef, useState } from 'react';

const DEFAULT_INTERVAL_MS = 48;
const MAX_ANIMATED_CONTENT_LENGTH = 4000;

function nextStep(backlog: number, targetLength: number): number {
  if (targetLength > 3000) return Math.max(48, Math.ceil(backlog * 0.3));
  if (targetLength > 1800) return Math.max(24, Math.ceil(backlog * 0.22));
  if (backlog > 240) return 12;
  if (backlog > 120) return 8;
  if (backlog > 48) return 4;
  return Math.min(backlog, 2);
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
    const commitVisibleText = (nextText: string) => {
      if (visibleRef.current === nextText) return;
      visibleRef.current = nextText;
      setVisibleText(prev => prev === nextText ? prev : nextText);
    };

    targetRef.current = text;

    if (!enabled || text.length > MAX_ANIMATED_CONTENT_LENGTH) {
      stop();
      commitVisibleText(text);
      return stop;
    }

    if (!text.startsWith(visibleRef.current)) {
      commitVisibleText(text);
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
      const nextLength = Math.min(target.length, current.length + nextStep(backlog, target.length));
      const nextText = target.slice(0, nextLength);
      commitVisibleText(nextText);
    }, intervalMs);

    return stop;
  }, [text, enabled, intervalMs]);

  return visibleText;
}
