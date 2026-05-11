import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { ChevronRight, ChevronDown } from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';
import { colors, spacing, fontSizes } from '../../../constants/theme';
import { thinkingMdStyle } from '../../message/markdownStyles';

interface AgentThinkingProps {
  thinking?: string;
  streaming?: boolean;
  expanded: boolean;
  onToggle: () => void;
}

export function AgentThinking({ thinking, streaming, expanded, onToggle }: AgentThinkingProps) {
  if (!thinking) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.thinkingHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={styles.thinkingIcon}>✦</Text>
        <Text style={styles.thinkingLabel}>
          {streaming ? '思考中...' : '思考完毕'}
        </Text>
        {expanded
          ? <ChevronDown size={12} color={colors.textTertiary} />
          : <ChevronRight size={12} color={colors.textTertiary} />
        }
      </TouchableOpacity>

      {expanded && (
        <ScrollView style={styles.thinkingContent} nestedScrollEnabled>
          <Markdown style={thinkingMdStyle}>{thinking}</Markdown>
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
    color: colors.textTertiary,
    fontSize: 10,
  },
  thinkingLabel: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    flex: 1,
  },
  thinkingContent: {
    maxHeight: 150,
    marginBottom: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
});
