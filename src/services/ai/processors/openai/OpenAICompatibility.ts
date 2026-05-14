import { ReasoningEffort } from '../../../settings';
import { ChatMessage } from '../StreamProcessor';
import { OpenAIMessageFormatOptions } from './OpenAIMessageFormatter';

export type OpenAICompatibleThinkingProvider =
  | 'deepseek'
  | 'kimi'
  | 'qwen'
  | 'glm'
  | 'minimax'
  | 'mimo'
  | 'unknown';

export interface ProviderCapabilities {
  provider: OpenAICompatibleThinkingProvider;
  requestStyle: 'thinking' | 'enable_thinking' | 'reasoning_split' | 'openai';
  supportsPreserveReasoning: boolean;
  requiresToolCallReasoningContent: boolean;
}

export class OpenAICompatibilityDetector {
  detect(baseUrl: string, modelId: string): ProviderCapabilities {
    const baseUrlLower = baseUrl.toLowerCase();
    const modelIdLower = modelId.toLowerCase();

    if (baseUrlLower.includes('deepseek') || modelIdLower.includes('deepseek')) {
      return this.capabilities('deepseek', 'thinking', true);
    }
    if (baseUrlLower.includes('moonshot') || baseUrlLower.includes('kimi') || modelIdLower.includes('kimi')) {
      return this.capabilities('kimi', 'thinking', true);
    }
    if (baseUrlLower.includes('dashscope') || baseUrlLower.includes('aliyuncs') || modelIdLower.includes('qwen')) {
      return this.capabilities('qwen', 'enable_thinking', true);
    }
    if (baseUrlLower.includes('bigmodel') || baseUrlLower.includes('zhipu') || modelIdLower.includes('glm')) {
      return this.capabilities('glm', 'thinking', true);
    }
    if (baseUrlLower.includes('minimax') || modelIdLower.includes('minimax') || modelIdLower.includes('abab') || modelIdLower.includes('m2')) {
      return this.capabilities('minimax', 'reasoning_split', true);
    }
    if (baseUrlLower.includes('mimo') || baseUrlLower.includes('xiaomi') || modelIdLower.includes('mimo')) {
      return this.capabilities('mimo', 'thinking', true, true);
    }
    return this.capabilities('unknown', 'openai', false);
  }

  private capabilities(
    provider: OpenAICompatibleThinkingProvider,
    requestStyle: ProviderCapabilities['requestStyle'],
    supportsPreserveReasoning: boolean,
    requiresToolCallReasoningContent = false,
  ): ProviderCapabilities {
    return {
      provider,
      requestStyle,
      supportsPreserveReasoning,
      requiresToolCallReasoningContent,
    };
  }
}

export class OpenAIReasoningRequestAdapter {
  getMessageFormatOptions(
    capabilities: ProviderCapabilities,
    messages: ChatMessage[],
    reasoningEffort: ReasoningEffort,
    preserveReasoning: boolean,
  ): OpenAIMessageFormatOptions {
    const thinkingRequested = reasoningEffort !== 'off';
    const hasToolExchange = messages.some(m =>
      m.role === 'tool' || (m.role === 'assistant' && !!m.toolCalls?.length)
    );
    const includeReasoning =
      capabilities.requiresToolCallReasoningContent ||
      (
        thinkingRequested &&
        capabilities.supportsPreserveReasoning &&
        (
          (preserveReasoning && !hasToolExchange) ||
          capabilities.provider === 'deepseek'
        )
      );

    return {
      includeReasoning,
      padMissingToolCallReasoning: capabilities.requiresToolCallReasoningContent,
    };
  }

  applyRequestReasoning(
    body: Record<string, unknown>,
    capabilities: ProviderCapabilities,
    reasoningEffort: ReasoningEffort,
    shouldPreserveReasoning: boolean,
  ): void {
    if (capabilities.requestStyle === 'thinking') {
      body.thinking = { type: reasoningEffort === 'off' ? 'disabled' : 'enabled' };
      this.applyReasoningEffort(body, capabilities.provider, reasoningEffort);
      if (shouldPreserveReasoning && capabilities.provider === 'kimi') {
        (body.thinking as Record<string, unknown>).keep = 'all';
      }
      if (shouldPreserveReasoning && capabilities.provider === 'glm') {
        body.clear_thinking = false;
      }
      return;
    }

    if (capabilities.requestStyle === 'enable_thinking') {
      body.enable_thinking = reasoningEffort !== 'off';
      this.applyReasoningEffort(body, capabilities.provider, reasoningEffort);
      if (shouldPreserveReasoning) {
        body.preserve_thinking = true;
      }
      return;
    }

    if (capabilities.requestStyle === 'reasoning_split') {
      body.reasoning_split = reasoningEffort !== 'off';
      return;
    }

    if (reasoningEffort !== 'off') {
      body.reasoning = { effort: reasoningEffort };
    }
  }

  private applyReasoningEffort(
    body: Record<string, unknown>,
    provider: OpenAICompatibleThinkingProvider,
    reasoningEffort: ReasoningEffort,
  ): void {
    if (reasoningEffort === 'off') return;

    if (provider === 'deepseek') {
      body.reasoning_effort = reasoningEffort === 'max' ? 'max' : 'high';
      return;
    }

    if (provider === 'qwen') {
      const budgetMap: Record<Exclude<ReasoningEffort, 'off'>, number> = {
        low: 1024,
        medium: 4096,
        high: 8192,
        max: 16000,
      };
      body.thinking_budget = budgetMap[reasoningEffort] || budgetMap.medium;
    }
  }
}
