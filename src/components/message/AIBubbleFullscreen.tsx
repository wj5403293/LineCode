import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ContentBlock, ToolCall, ToolResult } from '../../types';
import { spacing } from '../../constants/theme';
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

export default React.memo(function AIBubbleFullscreen({
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
  const hasBlocks = blocks && blocks.length > 0;
  const hasToolCalls = toolCalls && toolCalls.length > 0;
  const hasContent = content && content.trim().length > 0;
  const showStreamingPlaceholder = streaming && !hasContent && !hasBlocks && !hasToolCalls;

  return (
    <View style={styles.row}>
      <View style={styles.stack}>
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
        {!streaming && !!content.trim() && (
          <MessageActionBar copyText={content} align="left" />
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  stack: {
    alignSelf: 'stretch',
    alignItems: 'stretch',
    width: '100%',
  },
});
