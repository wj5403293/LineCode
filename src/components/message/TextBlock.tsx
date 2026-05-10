import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { colors, spacing } from '../../constants/theme';
import { mdStyle } from './markdownStyles';
import CodeBlock from '../CodeBlock';

interface Props {
  content: string;
  streaming?: boolean;
  codeWrap?: boolean;
}

export default React.memo(function TextBlock({ content, streaming, codeWrap }: Props) {
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
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={colors.textTertiary} />
      </View>
    );
  }

  return <Markdown style={mdStyle} rules={customRules}>{content || ''}</Markdown>;
});

const styles = StyleSheet.create({
  loading: {
    paddingVertical: spacing.sm,
    alignItems: 'flex-start',
  },
});
