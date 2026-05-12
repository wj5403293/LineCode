import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { spacing, radius } from '../../constants/theme';
import { useTheme } from '../../theme';
import { createUserMdStyle } from './markdownStyles';

interface Props {
  content: string;
}

export default React.memo(function UserBubble({ content }: Props) {
  const { colors } = useTheme();
  const mdStyle = useMemo(() => createUserMdStyle(colors), [colors]);

  return (
    <View style={styles.row}>
      <View style={[styles.bubble, { backgroundColor: colors.userBubble }]}>
        <Markdown style={mdStyle}>{content}</Markdown>
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
