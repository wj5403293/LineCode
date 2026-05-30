import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GitBranch, CircleCheck, CircleX, Clock, Loader } from 'lucide-react-native';
import { AgentProgressItem } from '../../types';
import { spacing, radius } from '../../constants/theme';
import { useTheme } from '../../theme';
import AgentBlock from './AgentBlock';

interface Props {
  agents: AgentProgressItem[];
  fallbackName?: string;
  streaming?: boolean;
  homePath?: string;
  onCancelWait?: () => void;
}

export default React.memo(function AgentPipelineBlock({
  agents,
  fallbackName = 'Agent Pipeline',
  streaming,
  homePath,
  onCancelWait,
}: Props) {
  const { colors } = useTheme();
  const completedAgentIds = useMemo(
    () => new Set(agents.filter(agent => agent.status === 'done').map(agent => agent.id)),
    [agents],
  );
  const completed = agents.filter(agent => agent.status === 'done').length;
  const failed = agents.filter(agent => agent.status === 'error').length;
  const running = agents.filter(agent => agent.status === 'running' || agent.status === 'waiting_unlock').length;
  const waiting = agents.filter(agent => agent.status === 'waiting').length;

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight }]}>
      <View style={styles.header}>
        <View style={[styles.iconBadge, { borderColor: colors.codeBorder }]}>
          <GitBranch size={15} color={colors.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{fallbackName}</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <CircleCheck size={10} color={colors.success} />
              <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{completed} 完成</Text>
            </View>
            <View style={styles.summaryItem}>
              <Loader size={10} color={colors.accent} />
              <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{running} 运行</Text>
            </View>
            {waiting > 0 && (
              <View style={styles.summaryItem}>
                <Clock size={10} color={colors.textTertiary} />
                <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{waiting} 等待中</Text>
              </View>
            )}
            {failed > 0 && (
              <View style={styles.summaryItem}>
                <CircleX size={10} color={colors.danger} />
                <Text style={[styles.subtitle, { color: colors.danger }]}>{failed} 失败</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.agentList}>
        {agents.map(agent => (
          <AgentBlock
            key={agent.id}
            name={agent.name}
            agentType={agent.type}
            status={agent.status}
            dependencies={(agent.dependencies || []).map(depId => ({
              id: depId,
              completed: completedAgentIds.has(depId),
            }))}
            output={agent.output}
            thinking={agent.thinking}
            toolCalls={agent.toolCalls}
            streaming={streaming && (agent.status === 'running' || agent.status === 'waiting_unlock')}
            homePath={homePath}
            waitingForUnlock={agent.waitingForUnlock}
            onCancelWait={onCancelWait}
          />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    borderRadius: radius.sm,
    borderWidth: 1,
    marginVertical: 4,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 3,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  subtitle: {
    fontSize: 11,
  },
  agentList: {
    width: '100%',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
});
