import { useState, useEffect, useCallback } from 'react';
import { settingsService, DisplayMode, ToneMode, ReasoningEffort, PermissionMode, MCPExecutionMode } from '../services/settings';

export function useSettings() {
  const [codeWrap, setCodeWrap] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('fullscreen');
  const [toneMode, setToneMode] = useState<ToneMode>('coding');
  const [thinkingScrollable, setThinkingScrollable] = useState(true);
  const [thinkingAutoExpand, setThinkingAutoExpand] = useState(false);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>('medium');
  const [preserveReasoning, setPreserveReasoning] = useState(false);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('auto');
  const [mcpExecutionMode, setMcpExecutionMode] = useState<MCPExecutionMode>('local');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      settingsService.getCodeWrap(),
      settingsService.getDisplayMode(),
      settingsService.getToneMode(),
      settingsService.getThinkingScroll(),
      settingsService.getThinkingAutoExpand(),
      settingsService.getReasoningEffort(),
      settingsService.getPreserveReasoning(),
      settingsService.getPermissionMode(),
      settingsService.getMCPExecutionMode(),
    ]).then(([wrap, display, tone, scroll, autoExpand, effort, preserve, perm, executionMode]) => {
      setCodeWrap(wrap);
      setDisplayMode(display);
      setToneMode(tone);
      setThinkingScrollable(scroll);
      setThinkingAutoExpand(autoExpand);
      setReasoningEffort(effort);
      setPreserveReasoning(preserve);
      setPermissionMode(perm);
      setMcpExecutionMode(executionMode);
      setLoaded(true);
    });
  }, []);

  const updatePermissionMode = useCallback(async (mode: PermissionMode) => {
    await settingsService.setPermissionMode(mode);
    setPermissionMode(mode);
  }, []);

  const updateMCPExecutionMode = useCallback(async (mode: MCPExecutionMode) => {
    await settingsService.setMCPExecutionMode(mode);
    setMcpExecutionMode(mode);
  }, []);

  return {
    codeWrap,
    displayMode,
    toneMode,
    thinkingScrollable,
    thinkingAutoExpand,
    reasoningEffort,
    preserveReasoning,
    permissionMode,
    mcpExecutionMode,
    updatePermissionMode,
    updateMCPExecutionMode,
    loaded,
  };
}
