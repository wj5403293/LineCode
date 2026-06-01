import React from 'react';
import { Message } from '../types';
import UserBubble from './message/UserBubble';
import AIBubbleFullscreen from './message/AIBubbleFullscreen';
import AIBubbleCompact from './message/AIBubbleCompact';
import { useMessageActions } from '../contexts/MessageActionsContext';

interface Props {
  message: Message;
  contentOverride?: string;
  streamingOverride?: boolean;
  showActionBar?: boolean;
}

function MessageBubble({ message, contentOverride, streamingOverride, showActionBar = true }: Props) {
  const {
    codeWrap,
    displayMode = 'fullscreen',
    mathFormulaRenderingEnabled,
    thinkingAutoExpand,
    thinkingScrollable,
    homePath,
    shellConfirmToolCallId,
    onShellCancel,
    onShellConfirm,
    onShellDefaultExecute,
    onViewShellCommand,
    onToolReview,
    onRecallUserMessage,
  } = useMessageActions();

  if (message.hidden) {
    return null;
  }

  if (message.role === 'user') {
    return <UserBubble message={message} onRecall={onRecallUserMessage} />;
  }

  if (message.role === 'tool') {
    return null;
  }

  const content = contentOverride ?? message.content;
  const streaming = streamingOverride ?? message.streaming;
  const useFullMessageBlocks = contentOverride === undefined;

  return displayMode === 'fullscreen'
    ? <AIBubbleFullscreen
        content={content}
        blocks={useFullMessageBlocks ? message.blocks : undefined}
        toolCalls={useFullMessageBlocks ? message.toolCalls : undefined}
        toolResults={message.toolResults}
        streaming={streaming}
        codeWrap={codeWrap}
        mathFormulaRenderingEnabled={mathFormulaRenderingEnabled}
        thinkingAutoExpand={thinkingAutoExpand}
        thinkingScrollable={thinkingScrollable}
        homePath={homePath}
        shellConfirmToolCallId={shellConfirmToolCallId}
        onShellCancel={onShellCancel}
        onShellConfirm={onShellConfirm}
        onShellDefaultExecute={onShellDefaultExecute}
        onViewShellCommand={onViewShellCommand}
        onToolReview={onToolReview}
        showActionBar={showActionBar}
      />
    : <AIBubbleCompact
        content={content}
        blocks={useFullMessageBlocks ? message.blocks : undefined}
        toolCalls={useFullMessageBlocks ? message.toolCalls : undefined}
        toolResults={message.toolResults}
        streaming={streaming}
        codeWrap={codeWrap}
        mathFormulaRenderingEnabled={mathFormulaRenderingEnabled}
        thinkingAutoExpand={thinkingAutoExpand}
        thinkingScrollable={thinkingScrollable}
        homePath={homePath}
        shellConfirmToolCallId={shellConfirmToolCallId}
        onShellCancel={onShellCancel}
        onShellConfirm={onShellConfirm}
        onShellDefaultExecute={onShellDefaultExecute}
        onViewShellCommand={onViewShellCommand}
        onToolReview={onToolReview}
        showActionBar={showActionBar}
      />;
}

function areMessageBubblePropsEqual(prev: Props, next: Props): boolean {
  if (
    prev.contentOverride !== next.contentOverride ||
    prev.streamingOverride !== next.streamingOverride ||
    prev.showActionBar !== next.showActionBar
  ) {
    return false;
  }

  const prevMessage = prev.message;
  const nextMessage = next.message;
  if (prevMessage === nextMessage) return true;

  if (
    prevMessage.id !== nextMessage.id ||
    prevMessage.role !== nextMessage.role ||
    prevMessage.hidden !== nextMessage.hidden
  ) {
    return false;
  }

  const usesContentOverride = prev.contentOverride !== undefined || next.contentOverride !== undefined;
  if (usesContentOverride) {
    return prevMessage.toolResults === nextMessage.toolResults;
  }

  return prevMessage.content === nextMessage.content
    && prevMessage.streaming === nextMessage.streaming
    && prevMessage.blocks === nextMessage.blocks
    && prevMessage.toolCalls === nextMessage.toolCalls
    && prevMessage.toolResults === nextMessage.toolResults
    && prevMessage.attachments === nextMessage.attachments
    && prevMessage.isError === nextMessage.isError;
}

export default React.memo(MessageBubble, areMessageBubblePropsEqual);
