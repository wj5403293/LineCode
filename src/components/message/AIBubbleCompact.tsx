import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ContentBlock, ToolCall, ToolResult } from '../../types';
import { colors, spacing, radius } from '../../constants/theme';
import { ContentWithText } from './ContentBlockRenderer';
import TextBlock from './TextBlock';

interface Props {
  content: string;
  blocks?: ContentBlock[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  streaming?: boolean;
  codeWrap?: boolean;
  thinkingAutoExpand?: boolean;
  thinkingScrollable?: boolean;
  homePath?: string;
}

export default React.memo(function AIBubbleCompact({
  content, blocks, toolCalls, toolResults, streaming, codeWrap, thinkingAutoExpand, thinkingScrollable, homePath,
}: Props) {
  const hasBlocks = blocks && blocks.length > 0;
  const hasToolCalls = toolCalls && toolCalls.length > 0;
  const hasContent = content && content.trim().length > 0;

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>AI</Text>
      </View>
      <View style={styles.bubble}>
        {hasContent && !hasBlocks && !hasToolCalls && (
          <TextBlock content={content} streaming={streaming} codeWrap={codeWrap} />
        )}
        {(hasBlocks || hasToolCalls) && (
          <ContentWithText
            content={content}
            blocks={blocks}
            toolCalls={toolCalls}
            toolResults={toolResults}
            streaming={streaming}
            codeWrap={codeWrap}
            thinkingAutoExpand={thinkingAutoExpand}
            thinkingScrollable={thinkingScrollable}
            homePath={homePath}
          />
        )}
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
