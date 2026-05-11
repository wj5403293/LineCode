import { Model, ContentBlock, ToolCall } from '../../../types';
import { StreamProcessor, StreamCallbacks, StreamOptions, StreamResult, ChatMessage } from './StreamProcessor';
import { ReasoningEffort } from '../../settings';

export class OpenAIStreamProcessor extends StreamProcessor {
  async process(
    model: Model,
    messages: ChatMessage[],
    tools: Record<string, unknown>[],
    callbacks?: StreamCallbacks,
    options?: StreamOptions,
  ): Promise<StreamResult> {
    const baseUrl = model.baseUrl || 'https://api.openai.com/v1';
    const reasoningEffort = options?.reasoningEffort || 'medium';
    const abortSignal = options?.abortSignal;

    const body: any = {
      model: model.modelId,
      messages: this.formatMessages(messages),
      stream: true,
    };

    const isDeepSeek = baseUrl.includes('deepseek') || model.modelId.includes('deepseek');
    console.log('[LineCode] OpenAI isDeepSeek:', isDeepSeek, 'reasoningEffort:', reasoningEffort);
    
    if (reasoningEffort !== 'off') {
      if (isDeepSeek) {
        body.thinking = { type: 'enabled' };
        if (reasoningEffort === 'high' || reasoningEffort === 'max') {
          body.reasoning_effort = reasoningEffort;
        }
      } else {
        body.reasoning = { effort: reasoningEffort };
      }
    }

    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    console.log('[LineCode] OpenAI request body:', JSON.stringify(body, null, 2)?.substring(0, 500));

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: abortSignal,
    });

    console.log('[LineCode] OpenAI request messages:', body.messages.length);
    body.messages.forEach((msg: any, i: number) => {
      console.log(`[LineCode] Message ${i}:`, JSON.stringify(msg).substring(0, 200));
    });
    console.log('[LineCode] OpenAI HTTP response status:', res.status, res.statusText);

    if (!res.ok) {
      let errText = '';
      try {
        const errJson = await res.json();
        errText = errJson?.error?.message || JSON.stringify(errJson);
      } catch {
        errText = await res.text();
      }
      throw new Error(`OpenAI ${res.status}: ${errText}`);
    }

    return this.readStream(res, callbacks, abortSignal);
  }

  private formatMessages(messages: ChatMessage[]): any[] {
    return messages.map(m => {
      if (m.role === 'system') {
        return { role: 'system', content: m.content };
      }
      if (m.role === 'tool') {
        return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
      }
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        const msg: any = {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.arguments },
          })),
        };
        if (m.reasoningContent) {
          console.log('[LineCode] Adding reasoning_content to message:', m.reasoningContent.substring(0, 50));
          msg.reasoning_content = m.reasoningContent;
        }
        return msg;
      }
      if (m.role === 'assistant' && m.reasoningContent) {
        return { role: 'assistant', content: m.content, reasoning_content: m.reasoningContent };
      }
      return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
    });
  }

  private async readStream(
    res: Response,
    callbacks?: StreamCallbacks,
    abortSignal?: AbortSignal,
  ): Promise<StreamResult> {
    const reader = this.createReader(res);
    const decoder = this.createDecoder();
    let full = '';
    let reasoningFull = '';
    let buffer = '';
    const blocks: ContentBlock[] = [{ type: 'text', content: '' }];
    const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>();

    try {
      while (true) {
        if (abortSignal?.aborted) {
          reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        console.log('[LineCode] OpenAI Stream read - done:', done, 'value length:', value?.length || 0);
        if (done) {
          console.log('[LineCode] OpenAI Stream done');
          console.log('[LineCode] - blocks:', blocks.length);
          console.log('[LineCode] - toolCallsMap:', toolCallsMap.size);
          console.log('[LineCode] - full text:', full.substring(0, 100) || '(empty)');
          console.log('[LineCode] - reasoningFull:', reasoningFull.substring(0, 100) || '(empty)');
          break;
        }

        const decoded = decoder.decode(value, { stream: true });
        console.log('[LineCode] OpenAI Stream raw:', decoded.substring(0, 300));
        buffer += decoded;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        console.log('[LineCode] OpenAI Stream lines:', lines.length);

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const json = JSON.parse(line.slice(6));
              const delta = json.choices?.[0]?.delta;
              console.log('[LineCode] delta:', JSON.stringify(delta).substring(0, 100));

              if (typeof delta?.reasoning_content === 'string' && delta.reasoning_content.length > 0) {
                console.log('[LineCode] Captured reasoning_content:', delta.reasoning_content.substring(0, 20));
                reasoningFull += delta.reasoning_content;
              }

              if (delta?.content) {
                full += delta.content;
                blocks[blocks.length - 1].content = full;
                callbacks?.onBlocks?.(blocks.map(b => ({ ...b })));
              }

              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0;
                  if (!toolCallsMap.has(idx)) {
                    toolCallsMap.set(idx, { id: tc.id || '', name: '', arguments: '' });
                  }
                  const existing = toolCallsMap.get(idx)!;
                  if (tc.id) existing.id = tc.id;
                  if (tc.function?.name) {
                    existing.name = tc.function.name;
                    callbacks?.onToolCallDetected?.({ id: existing.id, name: existing.name });
                  }
                  if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                }
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[LineCode] OpenAI Stream aborted by user');
      } else {
        throw err;
      }
    }

    const toolCalls = toolCallsMap.size > 0
      ? Array.from(toolCallsMap.values()).map(tc => ({
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments,
        }))
      : [];

    if (toolCalls.length > 0) {
      callbacks?.onToolCalls?.(toolCalls);
      for (const tc of toolCalls) {
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          content: tc.arguments,
        });
      }
    }

    return { text: full, blocks, toolCalls: toolCalls.length > 0 ? toolCalls : undefined, reasoningContent: reasoningFull || undefined };
  }
}
