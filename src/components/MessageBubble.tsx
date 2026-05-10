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
}

const MemoizedUserBubble = React.memo(UserBubble);
const MemoizedAIBubbleFullscreen = React.memo(AIBubbleFullscreen);
const MemoizedAIBubbleCompact = React.memo(AIBubbleCompact);

function MessageBubble({ message, codeWrap, displayMode = 'fullscreen', thinkingAutoExpand, thinkingScrollable }: Props) {
  if (message.role === 'user') {
    return <MemoizedUserBubble content={message.content} />;
  }

  return displayMode === 'fullscreen'
    ? <MemoizedAIBubbleFullscreen
        content={message.content}
        blocks={message.blocks}
        streaming={message.streaming}
        codeWrap={codeWrap}
        thinkingAutoExpand={thinkingAutoExpand}
        thinkingScrollable={thinkingScrollable}
      />
    : <MemoizedAIBubbleCompact
        content={message.content}
        blocks={message.blocks}
        streaming={message.streaming}
        codeWrap={codeWrap}
        thinkingAutoExpand={thinkingAutoExpand}
        thinkingScrollable={thinkingScrollable}
      />;
}

export default React.memo(MessageBubble);
