import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ContentBlock, ToolCall } from '../../types';
import { spacing } from '../../constants/theme';
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

export default React.memo(function AIBubbleFullscreen({
  content, blocks, toolCalls, streaming, codeWrap, thinkingAutoExpand, thinkingScrollable, homePath,
}: Props) {
  if (blocks && blocks.length > 0) {
    return (
      <View style={styles.row}>
        {blocks.map((block, i) => {
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
            return null; // results are shown inline with tool_use
          }
          return (
            <TextBlock
              key={i}
              content={block.content}
              streaming={streaming && i === blocks.length - 1}
              codeWrap={codeWrap}
            />
          );
        })}
      </View>
    );
  }

  // 也支持通过 toolCalls 属性渲染
  if (toolCalls && toolCalls.length > 0) {
    return (
      <View style={styles.row}>
        {content ? <TextBlock content={content} streaming={streaming} codeWrap={codeWrap} /> : null}
        {toolCalls.map((tc, i) => (
          <ToolCallBlock key={i} toolCall={tc} homePath={homePath || ''} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <TextBlock content={content} streaming={streaming} codeWrap={codeWrap} />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
});
