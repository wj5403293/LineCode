import React from 'react';
import { ToolCall, ContentBlock } from '../../types';
import ToolCallRead from './ToolCallRead';
import ToolCallWrite from './ToolCallWrite';
import ToolCallDelete from './ToolCallDelete';
import ToolCallHttpServer from './ToolCallHttpServer';
import ToolCallShell from './ToolCallShell';
import AgentBlock from './AgentBlock';
import { isAgentTool, isReadTool, isWriteTool, isDeleteTool, isHttpTool, isShellTool, parseToolInput } from '../../mcp/toolUtils';
import { agentToolManager } from '../../mcp/AgentToolManager';

interface Props {
  toolCall: ToolCall;
  result?: string;
  isError?: boolean;
  homePath?: string;
  block?: ContentBlock;
  pending?: boolean;
  onShellCancel?: () => void;
  onShellConfirm?: () => void;
  onShellDefaultExecute?: () => void;
  onViewShellCommand?: (command: string) => void;
}

export default React.memo(function ToolCallBlock({
  toolCall,
  result,
  isError,
  homePath,
  block,
  pending,
  onShellCancel,
  onShellConfirm,
  onShellDefaultExecute,
  onViewShellCommand,
}: Props) {
  const input = parseToolInput(toolCall);

  if (isAgentTool(toolCall.name)) {
    const agentType = (input.type as 'explore' | 'sub-coding') || 'explore';
    const agentStatus = block?.agentStatus || (result ? (isError ? 'error' : 'done') : 'running');
    const agentOutput = block?.agentOutput || result;
    const agentThinking = block?.agentThinking;
    const agentToolCalls = block?.agentToolCalls;
    const waitingForUnlock = block?.waitingForUnlock;
    const agentStreaming = !result && !block?.agentOutput && (agentStatus === 'running' || agentStatus === 'waiting_unlock');
    
    return (
      <AgentBlock
        name={String(input.description || 'Agent')}
        agentType={agentType}
        status={agentStatus}
        output={agentOutput}
        thinking={agentThinking}
        toolCalls={agentToolCalls}
        streaming={agentStreaming}
        homePath={homePath}
        waitingForUnlock={waitingForUnlock}
        onContinueAfterUnlock={() => agentToolManager.continueAfterUnlock()}
        onCancelWait={() => agentToolManager.abort()}
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

  if (isShellTool(toolCall.name)) {
    return (
      <ToolCallShell
        input={input}
        result={result}
        isError={isError}
        pending={pending}
        onCancel={onShellCancel}
        onConfirm={onShellConfirm}
        onDefaultExecute={onShellDefaultExecute}
        onViewCommand={onViewShellCommand}
      />
    );
  }

  return null;
});
