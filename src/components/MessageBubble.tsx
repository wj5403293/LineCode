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

export default React.memo(MessageBubble);
