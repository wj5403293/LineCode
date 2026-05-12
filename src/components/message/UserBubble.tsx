import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { spacing, radius } from '../../constants/theme';
import { useTheme } from '../../theme';
import { createUserMdStyle } from './markdownStyles';
import CodeBlock from '../CodeBlock';
import { InputAttachment } from '../../types';

interface Props {
  content: string;
  attachments?: InputAttachment[];
}

function stripLegacyAttachmentBlock(content: string): string {
  const marker = '\n\n附加文件位置:\n';
  const markerIndex = content.indexOf(marker);
  if (markerIndex !== -1) return content.slice(0, markerIndex).trim();
  return content.startsWith('附加文件位置:\n') ? '' : content;
}

const selectableUserRules = {
  text: (node: any, _children: any, _parent: any, markdownStyles: any, inheritedStyles = {}) => (
    <Text key={node.key} selectable style={[inheritedStyles, markdownStyles.text]}>
      {node.content}
    </Text>
  ),
  textgroup: (node: any, children: React.ReactNode, _parent: any, markdownStyles: any) => (
    <Text key={node.key} selectable style={markdownStyles.textgroup}>
      {children}
    </Text>
  ),
  strong: (node: any, children: React.ReactNode, _parent: any, markdownStyles: any) => (
    <Text key={node.key} selectable style={markdownStyles.strong}>
      {children}
    </Text>
  ),
  em: (node: any, children: React.ReactNode, _parent: any, markdownStyles: any) => (
    <Text key={node.key} selectable style={markdownStyles.em}>
      {children}
    </Text>
  ),
  code_inline: (node: any, _children: any, _parent: any, markdownStyles: any, inheritedStyles = {}) => (
    <Text key={node.key} selectable style={[inheritedStyles, markdownStyles.code_inline]}>
      {node.content}
    </Text>
  ),
  fence: (node: any) => {
    const language = node.attributes?.language || '';
    const code = node.content || '';
    return <CodeBlock key={node.key} language={language} code={code} />;
  },
  code_block: (node: any) => {
    const code = node.content || '';
    return <CodeBlock key={node.key} code={code} />;
  },
};

export default React.memo(function UserBubble({ content, attachments }: Props) {
  const { colors } = useTheme();
  const mdStyle = useMemo(() => createUserMdStyle(colors), [colors]);
  const sanitizedContent = stripLegacyAttachmentBlock(content);
  const fallbackContent = content.startsWith('附加文件位置:\n') ? '已附加文件' : '';
  const displayContent = sanitizedContent || fallbackContent;
  const visibleContent = displayContent === '已附加文件' && attachments?.length ? '' : displayContent;

  return (
    <View style={styles.row}>
      <View style={styles.stack}>
        {!!visibleContent && (
          <View style={[styles.bubble, { backgroundColor: colors.userBubble }]}>
            <Markdown style={mdStyle} rules={selectableUserRules}>{visibleContent}</Markdown>
          </View>
        )}
        {!!attachments?.length && (
          <View style={styles.attachmentList}>
            {attachments.map(item => (
              <View
                key={`${item.source}:${item.path}`}
                style={[
                  styles.attachmentChip,
                  {
                    backgroundColor: colors.surfaceLight,
                    borderColor: colors.borderLight,
                  },
                ]}
              >
                <Text style={[styles.attachmentName, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    marginBottom: 6,
  },
  stack: {
    maxWidth: '80%',
    alignItems: 'flex-end',
  },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.lg,
    borderBottomRightRadius: 4,
  },
  attachmentList: {
    marginTop: spacing.xs,
    gap: spacing.xs,
    alignItems: 'flex-end',
  },
  attachmentChip: {
    maxWidth: 220,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  attachmentName: {
    fontSize: 12,
    fontWeight: '600',
  },
});
