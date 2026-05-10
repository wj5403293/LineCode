import React from 'react';
import { Message } from '../types';
import { DisplayMode } from '../services/settings';
import UserBubble from './message/UserBubble';
import AIBubbleFullscreen from './message/AIBubbleFullscreen';
import AIBubbleCompact from './message/AIBubbleCompact';
import RNFS from 'react-native-fs';

const HOME_DIR = `${RNFS.DocumentDirectoryPath}/.linecode/home`;

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

  if (message.role === 'tool') {
    // tool result 消息不单独渲染，已内联在 tool_use 中
    return null;
  }

  return displayMode === 'fullscreen'
    ? <MemoizedAIBubbleFullscreen
        content={message.content}
        blocks={message.blocks}
        toolCalls={message.toolCalls}
        streaming={message.streaming}
        codeWrap={codeWrap}
        thinkingAutoExpand={thinkingAutoExpand}
        thinkingScrollable={thinkingScrollable}
        homePath={HOME_DIR}
      />
    : <MemoizedAIBubbleCompact
        content={message.content}
        blocks={message.blocks}
        toolCalls={message.toolCalls}
        streaming={message.streaming}
        codeWrap={codeWrap}
        thinkingAutoExpand={thinkingAutoExpand}
        thinkingScrollable={thinkingScrollable}
        homePath={HOME_DIR}
      />;
}

export default React.memo(MessageBubble);
