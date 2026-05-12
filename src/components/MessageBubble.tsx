import React from 'react';
import { Message } from '../types';
import { DisplayMode } from '../services/settings';
import UserBubble from './message/UserBubble';
import AIBubbleFullscreen from './message/AIBubbleFullscreen';
import AIBubbleCompact from './message/AIBubbleCompact';

interface Props {
  message: Message;
  codeWrap?: boolean;
  displayMode?: DisplayMode;
  thinkingAutoExpand?: boolean;
  thinkingScrollable?: boolean;
  homePath?: string;
  shellConfirmToolCallId?: string;
  onShellCancel?: () => void;
  onShellConfirm?: () => void;
  onShellDefaultExecute?: () => void;
  onViewShellCommand?: (command: string) => void;
}

const MemoizedUserBubble = React.memo(UserBubble);
const MemoizedAIBubbleFullscreen = React.memo(AIBubbleFullscreen);
const MemoizedAIBubbleCompact = React.memo(AIBubbleCompact);

function MessageBubble({
  message,
  codeWrap,
  displayMode = 'fullscreen',
  thinkingAutoExpand,
  thinkingScrollable,
  homePath,
  shellConfirmToolCallId,
  onShellCancel,
  onShellConfirm,
  onShellDefaultExecute,
  onViewShellCommand,
}: Props) {
  if (message.hidden) {
    return null;
  }

  if (message.role === 'user') {
    return <MemoizedUserBubble content={message.content} />;
  }

  if (message.role === 'tool') {
    return null;
  }

  return displayMode === 'fullscreen'
    ? <MemoizedAIBubbleFullscreen
        content={message.content}
        blocks={message.blocks}
        toolCalls={message.toolCalls}
        toolResults={message.toolResults}
        streaming={message.streaming}
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
    : <MemoizedAIBubbleCompact
        content={message.content}
        blocks={message.blocks}
        toolCalls={message.toolCalls}
        toolResults={message.toolResults}
        streaming={message.streaming}
        codeWrap={codeWrap}
        thinkingAutoExpand={thinkingAutoExpand}
        thinkingScrollable={thinkingScrollable}
        homePath={homePath}
        shellConfirmToolCallId={shellConfirmToolCallId}
        onShellCancel={onShellCancel}
        onShellConfirm={onShellConfirm}
        onShellDefaultExecute={onShellDefaultExecute}
        onViewShellCommand={onViewShellCommand}
      />;
}

export default React.memo(MessageBubble);
