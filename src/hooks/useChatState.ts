import { ToneMode, ReasoningEffort } from '../services/settings';
import { useChatController } from '../chat/useChatController';

export function useChatState(
  toneMode: ToneMode,
  reasoningEffort: ReasoningEffort,
  preserveReasoning: boolean,
) {
  const chat = useChatController({ toneMode, reasoningEffort, preserveReasoning });

  return {
    ...chat.state,
    ...chat.actions,
    ...chat.list,
  };
}

export type UseChatStateReturn = ReturnType<typeof useChatState>;
