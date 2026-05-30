import { ChatMessage } from './processors/StreamProcessor';

function uniqueToolCalls(toolCalls: NonNullable<ChatMessage['toolCalls']>): NonNullable<ChatMessage['toolCalls']> {
  const seen = new Set<string>();
  const unique: NonNullable<ChatMessage['toolCalls']> = [];
  for (const toolCall of toolCalls) {
    if (!toolCall.id || !toolCall.name || seen.has(toolCall.id)) continue;
    seen.add(toolCall.id);
    unique.push(toolCall);
  }
  return unique;
}

function asPlainAssistant(message: ChatMessage): ChatMessage | null {
  if (!message.content.trim()) return null;
  return {
    ...message,
    toolCalls: undefined,
  };
}

export function normalizeToolProtocolMessages(messages: ChatMessage[]): ChatMessage[] {
  const normalized: ChatMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    if (message.role === 'tool') {
      continue;
    }

    if (message.role !== 'assistant' || !message.toolCalls?.length) {
      normalized.push(message);
      continue;
    }

    const toolCalls = uniqueToolCalls(message.toolCalls);
    if (toolCalls.length === 0) {
      const plainAssistant = asPlainAssistant(message);
      if (plainAssistant) normalized.push(plainAssistant);
      continue;
    }

    const toolCallIds = new Set(toolCalls.map(toolCall => toolCall.id));
    const toolResultsById = new Map<string, ChatMessage>();
    let nextIndex = i + 1;

    while (nextIndex < messages.length && messages[nextIndex].role === 'tool') {
      const toolResult = messages[nextIndex];
      if (
        toolResult.toolCallId &&
        toolCallIds.has(toolResult.toolCallId) &&
        !toolResultsById.has(toolResult.toolCallId)
      ) {
        toolResultsById.set(toolResult.toolCallId, toolResult);
      }
      nextIndex++;
    }

    if (toolCalls.every(toolCall => toolResultsById.has(toolCall.id))) {
      normalized.push({
        ...message,
        toolCalls,
      });
      for (const toolCall of toolCalls) {
        normalized.push(toolResultsById.get(toolCall.id)!);
      }
    } else {
      const plainAssistant = asPlainAssistant(message);
      if (plainAssistant) normalized.push(plainAssistant);
    }

    i = nextIndex - 1;
  }

  return normalized;
}
