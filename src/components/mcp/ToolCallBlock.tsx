import React from 'react';
import { ToolCall, ContentBlock, ToolResult, AgentProgressItem } from '../../types';
import ToolCallRead from './ToolCallRead';
import ToolCallWrite from './ToolCallWrite';
import ToolCallDelete from './ToolCallDelete';
import ToolCallHttpServer from './ToolCallHttpServer';
import ToolCallShell from './ToolCallShell';
import AgentBlock from './AgentBlock';
import AgentPipelineBlock from './AgentPipelineBlock';
import { isAgentTool, isReadTool, isWriteTool, isDeleteTool, isHttpTool, isShellTool, parseToolInput } from '../../mcp/toolUtils';
import { agentToolManager } from '../../mcp/AgentToolManager';

interface Props {
  toolCall: ToolCall;
  result?: string;
  isError?: boolean;
  toolResult?: ToolResult;
  homePath?: string;
  block?: ContentBlock;
  pending?: boolean;
  onShellCancel?: () => void;
  onShellConfirm?: () => void;
  onShellDefaultExecute?: () => void;
  onViewShellCommand?: (command: string) => void;
  onToolReview?: (toolCallId: string, state: 'accepted' | 'rejected', diffId?: string) => void;
}

function createFallbackPipelineAgents(input: Record<string, unknown>, status: AgentProgressItem['status']): AgentProgressItem[] {
  const agents = Array.isArray(input.agents) ? input.agents : [];
  return agents.map((raw, index) => {
    const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const type = item.type === 'sub-coding' ? 'sub-coding' : 'explore';
    return {
      id: String(item.id || index + 1),
      name: String(item.description || item.id || `Agent ${index + 1}`),
      type,
      status,
      output: '',
      toolCalls: [],
      toolCallCount: 0,
    };
  });
}

export default React.memo(function ToolCallBlock({
  toolCall,
  result,
  isError,
  toolResult,
  homePath,
  block,
  pending,
  onShellCancel,
  onShellConfirm,
  onShellDefaultExecute,
  onViewShellCommand,
  onToolReview,
}: Props) {
  const input = parseToolInput(toolCall);

  if (isAgentTool(toolCall.name)) {
    if (toolCall.name === 'agent_pipeline') {
      const fallbackStatus = result ? (isError ? 'error' : 'done') : 'running';
      const agents = block?.agentItems?.length
        ? block.agentItems
        : createFallbackPipelineAgents(input, fallbackStatus);
      return (
        <AgentPipelineBlock
          agents={agents}
          fallbackName={String(input.description || 'Agent Pipeline')}
          streaming={!result}
          homePath={homePath}
          onCancelWait={() => agentToolManager.abort()}
        />
      );
    }

    const agentType = (input.type as 'explore' | 'sub-coding') || 'explore';
    const agentStatus = block?.agentStatus || (result ? (isError ? 'error' : 'done') : 'running');
    const agentOutput = block?.agentOutput || result;
    const agentThinking = block?.agentThinking;
    const agentToolCalls = block?.agentToolCalls;
    const waitingForUnlock = block?.waitingForUnlock;
    const agentStreaming = agentStatus === 'running' || agentStatus === 'waiting_unlock';
    
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
        toolCallId={toolCall.id}
        diffId={toolResult?.diffId}
        reviewState={toolResult?.reviewState}
        homePath={homePath || ''}
        streaming={!result}
        onReview={onToolReview}
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
