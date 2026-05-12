import React, { useCallback, useMemo } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
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

export default React.memo(function TextBlock({ content, streaming, codeWrap }: Props) {
  const { colors } = useTheme();
  const mdStyle = useMemo(() => createMdStyle(colors), [colors]);

  if (!content && !streaming) return null;

  const handleLongPress = useCallback(() => {
    Clipboard.setString(content);
    Alert.alert('已复制', '文本已复制到剪贴板');
  }, [content]);

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

  return (
    <TouchableOpacity activeOpacity={0.8} onLongPress={handleLongPress}>
      <Markdown style={mdStyle} rules={customRules}>{content || ''}</Markdown>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  loading: {
    paddingVertical: spacing.sm,
    alignItems: 'flex-start',
  },
});
