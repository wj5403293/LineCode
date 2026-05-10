import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ContentBlock } from '../../types';
import { colors, spacing, radius } from '../../constants/theme';
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

export default React.memo(function AIBubbleCompact({
  content, blocks, streaming, codeWrap, thinkingAutoExpand, thinkingScrollable,
}: Props) {
  if (blocks && blocks.length > 0) {
    return (
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>AI</Text>
        </View>
        <View style={styles.bubble}>
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
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>AI</Text>
      </View>
      <View style={styles.bubble}>
        <TextBlock content={content} streaming={streaming} codeWrap={codeWrap} />
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
