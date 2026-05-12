import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { ChevronRight, ChevronDown } from 'lucide-react-native';
import { spacing, fontSizes } from '../../constants/theme';
import { useTheme } from '../../theme';
import { createThinkingMdStyle } from './markdownStyles';

interface Props {
  content: string;
  streaming?: boolean;
  autoExpand?: boolean;
  scrollable?: boolean;
}

export default React.memo(function ThinkingBlock({ content, streaming, autoExpand, scrollable }: Props) {
  const { colors } = useTheme();
  const mdStyle = useMemo(() => createThinkingMdStyle(colors), [colors]);
  const [expanded, setExpanded] = useState(autoExpand || false);

  useEffect(() => {
    if (autoExpand) setExpanded(true);
  }, [autoExpand]);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.row}>
          <Text style={[styles.icon, { color: colors.textTertiary }]}>✦</Text>
          <Text style={[styles.label, { color: colors.textTertiary }]} numberOfLines={1}>
            {streaming ? '思考中...' : '思考完毕'}
          </Text>
          {expanded
            ? <ChevronDown size={12} color={colors.textTertiary} />
            : <ChevronRight size={12} color={colors.textTertiary} />}
        </View>
      </TouchableOpacity>
      {expanded && (
        scrollable ? (
          <ScrollView style={[styles.scroll, { borderTopColor: colors.borderLight }]} nestedScrollEnabled>
            <Markdown style={mdStyle}>{content}</Markdown>
          </ScrollView>
        ) : (
          <View style={[styles.content, { borderTopColor: colors.borderLight }]}>
            <Markdown style={mdStyle}>{content}</Markdown>
          </View>
        )
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  header: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    fontSize: 10,
  },
  label: {
    fontSize: fontSizes.xs,
  },
  scroll: {
    maxHeight: 180,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  content: {
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
