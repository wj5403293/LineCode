import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ContentBlock, ToolCall, ToolResult } from '../../types';
import { spacing, radius } from '../../constants/theme';
import { useTheme } from '../../theme';
import { ContentWithText } from './ContentBlockRenderer';
import TextBlock from './TextBlock';
import MessageActionBar from './MessageActionBar';

interface Props {
  content: string;
  blocks?: ContentBlock[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  streaming?: boolean;
  codeWrap?: boolean;
  mathFormulaRenderingEnabled?: boolean;
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

export default React.memo(function AIBubbleCompact({
  content,
  blocks,
  toolCalls,
  toolResults,
  streaming,
  codeWrap,
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
}: Props) {
  const { colors } = useTheme();
  const hasBlocks = blocks && blocks.length > 0;
  const hasToolCalls = toolCalls && toolCalls.length > 0;
  const hasContent = content && content.trim().length > 0;
  const showStreamingPlaceholder = streaming && !hasContent && !hasBlocks && !hasToolCalls;

  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: colors.accentDim }]}>
        <Text style={[styles.avatarText, { color: colors.accent }]}>AI</Text>
      </View>
      <View style={styles.stack}>
        <View style={[styles.bubble, { backgroundColor: colors.aiBubble }]}>
          {hasContent && !hasBlocks && !hasToolCalls && (
            <TextBlock
              content={content}
              streaming={streaming}
              codeWrap={codeWrap}
              mathFormulaRenderingEnabled={mathFormulaRenderingEnabled}
            />
          )}
          {showStreamingPlaceholder && (
            <TextBlock
              content=""
              streaming
              codeWrap={codeWrap}
              mathFormulaRenderingEnabled={mathFormulaRenderingEnabled}
            />
          )}
          {(hasBlocks || hasToolCalls) && (
            <ContentWithText
              content={content}
              blocks={blocks}
              toolCalls={toolCalls}
              toolResults={toolResults}
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
            />
          )}
        </View>
        {!streaming && !!content.trim() && (
          <MessageActionBar copyText={content} align="left" />
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
  },
  stack: {
    flex: 1,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  avatarText: {
    fontSize: 9,
    fontWeight: '700',
  },
});
