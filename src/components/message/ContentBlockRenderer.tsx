import React from 'react';
import { ContentBlock, ToolCall, ToolResult } from '../../types';
import ThinkingBlock from './ThinkingBlock';
import TextBlock from './TextBlock';
import ToolCallBlock from '../mcp/ToolCallBlock';

interface ContentBlockRendererProps {
  blocks?: ContentBlock[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  streaming?: boolean;
  codeWrap?: boolean;
  thinkingAutoExpand?: boolean;
  thinkingScrollable?: boolean;
  homePath?: string;
  shellConfirmToolCallId?: string;
  onShellCancel?: () => void;
  onShellConfirm?: () => void;
  onShellDefaultExecute?: () => void;
  onViewShellCommand?: (command: string) => void;
}

export function ContentBlockRenderer({
  blocks,
  toolCalls,
  toolResults,
  streaming,
  codeWrap,
  thinkingAutoExpand,
  thinkingScrollable,
  homePath,
  shellConfirmToolCallId,
  onShellCancel,
  onShellConfirm,
  onShellDefaultExecute,
  onViewShellCommand,
}: ContentBlockRendererProps) {
  if (blocks && blocks.length > 0) {
    return (
      <>
        {blocks.map((block, i) => {
          if (block.type === 'thinking') {
            return (
              <ThinkingBlock
                key={i}
                content={block.content}
                streaming={streaming && i === blocks.length - 1}
                autoExpand={thinkingAutoExpand}
                scrollable={thinkingScrollable}
              />
            );
          }
          if (block.type === 'tool_use' && block.id && block.name) {
            const tc: ToolCall = {
              id: block.id,
              name: block.name,
              arguments: block.content || JSON.stringify(block.input || {}),
            };
            const tr = toolResults?.find(r => r.toolCallId === block.id);
            return (
              <ToolCallBlock
                key={i}
                toolCall={tc}
                homePath={homePath}
                result={tr?.content}
                isError={tr?.isError}
                block={block}
                pending={block.id === shellConfirmToolCallId && !tr}
                onShellCancel={onShellCancel}
                onShellConfirm={onShellConfirm}
                onShellDefaultExecute={onShellDefaultExecute}
                onViewShellCommand={onViewShellCommand}
              />
            );
          }
          if (block.type === 'tool_result') {
            return null;
          }
          return (
            <TextBlock
              key={i}
              content={block.content}
              streaming={streaming && i === blocks.length - 1}
              codeWrap={codeWrap}
            />
          );
        })}
      </>
    );
  }

  if (toolCalls && toolCalls.length > 0) {
    return (
      <>
        {toolCalls.map((tc, i) => {
          const tr = toolResults?.find(r => r.toolCallId === tc.id);
          return (
            <ToolCallBlock
              key={i}
              toolCall={tc}
              homePath={homePath}
              result={tr?.content}
              isError={tr?.isError}
              pending={tc.id === shellConfirmToolCallId && !tr}
              onShellCancel={onShellCancel}
              onShellConfirm={onShellConfirm}
              onShellDefaultExecute={onShellDefaultExecute}
              onViewShellCommand={onViewShellCommand}
            />
          );
        })}
      </>
    );
  }

  return null;
}

interface ContentWithTextProps {
  content?: string;
  blocks?: ContentBlock[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  streaming?: boolean;
  codeWrap?: boolean;
  thinkingAutoExpand?: boolean;
  thinkingScrollable?: boolean;
  homePath?: string;
  shellConfirmToolCallId?: string;
  onShellCancel?: () => void;
  onShellConfirm?: () => void;
  onShellDefaultExecute?: () => void;
  onViewShellCommand?: (command: string) => void;
}

export function ContentWithText({
  content,
  blocks,
  toolCalls,
  toolResults,
  streaming,
  codeWrap,
  thinkingAutoExpand,
  thinkingScrollable,
  homePath,
  shellConfirmToolCallId,
  onShellCancel,
  onShellConfirm,
  onShellDefaultExecute,
  onViewShellCommand,
}: ContentWithTextProps) {
  const hasBlocks = blocks && blocks.length > 0;
  const hasToolCalls = toolCalls && toolCalls.length > 0;
  const hasContent = content && content.trim().length > 0;

  return (
    <>
      {hasContent && !hasBlocks && !hasToolCalls && (
        <TextBlock content={content} streaming={streaming} codeWrap={codeWrap} />
      )}
      <ContentBlockRenderer
        blocks={blocks}
        toolCalls={toolCalls}
        toolResults={toolResults}
        streaming={streaming}
        codeWrap={codeWrap}
        thinkingAutoExpand={thinkingAutoExpand}
        thinkingScrollable={thinkingScrollable}
        homePath={homePath}
        shellConfirmToolCallId={shellConfirmToolCallId}
        onShellCancel={onShellCancel}
        onShellConfirm={onShellConfirm}
        onShellDefaultExecute={onShellDefaultExecute}
        onViewShellCommand={onViewShellCommand}
      />
    </>
  );
}
