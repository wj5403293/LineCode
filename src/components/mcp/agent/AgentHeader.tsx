import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Bot, ChevronRight, ChevronDown, CheckCircle, XCircle } from 'lucide-react-native';
import { colors, spacing, fontSizes } from '../../../constants/theme';

interface AgentHeaderProps {
  name: string;
  agentType: 'explore' | 'sub-coding';
  status: 'running' | 'done' | 'error';
  expanded: boolean;
  onToggle: () => void;
}

export function AgentHeader({ name, agentType, status, expanded, onToggle }: AgentHeaderProps) {
  const typeLabel = agentType === 'explore' ? '探索' : '编程';
  const typeColor = agentType === 'explore' ? colors.accent : '#F85149';

  return (
    <TouchableOpacity style={styles.header} onPress={onToggle} activeOpacity={0.7}>
      <View style={styles.left}>
        <View style={[styles.iconBadge, { backgroundColor: `${typeColor}20` }]}>
          <Bot size={14} color={typeColor} />
        </View>
        <View style={styles.titleSection}>
          <Text style={styles.title} numberOfLines={1}>{name}</Text>
          <Text style={styles.subtitle}>{typeLabel} Agent</Text>
        </View>
      </View>
      <View style={styles.right}>
        {status === 'running' ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : status === 'done' ? (
          <CheckCircle size={14} color="#3FB950" />
        ) : (
          <XCircle size={14} color="#F85149" />
        )}
        {expanded
          ? <ChevronDown size={16} color={colors.textTertiary} />
          : <ChevronRight size={16} color={colors.textTertiary} />
        }
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleSection: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
