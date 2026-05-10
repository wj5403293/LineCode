import { useState, useEffect } from 'react';
import { settingsService, DisplayMode, ToneMode } from '../services/settings';

export function useSettings() {
  const [codeWrap, setCodeWrap] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('fullscreen');
  const [toneMode, setToneMode] = useState<ToneMode>('coding');
  const [thinkingScrollable, setThinkingScrollable] = useState(true);
  const [thinkingAutoExpand, setThinkingAutoExpand] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      settingsService.getCodeWrap(),
      settingsService.getDisplayMode(),
      settingsService.getToneMode(),
      settingsService.getThinkingScroll(),
      settingsService.getThinkingAutoExpand(),
    ]).then(([wrap, display, tone, scroll, autoExpand]) => {
      setCodeWrap(wrap);
      setDisplayMode(display);
      setToneMode(tone);
      setThinkingScrollable(scroll);
      setThinkingAutoExpand(autoExpand);
      setLoaded(true);
    });
  }, []);

  return { codeWrap, displayMode, toneMode, thinkingScrollable, thinkingAutoExpand, loaded };
}
