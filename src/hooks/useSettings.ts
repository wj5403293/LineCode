import { useState, useEffect } from 'react';
import { settingsService, DisplayMode, ToneMode, ReasoningEffort, PermissionMode } from '../services/settings';

export function useSettings() {
  const [codeWrap, setCodeWrap] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('fullscreen');
  const [toneMode, setToneMode] = useState<ToneMode>('coding');
  const [thinkingScrollable, setThinkingScrollable] = useState(true);
  const [thinkingAutoExpand, setThinkingAutoExpand] = useState(false);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>('medium');
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('auto');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      settingsService.getCodeWrap(),
      settingsService.getDisplayMode(),
      settingsService.getToneMode(),
      settingsService.getThinkingScroll(),
      settingsService.getThinkingAutoExpand(),
      settingsService.getReasoningEffort(),
      settingsService.getPermissionMode(),
    ]).then(([wrap, display, tone, scroll, autoExpand, effort, perm]) => {
      setCodeWrap(wrap);
      setDisplayMode(display);
      setToneMode(tone);
      setThinkingScrollable(scroll);
      setThinkingAutoExpand(autoExpand);
      setReasoningEffort(effort);
      setPermissionMode(perm);
      setLoaded(true);
    });
  }, []);

  return { codeWrap, displayMode, toneMode, thinkingScrollable, thinkingAutoExpand, reasoningEffort, permissionMode, loaded };
}
