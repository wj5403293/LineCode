import { createContext, useContext } from 'react';
import type { Message } from '../types';
import type { DisplayMode } from '../services/settings';

export interface MessageActionsValue {
  codeWrap?: boolean;
  displayMode?: DisplayMode;
  mathFormulaRenderingEnabled?: boolean;
  thinkingAutoExpand?: boolean;
  thinkingScrollable?: boolean;
  homePath?: string;
  shellConfirmToolCallId?: string;
  onShellCancel?: () => void;
  onShellConfirm?: () => void;
  onShellDefaultExecute?: () => void;
  onViewShellCommand?: (command: string) => void;
  onToolReview?: (toolCallId: string, state: 'accepted' | 'rejected', diffId?: string) => void;
  onRecallUserMessage?: (message: Message) => void;
}

export const MessageActionsContext = createContext<MessageActionsValue>({});

export function useMessageActions(): MessageActionsValue {
  return useContext(MessageActionsContext);
}
