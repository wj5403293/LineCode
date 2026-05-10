import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ContentBlock, ToolCall } from '../../types';
import { colors, spacing, radius } from '../../constants/theme';
import ThinkingBlock from './ThinkingBlock';
import TextBlock from './TextBlock';
import ToolCallBlock from '../mcp/ToolCallBlock';

interface Props {
  content: string;
  blocks?: ContentBlock[];
  toolCalls?: ToolCall[];
  streaming?: boolean;
  codeWrap?: boolean;
  thinkingAutoExpand?: boolean;
  thinkingScrollable?: boolean;
  homePath?: string;
}

export default React.memo(function AIBubbleCompact({
  content, blocks, toolCalls, streaming, codeWrap, thinkingAutoExpand, thinkingScrollable, homePath,
}: Props) {
  const renderContent = () => {
    if (blocks && blocks.length > 0) {
      return blocks.map((block, i) => {
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
          return <ToolCallBlock key={i} toolCall={tc} homePath={homePath || ''} streaming={streaming && i === blocks.length - 1} />;
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
      });
    }

    if (toolCalls && toolCalls.length > 0) {
      return (
        <>
          {content ? <TextBlock content={content} streaming={streaming} codeWrap={codeWrap} /> : null}
          {toolCalls.map((tc, i) => (
            <ToolCallBlock key={i} toolCall={tc} homePath={homePath || ''} />
          ))}
        </>
      );
    }

    return <TextBlock content={content} streaming={streaming} codeWrap={codeWrap} />;
  };

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>AI</Text>
      </View>
      <View style={styles.bubble}>
        {renderContent()}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    marginBottom: 6,
    gap: spacing.sm,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.lg,
    borderBottomLeftRadius: 4,
    backgroundColor: colors.aiBubble,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  avatarText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '700',
  },
});
