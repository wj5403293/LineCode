import React from 'react';
import { ToolCall } from '../../types';
import ToolCallRead from './ToolCallRead';
import ToolCallWrite from './ToolCallWrite';
import ToolCallHttpServer from './ToolCallHttpServer';

interface Props {
  toolCall: ToolCall;
  result?: string;
  isError?: boolean;
  homePath: string;
  streaming?: boolean;
}

const READ_TOOLS = new Set(['file_read', 'glob']);
const WRITE_TOOLS = new Set(['file_write', 'file_edit']);
const HTTP_TOOLS = new Set(['http_server']);

export default React.memo(function ToolCallBlock({ toolCall, result, isError, homePath, streaming }: Props) {
  let input: Record<string, unknown> = {};
  try {
    input = JSON.parse(toolCall.arguments);
  } catch {}

  const isExecuting = streaming || !result;

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
        homePath={homePath}
        streaming={isExecuting}
      />
    );
  }

  if (HTTP_TOOLS.has(toolCall.name)) {
    return <ToolCallHttpServer input={input} result={result} isError={isError} />;
  }

  return null;
});
