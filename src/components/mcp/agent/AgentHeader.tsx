import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Bot, ChevronRight, ChevronDown, CheckCircle, XCircle, Clock } from 'lucide-react-native';
import { spacing, fontSizes } from '../../../constants/theme';
import { useTheme } from '../../../theme';

interface AgentHeaderProps {
  name: string;
  agentType: 'explore' | 'sub-coding';
  status: 'running' | 'done' | 'error' | 'waiting_unlock';
  expanded: boolean;
  onToggle: () => void;
}

export function AgentHeader({ name, agentType, status, expanded, onToggle }: AgentHeaderProps) {
  const { colors } = useTheme();
  const typeLabel = agentType === 'explore' ? '探索' : '编程';
  const typeColor = agentType === 'explore' ? colors.accent : colors.danger;

  return (
    <TouchableOpacity style={styles.header} onPress={onToggle} activeOpacity={0.7}>
      <View style={styles.left}>
        <View style={[styles.iconBadge, { backgroundColor: `${typeColor}20` }]}>
          <Bot size={14} color={typeColor} />
        </View>
        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{name}</Text>
          <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{typeLabel} Agent</Text>
        </View>
      </View>
      <View style={styles.right}>
        {status === 'running' ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : status === 'done' ? (
          <CheckCircle size={14} color={colors.success} />
        ) : status === 'waiting_unlock' ? (
          <Clock size={14} color={colors.processing} />
        ) : (
          <XCircle size={14} color={colors.danger} />
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
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: fontSizes.xs,
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
