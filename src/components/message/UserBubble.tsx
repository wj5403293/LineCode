import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { spacing, radius } from '../../constants/theme';
import { useTheme } from '../../theme';
import { createUserMdStyle } from './markdownStyles';
import CodeBlock from '../CodeBlock';

interface Props {
  content: string;
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

export default React.memo(function UserBubble({ content }: Props) {
  const { colors } = useTheme();
  const mdStyle = useMemo(() => createUserMdStyle(colors), [colors]);

  return (
    <View style={styles.row}>
      <View style={[styles.bubble, { backgroundColor: colors.userBubble }]}>
        <Markdown style={mdStyle} rules={selectableUserRules}>{content}</Markdown>
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
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.lg,
    borderBottomRightRadius: 4,
  },
});
