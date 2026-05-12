const DEFAULT_CONTEXT_TOKENS = 250_000;

export function parseModelContext(modelId: string): {
  apiModelId: string;
  contextTokens: number;
  contextLabel: string;
} {
  const trimmed = modelId.trim();
  const match = trimmed.match(/\[([0-9]+(?:\.[0-9]+)?)([kKmM]?)\]$/);
  if (!match) {
    return {
      apiModelId: trimmed,
      contextTokens: DEFAULT_CONTEXT_TOKENS,
      contextLabel: formatContextSize(DEFAULT_CONTEXT_TOKENS),
    };
  }

  const rawNumber = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  const multiplier = unit === 'm' ? 1_000_000 : unit === 'k' ? 1_000 : 1;
  const contextTokens = Math.max(1, Math.round(rawNumber * multiplier));
  const apiModelId = trimmed.slice(0, match.index).trim();

  return {
    apiModelId: apiModelId || trimmed,
    contextTokens,
    contextLabel: formatContextSize(contextTokens),
  };
}

export function formatContextSize(tokens: number): string {
  if (tokens >= 1_000_000) {
    const value = tokens / 1_000_000;
    return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}m`;
  }
  if (tokens >= 1_000) {
    const value = tokens / 1_000;
    return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}k`;
  }
  return String(tokens);
}

export function getApiModelId(modelId: string): string {
  return parseModelContext(modelId).apiModelId;
}
