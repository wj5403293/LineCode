import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openDocument } from 'react-native-saf-x';
import { Archive, Brain, ChevronRight, Cpu, FileText, Plus, Terminal, Wrench, X } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import SettingsSwitch from '../components/SettingsSwitch';
import { fontSizes, radius, spacing } from '../constants/theme';
import {
  CustomAgentExtension,
  CustomMcpExtension,
  ExtensionKind,
  extensionService,
  InstalledSkillExtension,
  PickedDocument,
  SkillInstallTarget,
} from '../services/ExtensionService';
import { useTheme } from '../theme';

interface Props {
  kind: ExtensionKind;
  onBack: () => void;
  onAddAgent: () => void;
  onEditAgent: (agentId: string) => void;
  onAddMcp: () => void;
  onEditMcp: (mcpId: string) => void;
}

const TITLE_MAP: Record<ExtensionKind, string> = {
  agent: 'Agent 扩展',
  mcp: 'MCP 扩展',
  skills: 'Skills 扩展',
  linecode: 'LineCode 扩展',
};

function getIcon(kind: ExtensionKind) {
  if (kind === 'agent') return Brain;
  if (kind === 'mcp') return Wrench;
  if (kind === 'skills') return Archive;
  return Cpu;
}

function getInlineActionText(kind: ExtensionKind): { title: string; desc: string } {
  if (kind === 'skills') {
    return {
      title: '选择 ZIP 安装',
      desc: '选择技能包后再选择安装位置，SSH 模式会推送到远端 ~/.linecode。',
    };
  }
  if (kind === 'agent') {
    return {
      title: '添加 Agent',
      desc: '自定义 Agent 可按需启停，关闭后不会参与提示词和工具调用。',
    };
  }
  return {
    title: '添加 HTTP/S MCP',
    desc: '自定义 MCP 可按需启停，关闭后不会作为工具暴露给 AI。',
  };
}

export default function ExtensionDetailScreen({ kind, onBack, onAddAgent, onEditAgent, onAddMcp, onEditMcp }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<CustomAgentExtension[]>([]);
  const [mcps, setMcps] = useState<CustomMcpExtension[]>([]);
  const [skills, setSkills] = useState<InstalledSkillExtension[]>([]);
  const [skillTargets, setSkillTargets] = useState<SkillInstallTarget[]>([]);
  const [pendingSkill, setPendingSkill] = useState<PickedDocument | null>(null);
  const [installingTarget, setInstallingTarget] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [nextAgents, nextMcps, nextSkills, nextSkillTargets] = await Promise.all([
        extensionService.getAgentExtensions(),
        extensionService.getMcpExtensions(),
        extensionService.getInstalledSkills(),
        extensionService.getSkillInstallTargets(),
      ]);
      setAgents(nextAgents);
      setMcps(nextMcps);
      setSkills(nextSkills);
      setSkillTargets(nextSkillTargets);
    } catch (err: any) {
      Alert.alert('加载失败', err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData().catch(() => {});
    }, [loadData]),
  );

  const handleAdd = useCallback(async () => {
    if (kind === 'agent') {
      onAddAgent();
      return;
    }
    if (kind === 'mcp') {
      onAddMcp();
      return;
    }
    if (kind === 'skills') {
      try {
        const docs = await openDocument({ persist: false, multiple: false });
        const doc = docs?.[0];
        if (!doc) return;
        if (doc.name && !doc.name.toLowerCase().endsWith('.zip')) {
          Alert.alert('请选择 ZIP', 'Skills 扩展需要选择 .zip 文件。');
          return;
        }
        setPendingSkill({ uri: doc.uri, name: doc.name });
      } catch (err: any) {
        Alert.alert('选择失败', err?.message || String(err));
      }
    }
  }, [kind, onAddAgent, onAddMcp]);

  const handleInstallSkill = useCallback(async (target: SkillInstallTarget) => {
    if (!pendingSkill || target.disabled || installingTarget) return;
    setInstallingTarget(target.id);
    try {
      const installed = await extensionService.installSkillZip(pendingSkill, target.id);
      setPendingSkill(null);
      await loadData();
      Alert.alert('安装完成', `${installed.locationLabel}\n${installed.path}`);
    } catch (err: any) {
      Alert.alert('安装失败', err?.message || String(err));
    } finally {
      setInstallingTarget(null);
    }
  }, [installingTarget, loadData, pendingSkill]);

  const handleAgentEnabled = useCallback(async (agentId: string, enabled: boolean) => {
    setAgents(prev => prev.map(agent => agent.id === agentId ? { ...agent, enabled } : agent));
    try {
      await extensionService.setAgentExtensionEnabled(agentId, enabled);
    } catch (err: any) {
      Alert.alert('保存失败', err?.message || String(err));
      loadData().catch(() => {});
    }
  }, [loadData]);

  const handleMcpEnabled = useCallback(async (mcpId: string, enabled: boolean) => {
    setMcps(prev => prev.map(mcp => mcp.id === mcpId ? { ...mcp, enabled } : mcp));
    try {
      await extensionService.setMcpExtensionEnabled(mcpId, enabled);
    } catch (err: any) {
      Alert.alert('保存失败', err?.message || String(err));
      loadData().catch(() => {});
    }
  }, [loadData]);

  const Icon = getIcon(kind);
  const canAdd = kind !== 'linecode';
  const showInlineAction = kind === 'agent' || kind === 'mcp' || kind === 'skills';
  const inlineActionText = getInlineActionText(kind);
  const rightAction = canAdd ? (
    <TouchableOpacity
      style={[styles.headerButton, { backgroundColor: colors.accentMuted }]}
      onPress={handleAdd}
      activeOpacity={0.75}
    >
      <Plus size={19} color={colors.accent} />
    </TouchableOpacity>
  ) : undefined;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader title={TITLE_MAP[kind]} onBack={onBack} rightAction={rightAction} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {showInlineAction ? (
          <View style={styles.section}>
            <SectionHeader title={kind === 'skills' ? '安装' : '添加'} />
            <View style={[styles.group, { backgroundColor: colors.surfaceElevated }]}>
              <TouchableOpacity
                style={styles.actionRow}
                onPress={handleAdd}
                activeOpacity={0.75}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.accentMuted }]}>
                  <Icon size={20} color={colors.accent} />
                </View>
                <View style={styles.actionText}>
                  <Text style={[styles.actionTitle, { color: colors.text }]}>
                    {inlineActionText.title}
                  </Text>
                  <Text style={[styles.actionDesc, { color: colors.textTertiary }]}>
                    {inlineActionText.desc}
                  </Text>
                </View>
                <ChevronRight size={17} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[styles.hero, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight }]}>
            <View style={[styles.heroIcon, { backgroundColor: colors.accentMuted }]}>
              <Icon size={22} color={colors.accent} />
            </View>
            <View style={styles.heroText}>
              <Text style={[styles.heroTitle, { color: colors.text }]}>{TITLE_MAP[kind]}</Text>
              <Text style={[styles.heroDesc, { color: colors.textTertiary }]}>
                该扩展类型为后续版本预留，当前暂不支持添加。
              </Text>
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>加载扩展...</Text>
          </View>
        ) : (
          <View style={styles.section}>
            <SectionHeader title={kind === 'skills' ? '已安装' : '自定义扩展'} />
            {renderCustomContent(
              kind,
              agents,
              mcps,
              skills,
              colors,
              handleAgentEnabled,
              onEditAgent,
              handleMcpEnabled,
              onEditMcp,
            )}
          </View>
        )}
      </ScrollView>

      <InstallTargetModal
        visible={!!pendingSkill}
        fileName={pendingSkill?.name || 'Skills ZIP'}
        targets={skillTargets}
        installingTarget={installingTarget}
        onClose={() => {
          if (!installingTarget) setPendingSkill(null);
        }}
        onSelect={handleInstallSkill}
      />
    </View>
  );
}

function renderCustomContent(
  kind: ExtensionKind,
  agents: CustomAgentExtension[],
  mcps: CustomMcpExtension[],
  skills: InstalledSkillExtension[],
  colors: ReturnType<typeof useTheme>['colors'],
  onAgentEnabledChange: (agentId: string, enabled: boolean) => void,
  onEditAgent: (agentId: string) => void,
  onMcpEnabledChange: (mcpId: string, enabled: boolean) => void,
  onEditMcp: (mcpId: string) => void,
) {
  if (kind === 'agent') {
    return agents.length === 0 ? (
      <EmptyState text="还没有自定义 Agent。点击右上角加号添加一个。" />
    ) : (
      <View style={[styles.group, { backgroundColor: colors.surfaceElevated }]}>
        {agents.map((agent, index) => (
          <AgentRow
            key={agent.id}
            agent={agent}
            last={index === agents.length - 1}
            onEnabledChange={onAgentEnabledChange}
            onEdit={onEditAgent}
          />
        ))}
      </View>
    );
  }

  if (kind === 'mcp') {
    return mcps.length === 0 ? (
      <EmptyState text="还没有自定义 MCP。点击右上角加号添加 HTTP/S MCP。" />
    ) : (
      <View style={[styles.group, { backgroundColor: colors.surfaceElevated }]}>
        {mcps.map((mcp, index) => (
          <McpRow
            key={mcp.id}
            mcp={mcp}
            last={index === mcps.length - 1}
            onEnabledChange={onMcpEnabledChange}
            onEdit={onEditMcp}
          />
        ))}
      </View>
    );
  }

  if (kind === 'skills') {
    return skills.length === 0 ? (
      <EmptyState text="还没有安装 Skills ZIP。点击右上角加号选择 ZIP。" />
    ) : (
      <View style={[styles.group, { backgroundColor: colors.surfaceElevated }]}>
        {skills.map((skill, index) => (
          <CustomRow
            key={skill.id}
            icon={<Archive size={18} color={colors.accent} />}
            title={skill.name}
            subtitle={skill.locationLabel}
            desc={skill.path}
            meta={skill.fileName}
            last={index === skills.length - 1}
          />
        ))}
      </View>
    );
  }

  return <EmptyState text="LineCode 扩展当前暂不支持添加。" />;
}

function AgentRow({
  agent,
  last,
  onEnabledChange,
  onEdit,
}: {
  agent: CustomAgentExtension;
  last: boolean;
  onEnabledChange: (agentId: string, enabled: boolean) => void;
  onEdit: (agentId: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.customRow,
        !last && { borderBottomColor: colors.borderLight, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
      onLongPress={() => onEdit(agent.id)}
      delayLongPress={350}
      activeOpacity={0.75}
    >
      <View style={[styles.customIcon, { backgroundColor: agent.enabled ? colors.accentMuted : colors.surfaceLight }]}>
        <Brain size={18} color={agent.enabled ? colors.accent : colors.textTertiary} />
      </View>
      <View style={styles.customText}>
        <View style={styles.customHeader}>
          <Text
            style={[styles.customTitle, { color: agent.enabled ? colors.text : colors.textTertiary }]}
            numberOfLines={1}
          >
            {agent.name}
          </Text>
          <Text style={[styles.customMeta, { color: agent.enabled ? colors.accent : colors.textTertiary }]} numberOfLines={1}>
            {`${agent.toolNames.length} 工具 · ${agent.mcpIds.length} MCP`}
          </Text>
        </View>
        <Text style={[styles.customSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {agent.slug}
        </Text>
        <Text style={[styles.customDesc, { color: colors.textTertiary }]} numberOfLines={2}>
          {agent.trigger || '未设置触发条件'}
        </Text>
      </View>
      <SettingsSwitch
        value={agent.enabled}
        onValueChange={(value) => onEnabledChange(agent.id, value)}
      />
    </TouchableOpacity>
  );
}

function McpRow({
  mcp,
  last,
  onEnabledChange,
  onEdit,
}: {
  mcp: CustomMcpExtension;
  last: boolean;
  onEnabledChange: (mcpId: string, enabled: boolean) => void;
  onEdit: (mcpId: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.customRow,
        !last && { borderBottomColor: colors.borderLight, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
      onLongPress={() => onEdit(mcp.id)}
      delayLongPress={350}
      activeOpacity={0.75}
    >
      <View style={[styles.customIcon, { backgroundColor: mcp.enabled ? colors.accentMuted : colors.surfaceLight }]}>
        <Wrench size={18} color={mcp.enabled ? colors.accent : colors.textTertiary} />
      </View>
      <View style={styles.customText}>
        <View style={styles.customHeader}>
          <Text
            style={[styles.customTitle, { color: mcp.enabled ? colors.text : colors.textTertiary }]}
            numberOfLines={1}
          >
            {mcp.name}
          </Text>
          <Text style={[styles.customMeta, { color: mcp.enabled ? colors.accent : colors.textTertiary }]} numberOfLines={1}>
            {`${mcp.tools.length} tools`}
          </Text>
        </View>
        <Text style={[styles.customSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {mcp.url}
        </Text>
        <Text style={[styles.customDesc, { color: colors.textTertiary }]} numberOfLines={2}>
          {mcp.tools.length > 0 ? mcp.tools.map(tool => tool.name).join(', ') : '未查询到 tools 列表'}
        </Text>
      </View>
      <SettingsSwitch
        value={mcp.enabled}
        onValueChange={(value) => onEnabledChange(mcp.id, value)}
      />
    </TouchableOpacity>
  );
}

function CustomRow({
  icon,
  title,
  subtitle,
  desc,
  meta,
  last,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  desc: string;
  meta: string;
  last: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.customRow,
        !last && { borderBottomColor: colors.borderLight, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <View style={[styles.customIcon, { backgroundColor: colors.accentMuted }]}>
        {icon}
      </View>
      <View style={styles.customText}>
        <View style={styles.customHeader}>
          <Text style={[styles.customTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.customMeta, { color: colors.accent }]} numberOfLines={1}>{meta}</Text>
        </View>
        <Text style={[styles.customSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>{subtitle}</Text>
        <Text style={[styles.customDesc, { color: colors.textTertiary }]} numberOfLines={2}>{desc}</Text>
      </View>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.emptyBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight }]}>
      <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{text}</Text>
    </View>
  );
}

function InstallTargetModal({
  visible,
  fileName,
  targets,
  installingTarget,
  onClose,
  onSelect,
}: {
  visible: boolean;
  fileName: string;
  targets: SkillInstallTarget[];
  installingTarget: string | null;
  onClose: () => void;
  onSelect: (target: SkillInstallTarget) => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.sheetOverlay, { backgroundColor: colors.overlay }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          disabled={!!installingTarget}
        />
        <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.textTertiary }]} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>安装位置</Text>
              <Text style={[styles.sheetDesc, { color: colors.textTertiary }]} numberOfLines={1}>
                {fileName}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.sheetClose, { backgroundColor: colors.surfaceLight }]}
              onPress={onClose}
              disabled={!!installingTarget}
            >
              <X size={17} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={[styles.targetGroup, { backgroundColor: colors.surfaceLight }]}>
            {targets.map((target, index) => {
              const Icon = target.id === 'ssh' ? Terminal : target.id === 'project' ? FileText : Archive;
              const busy = installingTarget === target.id;
              const disabled = target.disabled || !!installingTarget;
              return (
                <TouchableOpacity
                  key={`${target.id}-${target.label}`}
                  style={[
                    styles.targetRow,
                    index !== targets.length - 1 && { borderBottomColor: colors.borderLight, borderBottomWidth: StyleSheet.hairlineWidth },
                    target.disabled && styles.targetDisabled,
                  ]}
                  onPress={() => onSelect(target)}
                  disabled={disabled}
                  activeOpacity={0.75}
                >
                  <View style={[styles.targetIcon, { backgroundColor: colors.surfaceElevated }]}>
                    <Icon size={18} color={target.disabled ? colors.textTertiary : colors.accent} />
                  </View>
                  <View style={styles.targetText}>
                    <Text style={[styles.targetLabel, { color: colors.text }]}>{target.label}</Text>
                    <Text style={[styles.targetDesc, { color: colors.textTertiary }]}>{target.desc}</Text>
                  </View>
                  {busy && <ActivityIndicator size="small" color={colors.accent} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingBottom: 100,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    margin: spacing.lg,
    marginBottom: 0,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  heroDesc: {
    marginTop: spacing.xs,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  loadingBox: {
    paddingTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: fontSizes.sm,
  },
  section: {
    paddingTop: spacing.lg,
  },
  group: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  actionRow: {
    minHeight: 68,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  actionDesc: {
    marginTop: 2,
    fontSize: fontSizes.xs,
    lineHeight: 18,
  },
  customRow: {
    minHeight: 76,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  customIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customText: {
    flex: 1,
    minWidth: 0,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  customTitle: {
    flex: 1,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  customMeta: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  customSubtitle: {
    marginTop: 3,
    fontSize: fontSizes.xs,
  },
  customDesc: {
    marginTop: 3,
    fontSize: fontSizes.xs,
    lineHeight: 17,
  },
  emptyBox: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSizes.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
    opacity: 0.35,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sheetTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  sheetDesc: {
    marginTop: 2,
    fontSize: fontSizes.xs,
  },
  sheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetGroup: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  targetRow: {
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  targetIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetDisabled: {
    opacity: 0.45,
  },
  targetText: {
    flex: 1,
    minWidth: 0,
  },
  targetLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  targetDesc: {
    marginTop: 2,
    fontSize: fontSizes.xs,
    lineHeight: 17,
  },
});
