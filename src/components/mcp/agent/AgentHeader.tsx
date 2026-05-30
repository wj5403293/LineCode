import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Bot, ChevronRight, ChevronDown, CheckCircle, XCircle, Clock, Code2, Search } from 'lucide-react-native';
import { spacing, fontSizes, radius } from '../../../constants/theme';
import { useTheme } from '../../../theme';

interface AgentHeaderProps {
  name: string;
  agentType: 'explore' | 'sub-coding';
  status: 'waiting' | 'running' | 'done' | 'error' | 'waiting_unlock';
  dependencies?: Array<{
    id: string;
    completed: boolean;
  }>;
  expanded: boolean;
  toolCount?: number;
  fileChangeCount?: number;
  onToggle: () => void;
}

function getStatusLabel(status: AgentHeaderProps['status']): string {
  if (status === 'waiting') return '等待中';
  if (status === 'running') return '运行中';
  if (status === 'done') return '完成';
  if (status === 'waiting_unlock') return '等待解锁';
  return '失败';
}

export const AgentHeader = React.memo(function AgentHeader({
  name,
  agentType,
  status,
  dependencies = [],
  expanded,
  toolCount = 0,
  fileChangeCount = 0,
  onToggle,
}: AgentHeaderProps) {
  const { colors } = useTheme();
  const typeLabel = agentType === 'explore' ? '探索' : '编程';
  const typeColor = agentType === 'explore' ? colors.accent : colors.danger;
  const TypeIcon = agentType === 'explore' ? Search : Code2;
  const statusLabel = getStatusLabel(status);
  const meta = [
    toolCount > 0 ? `${toolCount} 工具` : null,
    fileChangeCount > 0 ? `${fileChangeCount} 文件` : null,
  ].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity
      style={styles.header}
      onPress={onToggle}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${name}，${typeLabel} Agent，${statusLabel}${dependencies.length ? `，依赖 ${dependencies.map(dep => dep.id).join('、')}` : ''}`}
    >
      <View style={styles.left}>
        <View style={[styles.iconBadge, { borderColor: typeColor }]}>
          <Bot size={14} color={typeColor} />
        </View>
        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{name}</Text>
          <View style={styles.metaRow}>
            <View style={[styles.typePill, { backgroundColor: colors.codeBg, borderColor: colors.codeBorder }]}>
              <TypeIcon size={10} color={typeColor} />
              <Text style={[styles.typeText, { color: typeColor }]}>{typeLabel}</Text>
            </View>
            {dependencies.map(dep => (
              <View
                key={dep.id}
                style={[
                  styles.dependencyPill,
                  {
                    backgroundColor: dep.completed ? colors.accentMuted : colors.surfaceLight,
                    borderColor: dep.completed ? colors.success : colors.codeBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dependencyText,
                    { color: dep.completed ? colors.success : colors.textTertiary },
                  ]}
                  numberOfLines={1}
                >
                  {dep.id}
                </Text>
              </View>
            ))}
            {!!meta && (
              <Text style={[styles.subtitle, { color: colors.textTertiary }]} numberOfLines={1}>{meta}</Text>
            )}
          </View>
        </View>
      </View>
      <View style={styles.right}>
        {status === 'running' ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : status === 'waiting' ? (
          <Clock size={14} color={colors.textTertiary} />
        ) : status === 'done' ? (
          <CheckCircle size={14} color={colors.success} />
        ) : status === 'waiting_unlock' ? (
          <Clock size={14} color={colors.processing} />
        ) : (
          <XCircle size={14} color={colors.danger} />
        )}
        <Text style={[styles.statusText, { color: status === 'error' ? colors.danger : colors.textTertiary }]} numberOfLines={1}>
          {statusLabel}
        </Text>
        {expanded
          ? <ChevronDown size={16} color={colors.textTertiary} />
          : <ChevronRight size={16} color={colors.textTertiary} />
        }
      </View>
    </TouchableOpacity>
  );
});

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
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleSection: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 3,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  dependencyPill: {
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: 86,
  },
  dependencyText: {
    fontSize: 10,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: fontSizes.xs,
    flexShrink: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  statusText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    maxWidth: 64,
  },
});
