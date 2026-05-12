import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { ChevronRight, ChevronDown } from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';
import { spacing, fontSizes } from '../../../constants/theme';
import { useTheme } from '../../../theme';
import { createThinkingMdStyle } from '../../message/markdownStyles';

interface AgentThinkingProps {
  thinking?: string;
  streaming?: boolean;
  expanded: boolean;
  onToggle: () => void;
}

export function AgentThinking({ thinking, streaming, expanded, onToggle }: AgentThinkingProps) {
  const { colors } = useTheme();
  const mdStyle = useMemo(() => createThinkingMdStyle(colors), [colors]);

  if (!thinking) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.thinkingHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={[styles.thinkingIcon, { color: colors.textTertiary }]}>✦</Text>
        <Text style={[styles.thinkingLabel, { color: colors.textTertiary }]}>
          {streaming ? '思考中...' : '思考完毕'}
        </Text>
        {expanded
          ? <ChevronDown size={12} color={colors.textTertiary} />
          : <ChevronRight size={12} color={colors.textTertiary} />
        }
      </TouchableOpacity>

      {expanded && (
        <ScrollView style={[styles.thinkingContent, { borderTopColor: colors.borderLight }]} nestedScrollEnabled>
          <Markdown style={mdStyle}>{thinking}</Markdown>
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  thinkingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  thinkingIcon: {
    fontSize: 10,
  },
  thinkingLabel: {
    fontSize: fontSizes.xs,
    flex: 1,
  },
  thinkingContent: {
    maxHeight: 150,
    marginBottom: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
