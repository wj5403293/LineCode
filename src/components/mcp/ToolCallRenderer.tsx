import React from 'react';
import { isReadTool, isWriteTool, isDeleteTool, isHttpTool, isShellTool } from '../../mcp/toolUtils';
import ToolCallRead from './ToolCallRead';
import ToolCallWrite from './ToolCallWrite';
import ToolCallDelete from './ToolCallDelete';
import ToolCallHttpServer from './ToolCallHttpServer';
import ToolCallShell from './ToolCallShell';
import ToolCallGeneric from './ToolCallGeneric';

interface ToolCallRendererProps {
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  toolCallId?: string;
  diffId?: string;
  reviewState?: 'accepted' | 'rejected';
  homePath?: string;
  streaming?: boolean;
  streamingOutput?: string;
  onReview?: (toolCallId: string, state: 'accepted' | 'rejected', diffId?: string) => void;
}

export const ToolCallRenderer = React.memo(function ToolCallRenderer({
  name,
  input,
  result,
  isError,
  toolCallId,
  diffId,
  reviewState,
  homePath,
  streaming,
  streamingOutput,
  onReview,
}: ToolCallRendererProps) {
  if (isReadTool(name)) {
    return (
      <ToolCallRead
        name={name}
        input={input}
        result={result}
        isError={isError}
      />
    );
  }

  if (isWriteTool(name)) {
    return (
      <ToolCallWrite
        name={name}
        input={input}
        result={result}
        isError={isError}
        toolCallId={toolCallId || diffId || name}
        diffId={diffId}
        reviewState={reviewState}
        homePath={homePath || ''}
        streaming={streaming || false}
        onReview={onReview}
      />
    );
  }

  if (isDeleteTool(name)) {
    return (
      <ToolCallDelete
        input={input}
        result={result}
        isError={isError}
      />
    );
  }

  if (isHttpTool(name)) {
    return (
      <ToolCallHttpServer
        input={input}
        result={result}
        isError={isError}
      />
    );
  }

  if (isShellTool(name)) {
    return (
      <ToolCallShell
        input={input}
        result={result}
        isError={isError}
        streaming={streaming}
        streamingOutput={streamingOutput}
      />
    );
  }

  return (
    <ToolCallGeneric
      name={name}
      input={input}
      result={result}
      isError={isError}
      streaming={streaming}
    />
  );
});
