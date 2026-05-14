import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GitBranch } from 'lucide-react-native';
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
  const completed = agents.filter(agent => agent.status === 'done').length;
  const failed = agents.filter(agent => agent.status === 'error').length;
  const running = agents.filter(agent => agent.status === 'running' || agent.status === 'waiting_unlock').length;

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight }]}>
      <View style={styles.header}>
        <View style={[styles.iconBadge, { backgroundColor: colors.accentMuted }]}>
          <GitBranch size={15} color={colors.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{fallbackName}</Text>
          <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
            {agents.length} 个 Agent · {completed} 完成 · {running} 运行{failed ? ` · ${failed} 失败` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.agentList}>
        {agents.map(agent => (
          <AgentBlock
            key={agent.id}
            name={agent.name}
            agentType={agent.type}
            status={agent.status}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  agentList: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
});
