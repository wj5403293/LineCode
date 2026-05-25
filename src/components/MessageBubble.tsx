import React from 'react';
import { Message } from '../types';
import UserBubble from './message/UserBubble';
import AIBubbleFullscreen from './message/AIBubbleFullscreen';
import AIBubbleCompact from './message/AIBubbleCompact';
import { useMessageActions } from '../contexts/MessageActionsContext';

interface Props {
  message: Message;
}

function MessageBubble({ message }: Props) {
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

  return displayMode === 'fullscreen'
    ? <AIBubbleFullscreen
        content={message.content}
        blocks={message.blocks}
        toolCalls={message.toolCalls}
        toolResults={message.toolResults}
        streaming={message.streaming}
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
      />
    : <AIBubbleCompact
        content={message.content}
        blocks={message.blocks}
        toolCalls={message.toolCalls}
        toolResults={message.toolResults}
        streaming={message.streaming}
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
      />;
}

export default React.memo(MessageBubble);
