import { Model } from '../types';

export type ModelProviderProtocol = Model['provider'];

export interface ModelProviderPreset {
  id: string;
  label: string;
  desc: string;
  provider: ModelProviderProtocol;
  baseUrl: string;
  placeholder: string;
  hint: string;
}

export const MODEL_PROVIDER_PROTOCOL_LABELS: Record<ModelProviderProtocol, string> = {
  openai: 'OpenAI 兼容',
  codex: 'Codex',
  anthropic: 'Anthropic',
};

export const MODEL_PROVIDER_PRESETS: ModelProviderPreset[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    desc: 'DeepSeek Chat / Reasoner',
    provider: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    placeholder: 'https://api.deepseek.com/v1',
    hint: 'DeepSeek 使用 OpenAI 兼容协议，Base URL 填到 /v1。',
  },
  {
    id: 'glm',
    label: 'GLM',
    desc: '智谱 GLM / Z.ai',
    provider: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    placeholder: 'https://open.bigmodel.cn/api/paas/v4',
    hint: 'GLM 使用 OpenAI 兼容协议，Base URL 填到 /api/paas/v4。',
  },
  {
    id: 'mimo',
    label: 'Mimo',
    desc: 'Mimo/OpenAI 兼容服务',
    provider: 'openai',
    baseUrl: '',
    placeholder: '填写 Mimo/OpenAI 兼容 Base URL',
    hint: 'Mimo API 地址可能因平台而异，请填写提供商给出的 OpenAI 兼容 Base URL 后查询模型。',
  },
  {
    id: 'kimi',
    label: 'Kimi',
    desc: 'Moonshot AI',
    provider: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    placeholder: 'https://api.moonshot.cn/v1',
    hint: 'Kimi/Moonshot 使用 OpenAI 兼容协议，Base URL 填到 /v1。',
  },
  {
    id: 'qwen',
    label: 'Qwen',
    desc: 'DashScope 兼容模式',
    provider: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    placeholder: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    hint: 'Qwen/DashScope 使用 OpenAI 兼容协议，Base URL 填到 /compatible-mode/v1。',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    desc: 'GPT / o 系列',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    placeholder: 'https://api.openai.com/v1',
    hint: 'OpenAI Chat Completions 兼容模型使用 /v1，不要加 /chat/completions。',
  },
  {
    id: 'claude',
    label: 'Claude',
    desc: 'Anthropic Messages API',
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    placeholder: 'https://api.anthropic.com',
    hint: 'Claude 使用 Anthropic Messages API，Base URL 填根地址，不要加 /v1/messages。',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    desc: 'Google OpenAI 兼容端点',
    provider: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    placeholder: 'https://generativelanguage.googleapis.com/v1beta/openai',
    hint: 'Gemini OpenAI 兼容端点填到 /v1beta/openai，应用会调用 /models 和 /chat/completions。',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    desc: '多模型聚合',
    provider: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    placeholder: 'https://openrouter.ai/api/v1',
    hint: 'OpenRouter 使用 OpenAI 兼容协议，Base URL 填到 /api/v1。',
  },
];

export function getModelProviderPreset(id?: string): ModelProviderPreset | undefined {
  return MODEL_PROVIDER_PRESETS.find(item => item.id === id);
}
