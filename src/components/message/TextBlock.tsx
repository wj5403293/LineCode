import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { spacing } from '../../constants/theme';
import { useTheme } from '../../theme';
import { createMdStyle } from './markdownStyles';
import CodeBlock from '../CodeBlock';

interface Props {
  content: string;
  streaming?: boolean;
  codeWrap?: boolean;
}

function createSelectableRules(codeWrap?: boolean) {
  return {
    text: (node: any, _children: any, _parent: any, styles: any, inheritedStyles = {}) => (
      <Text key={node.key} selectable style={[inheritedStyles, styles.text]}>
        {node.content}
      </Text>
    ),
    textgroup: (node: any, children: React.ReactNode, _parent: any, styles: any) => (
      <Text key={node.key} selectable style={styles.textgroup}>
        {children}
      </Text>
    ),
    strong: (node: any, children: React.ReactNode, _parent: any, styles: any) => (
      <Text key={node.key} selectable style={styles.strong}>
        {children}
      </Text>
    ),
    em: (node: any, children: React.ReactNode, _parent: any, styles: any) => (
      <Text key={node.key} selectable style={styles.em}>
        {children}
      </Text>
    ),
    code_inline: (node: any, _children: any, _parent: any, styles: any, inheritedStyles = {}) => (
      <Text key={node.key} selectable style={[inheritedStyles, styles.code_inline]}>
        {node.content}
      </Text>
    ),
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
}

export default React.memo(function TextBlock({ content, streaming, codeWrap }: Props) {
  const { colors } = useTheme();
  const mdStyle = useMemo(() => createMdStyle(colors), [colors]);
  const customRules = useMemo(() => createSelectableRules(codeWrap), [codeWrap]);

  if (!content && !streaming) return null;

  if (!content && streaming) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={colors.textTertiary} />
      </View>
    );
  }

  const markdown = (
    <Markdown style={mdStyle} rules={customRules}>{content || ''}</Markdown>
  );

  return markdown;
});

const styles = StyleSheet.create({
  loading: {
    paddingVertical: spacing.sm,
    alignItems: 'flex-start',
  },
});
