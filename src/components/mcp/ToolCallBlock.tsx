import React from 'react';
import { ToolCall, ContentBlock } from '../../types';
import ToolCallRead from './ToolCallRead';
import ToolCallWrite from './ToolCallWrite';
import ToolCallDelete from './ToolCallDelete';
import ToolCallHttpServer from './ToolCallHttpServer';
import AgentBlock from './AgentBlock';
import { isAgentTool, isReadTool, isWriteTool, isDeleteTool, isHttpTool, parseToolInput } from '../../mcp/toolUtils';

interface Props {
  toolCall: ToolCall;
  result?: string;
  isError?: boolean;
  homePath?: string;
  block?: ContentBlock;
}

export default React.memo(function ToolCallBlock({ toolCall, result, isError, homePath, block }: Props) {
  const input = parseToolInput(toolCall);

  if (isAgentTool(toolCall.name)) {
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

  if (isReadTool(toolCall.name)) {
    return <ToolCallRead name={toolCall.name} input={input} result={result} isError={isError} />;
  }

  if (isWriteTool(toolCall.name)) {
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

  if (isDeleteTool(toolCall.name)) {
    return (
      <ToolCallDelete
        input={input}
        result={result}
        isError={isError}
      />
    );
  }

  if (isHttpTool(toolCall.name)) {
    return <ToolCallHttpServer input={input} result={result} isError={isError} />;
  }

  return null;
});
