import React from 'react';
import { ContentBlock, ToolCall, ToolResult } from '../../types';
import ThinkingBlock from './ThinkingBlock';
import TextBlock from './TextBlock';
import ToolCallBlock from '../mcp/ToolCallBlock';
import ContextCompactBlock from '../mcp/ContextCompactBlock';
import RenderErrorBoundary from '../RenderErrorBoundary';

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
  onToolReview?: (toolCallId: string, state: 'accepted' | 'rejected', diffId?: string) => void;
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
  onToolReview,
}: ContentBlockRendererProps) {
  if (blocks && blocks.length > 0) {
    return (
      <>
        {blocks.map((block, i) => {
          if (block.type === 'thinking') {
            return (
              <RenderErrorBoundary key={i} label="思考内容" resetKey={block.content}>
                <ThinkingBlock
                  content={block.content}
                  streaming={streaming && i === blocks.length - 1}
                  autoExpand={thinkingAutoExpand}
                  scrollable={thinkingScrollable}
                />
              </RenderErrorBoundary>
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
              <RenderErrorBoundary
                key={i}
                label="工具调用"
                resetKey={toolResetKey(block.id, shellConfirmToolCallId, tr)}
              >
                <ToolCallBlock
                  toolCall={tc}
                  homePath={homePath}
                  result={tr?.content}
                  isError={tr?.isError}
                  toolResult={tr}
                  block={block}
                  pending={block.id === shellConfirmToolCallId && !tr}
                  onShellCancel={onShellCancel}
                  onShellConfirm={onShellConfirm}
                  onShellDefaultExecute={onShellDefaultExecute}
                  onViewShellCommand={onViewShellCommand}
                  onToolReview={onToolReview}
                />
              </RenderErrorBoundary>
            );
          }
          if (block.type === 'tool_result') {
            return null;
          }
          if (block.type === 'compact') {
            return (
              <ContextCompactBlock
                key={i}
                status={block.compactStatus}
              />
            );
          }
          return (
            <RenderErrorBoundary key={i} label="消息内容" resetKey={block.content}>
              <TextBlock
                content={block.content}
                streaming={streaming && i === blocks.length - 1}
                codeWrap={codeWrap}
              />
            </RenderErrorBoundary>
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
            <RenderErrorBoundary
              key={i}
              label="工具调用"
              resetKey={toolResetKey(tc.id, shellConfirmToolCallId, tr)}
            >
              <ToolCallBlock
                toolCall={tc}
                homePath={homePath}
                result={tr?.content}
                isError={tr?.isError}
                toolResult={tr}
                pending={tc.id === shellConfirmToolCallId && !tr}
                onShellCancel={onShellCancel}
                onShellConfirm={onShellConfirm}
                onShellDefaultExecute={onShellDefaultExecute}
                onViewShellCommand={onViewShellCommand}
                onToolReview={onToolReview}
              />
            </RenderErrorBoundary>
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
  onToolReview?: (toolCallId: string, state: 'accepted' | 'rejected', diffId?: string) => void;
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
  onToolReview,
}: ContentWithTextProps) {
  const hasBlocks = blocks && blocks.length > 0;
  const hasToolCalls = toolCalls && toolCalls.length > 0;
  const hasContent = content && content.trim().length > 0;

  return (
    <>
      {hasContent && !hasBlocks && !hasToolCalls && (
        <RenderErrorBoundary label="消息内容" resetKey={content}>
          <TextBlock content={content} streaming={streaming} codeWrap={codeWrap} />
        </RenderErrorBoundary>
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
        onToolReview={onToolReview}
      />
    </>
  );
}

function pendingKey(toolCallId: string, shellConfirmToolCallId?: string): string {
  return toolCallId === shellConfirmToolCallId ? 'pending' : 'idle';
}

function toolResetKey(
  toolCallId: string,
  shellConfirmToolCallId: string | undefined,
  result?: ToolResult,
): string {
  return [
    toolCallId,
    pendingKey(toolCallId, shellConfirmToolCallId),
    result?.isError ? 'error' : 'ok',
    result?.content?.length || 0,
    result?.diffId || '',
    result?.reviewState || '',
  ].join(':');
}
