import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { ChevronRight, ChevronDown } from 'lucide-react-native';
import { Message, ContentBlock } from '../types';
import { colors, spacing, fontSizes, radius } from '../constants/theme';
import { DisplayMode } from '../services/settings';
import CodeBlock from './CodeBlock';

interface Props {
  message: Message;
  codeWrap?: boolean;
  displayMode?: DisplayMode;
  thinkingAutoExpand?: boolean;
  thinkingScrollable?: boolean;
}

const mdStyle = {
  body: { color: colors.text, fontSize: fontSizes.md, lineHeight: 22 },
  code_inline: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: colors.accent,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
  },
  code_block: {
    backgroundColor: 'transparent',
    color: colors.text,
    padding: 0,
    borderRadius: 0,
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
    lineHeight: 20,
    borderWidth: 0,
  },
  fence: {
    backgroundColor: 'transparent',
    color: colors.text,
    padding: 0,
    borderRadius: 0,
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
    lineHeight: 20,
    borderWidth: 0,
  },
  link: { color: '#0A84FF' },
  strong: { color: colors.text, fontWeight: '700' as const },
  em: { color: colors.text, fontStyle: 'italic' as const },
  bullet_list: { color: colors.text, marginVertical: 2 },
  ordered_list: { color: colors.text, marginVertical: 2 },
  list_item: { color: colors.text },
  heading1: { color: colors.text, fontSize: fontSizes.xl, fontWeight: '700' as const, marginVertical: 4 },
  heading2: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '700' as const, marginVertical: 4 },
  heading3: { color: colors.text, fontSize: fontSizes.md, fontWeight: '700' as const, marginVertical: 2 },
  hr: { backgroundColor: colors.borderLight, height: 1, marginVertical: 6 },
  blockquote: {
    borderLeftWidth: 2,
    borderLeftColor: colors.textTertiary,
    paddingLeft: spacing.sm,
    color: colors.textSecondary,
  },
};

const userMdStyle = {
  ...mdStyle,
  body: { color: '#FFF', fontSize: fontSizes.md, lineHeight: 22 },
  code_inline: { ...mdStyle.code_inline, color: '#FFF' },
  strong: { color: '#FFF', fontWeight: '700' as const },
  em: { color: '#FFF', fontStyle: 'italic' as const },
  link: { color: '#B0D4FF' },
};

const thinkingMdStyle = {
  ...mdStyle,
  body: { color: colors.textSecondary, fontSize: fontSizes.sm, lineHeight: 18 },
};

function ThinkingBlock({ content, streaming, autoExpand, scrollable }: {
  content: string; streaming?: boolean; autoExpand?: boolean; scrollable?: boolean;
}) {
  const [expanded, setExpanded] = useState(autoExpand || false);

  useEffect(() => {
    if (autoExpand) setExpanded(true);
  }, [autoExpand]);

  return (
    <View style={styles.thinkingWrap}>
      <TouchableOpacity
        style={styles.thinkingHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.thinkingRow}>
          <Text style={styles.thinkingIcon}>✦</Text>
          <Text style={styles.thinkingLabel} numberOfLines={1}>
            {streaming ? '思考中...' : '思考完毕'}
          </Text>
          {expanded
            ? <ChevronDown size={12} color={colors.textTertiary} />
            : <ChevronRight size={12} color={colors.textTertiary} />}
        </View>
      </TouchableOpacity>
      {expanded && (
        scrollable ? (
          <ScrollView style={styles.thinkingScroll} nestedScrollEnabled>
            <Markdown style={thinkingMdStyle}>{content}</Markdown>
          </ScrollView>
        ) : (
          <View style={styles.thinkingContent}>
            <Markdown style={thinkingMdStyle}>{content}</Markdown>
          </View>
        )
      )}
    </View>
  );
}

function TextBlock({ content, streaming, codeWrap }: { content: string; streaming?: boolean; codeWrap?: boolean }) {
  if (!content && !streaming) return null;

  const customRules = {
    fence: (node: any) => {
      const language = node.attributes?.language || '';
      const code = node.content || '';
      return <CodeBlock key={node.key} language={language} code={code} wordWrap={codeWrap} />;
    },
    code_block: (node: any) => {
      const code = node.content || '';
      return <CodeBlock key={node.key} code={code} wordWrap={codeWrap} />;
    },
  };

  if (!content && streaming) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={colors.textTertiary} />
      </View>
    );
  }

  return <Markdown style={mdStyle} rules={customRules}>{content || ''}</Markdown>;
}

function UserBubble({ content }: { content: string }) {
  return (
    <View style={styles.userRow}>
      <View style={styles.userBubble}>
        <Markdown style={userMdStyle}>{content}</Markdown>
      </View>
    </View>
  );
}

function AIBubbleFullscreen({ content, blocks, streaming, codeWrap, thinkingAutoExpand, thinkingScrollable }: {
  content: string; blocks?: ContentBlock[]; streaming?: boolean; codeWrap?: boolean;
  thinkingAutoExpand?: boolean; thinkingScrollable?: boolean;
}) {
  if (blocks && blocks.length > 0) {
    return (
      <View style={styles.fullscreenRow}>
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
    <View style={styles.fullscreenRow}>
      <TextBlock content={content} streaming={streaming} codeWrap={codeWrap} />
    </View>
  );
}

function AIBubbleCompact({ content, blocks, streaming, codeWrap, thinkingAutoExpand, thinkingScrollable }: {
  content: string; blocks?: ContentBlock[]; streaming?: boolean; codeWrap?: boolean;
  thinkingAutoExpand?: boolean; thinkingScrollable?: boolean;
}) {
  if (blocks && blocks.length > 0) {
    return (
      <View style={styles.aiRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>AI</Text>
        </View>
        <View style={styles.aiBubble}>
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
    <View style={styles.aiRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>AI</Text>
      </View>
      <View style={styles.aiBubble}>
        <TextBlock content={content} streaming={streaming} codeWrap={codeWrap} />
      </View>
    </View>
  );
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

const styles = StyleSheet.create({
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    marginBottom: 6,
  },
  userBubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.lg,
    borderBottomRightRadius: 4,
    backgroundColor: colors.userBubble,
  },
  // Bubble mode
  aiRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    marginBottom: 6,
    gap: spacing.sm,
  },
  aiBubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.lg,
    borderBottomLeftRadius: 4,
    backgroundColor: colors.aiBubble,
  },
  // Fullscreen mode
  fullscreenRow: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  // Common
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
  thinkingWrap: {
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  thinkingHeader: {
    paddingVertical: 4,
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  thinkingIcon: {
    color: colors.textTertiary,
    fontSize: 10,
  },
  thinkingLabel: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
  },
  thinkingScroll: {
    maxHeight: 180,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  thinkingContent: {
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  loadingWrap: {
    paddingVertical: spacing.sm,
    alignItems: 'flex-start',
  },
});
