import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ContentBlock } from '../../types';
import { spacing } from '../../constants/theme';
import ThinkingBlock from './ThinkingBlock';
import TextBlock from './TextBlock';

interface Props {
  content: string;
  blocks?: ContentBlock[];
  streaming?: boolean;
  codeWrap?: boolean;
  thinkingAutoExpand?: boolean;
  thinkingScrollable?: boolean;
}

export default React.memo(function AIBubbleFullscreen({
  content, blocks, streaming, codeWrap, thinkingAutoExpand, thinkingScrollable,
}: Props) {
  if (blocks && blocks.length > 0) {
    return (
      <View style={styles.row}>
        {blocks.map((block, i) => (
          block.type === 'thinking'
            ? <ThinkingBlock
                key={i}
                content={block.content}
                streaming={streaming && i === blocks.length - 1}
                autoExpand={thinkingAutoExpand}
                scrollable={thinkingScrollable}
              />
            : <TextBlock
                key={i}
                content={block.content}
                streaming={streaming && i === blocks.length - 1}
                codeWrap={codeWrap}
              />
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
