import { ChatMessage } from '../StreamProcessor';

export interface OpenAIMessageFormatOptions {
  includeReasoning: boolean;
  padMissingToolCallReasoning: boolean;
}

export class OpenAIMessageFormatter {
  format(messages: ChatMessage[], options: OpenAIMessageFormatOptions): Record<string, unknown>[] {
    return messages.map(m => {
      if (m.role === 'system') {
        return { role: 'system', content: m.content };
      }
      if (m.role === 'tool') {
        return { role: 'tool', tool_call_id: m.toolCallId, content: this.formatToolResultContent(m) };
      }
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        return this.formatAssistantToolCallMessage(m, options);
      }
      if (m.role === 'assistant') {
        return this.formatAssistantMessage(m, options);
      }
      return { role: 'user', content: m.content };
    });
  }

  private formatAssistantToolCallMessage(
    message: ChatMessage,
    options: OpenAIMessageFormatOptions,
  ): Record<string, unknown> {
    const validToolCalls = message.toolCalls?.filter(tc => tc.id && tc.name) || [];
    const msg: Record<string, unknown> = {
      role: 'assistant',
      content: message.content || '',
      tool_calls: validToolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.arguments },
      })),
    };

    this.addReasoningFields(msg, message, options);
    if (options.includeReasoning && options.padMissingToolCallReasoning && msg.reasoning_content === undefined) {
      msg.reasoning_content = ' ';
    }

    return validToolCalls.length > 0 ? msg : { role: 'assistant', content: message.content || '' };
  }

  private formatAssistantMessage(
    message: ChatMessage,
    options: OpenAIMessageFormatOptions,
  ): Record<string, unknown> {
    const msg: Record<string, unknown> = { role: 'assistant', content: message.content };
    this.addReasoningFields(msg, message, options);
    return msg;
  }

  private addReasoningFields(
    target: Record<string, unknown>,
    message: ChatMessage,
    options: OpenAIMessageFormatOptions,
  ): void {
    if (!options.includeReasoning) return;

    const reasoningContent = this.getReasoningContent(message);
    if (reasoningContent) {
      target.reasoning_content = reasoningContent;
    }
    if (message.reasoningDetails) {
      target.reasoning_details = message.reasoningDetails;
    }
  }

  private getReasoningContent(message: ChatMessage): string | undefined {
    if (message.reasoningContent) return message.reasoningContent;
    const legacyReasoning = (message as { reasoning?: unknown }).reasoning;
    return typeof legacyReasoning === 'string' && legacyReasoning ? legacyReasoning : undefined;
  }

  private formatToolResultContent(message: ChatMessage): string {
    if (!message.isError) return message.content;
    return `Tool ${message.toolName || message.toolCallId || ''} failed:\n${message.content}`;
  }
}
