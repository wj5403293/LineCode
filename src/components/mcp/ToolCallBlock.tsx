import React from 'react';
import { ToolCall, ContentBlock } from '../../types';
import ToolCallRead from './ToolCallRead';
import ToolCallWrite from './ToolCallWrite';
import ToolCallDelete from './ToolCallDelete';
import ToolCallHttpServer from './ToolCallHttpServer';
import AgentBlock from './AgentBlock';

interface Props {
  toolCall: ToolCall;
  result?: string;
  isError?: boolean;
  homePath?: string;
  block?: ContentBlock;
}

const READ_TOOLS = new Set(['file_read', 'glob']);
const WRITE_TOOLS = new Set(['file_write', 'file_edit']);
const DELETE_TOOLS = new Set(['file_delete']);
const HTTP_TOOLS = new Set(['http_server']);
const AGENT_TOOLS = new Set(['agent']);

export default React.memo(function ToolCallBlock({ toolCall, result, isError, homePath, block }: Props) {
  let input: Record<string, unknown> = {};
  try {
    input = JSON.parse(toolCall.arguments);
  } catch {}

  if (AGENT_TOOLS.has(toolCall.name)) {
    const agentType = (input.type as 'explore' | 'sub-coding') || 'explore';
    const agentStatus = block?.agentStatus || (result ? (isError ? 'error' : 'done') : 'running');
    const agentOutput = block?.agentOutput || result;
    const agentThinking = block?.agentThinking;
    const agentToolCalls = block?.agentToolCalls;
    return (
      <AgentBlock
        name={String(input.description || 'Agent')}
        agentType={agentType}
        status={agentStatus}
        output={agentOutput}
        thinking={agentThinking}
        toolCalls={agentToolCalls}
        streaming={!result && !block?.agentOutput}
        homePath={homePath}
      />
    );
  }

  if (READ_TOOLS.has(toolCall.name)) {
    return <ToolCallRead name={toolCall.name} input={input} result={result} isError={isError} />;
  }

  if (WRITE_TOOLS.has(toolCall.name)) {
    return (
      <ToolCallWrite
        name={toolCall.name}
        input={input}
        result={result}
        isError={isError}
        homePath={homePath || ''}
        streaming={!result}
      />
    );
  }

  if (DELETE_TOOLS.has(toolCall.name)) {
    return (
      <ToolCallDelete
        input={input}
        result={result}
        isError={isError}
      />
    );
  }

  if (HTTP_TOOLS.has(toolCall.name)) {
    return <ToolCallHttpServer input={input} result={result} isError={isError} />;
  }

  return null;
});
