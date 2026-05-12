import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ContentBlock, ToolCall, ToolResult } from '../../types';
import { spacing } from '../../constants/theme';
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
  shellConfirmToolCallId?: string;
  onShellCancel?: () => void;
  onShellConfirm?: () => void;
  onShellDefaultExecute?: () => void;
  onViewShellCommand?: (command: string) => void;
}

export default React.memo(function AIBubbleFullscreen({
  content,
  blocks,
  toolCalls,
  toolResults,
  streaming,
  codeWrap,
  thinkingAutoExpand,
  thinkingScrollable,
  homePath,
  shellConfirmToolCallId,
  onShellCancel,
  onShellConfirm,
  onShellDefaultExecute,
  onViewShellCommand,
}: Props) {
  const hasBlocks = blocks && blocks.length > 0;
  const hasToolCalls = toolCalls && toolCalls.length > 0;
  const hasContent = content && content.trim().length > 0;

  return (
    <View style={styles.row}>
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
          shellConfirmToolCallId={shellConfirmToolCallId}
          onShellCancel={onShellCancel}
          onShellConfirm={onShellConfirm}
          onShellDefaultExecute={onShellDefaultExecute}
          onViewShellCommand={onViewShellCommand}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
});
