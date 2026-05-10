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
}

const MemoizedUserBubble = React.memo(UserBubble);
const MemoizedAIBubbleFullscreen = React.memo(AIBubbleFullscreen);
const MemoizedAIBubbleCompact = React.memo(AIBubbleCompact);

function MessageBubble({ message, codeWrap, displayMode = 'fullscreen', thinkingAutoExpand, thinkingScrollable, homePath }: Props) {
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
      />;
}

export default React.memo(MessageBubble);
