import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Brain, FileText, Sparkles, Wrench, X } from 'lucide-react-native';
import { fontSizes, radius, spacing } from '../constants/theme';
import { CustomAgentExtension, CustomMcpExtension, extensionService } from '../services/ExtensionService';
import { aiService } from '../services/ai';
import { modelStorage } from '../services/storage';
import { MCPConfig, ToolDefinition } from '../types';
import { useTheme } from '../theme';
import { ActionRow, FormSection, FormTextField, HeaderActionButton, ScreenScaffold, SelectableRow, SettingsSection } from '../components/ui';

interface Props {
  onBack: () => void;
  agentId?: string;
}

type MpcOption = {
  id: string;
  label: string;
  desc: string;
};

type GeneratedAgentDraft = {
  name?: string;
  slug?: string;
  prompt?: string;
  trigger?: string;
  toolNames?: string[];
  mcpIds?: string[];
};

const SLUG_PATTERN = /^[a-z][a-z0-9_-]*$/;

function normalizeSlug(value: string): string {
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 48);
  if (!clean) return '';
  return /^[a-z]/.test(clean) ? clean : `agent-${clean}`;
}

function extractJsonObject(text: string): GeneratedAgentDraft {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || text;
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('AI 没有返回有效 JSON。');
  }
  return JSON.parse(source.slice(start, end + 1));
}

export default function AgentExtensionEditScreen({ onBack, agentId }: Props) {
  const { colors } = useTheme();
  const isEditing = !!agentId;
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [prompt, setPrompt] = useState('');
  const [trigger, setTrigger] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [builtInMcps, setBuiltInMcps] = useState<MCPConfig[]>([]);
  const [customMcps, setCustomMcps] = useState<CustomMcpExtension[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>(['file_read', 'glob']);
  const [selectedMcps, setSelectedMcps] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiWriterVisible, setAiWriterVisible] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [generating, setGenerating] = useState(false);

  const applyAgentToForm = useCallback((agent: CustomAgentExtension) => {
    setName(agent.name);
    setSlug(agent.slug);
    setPrompt(agent.prompt);
    setTrigger(agent.trigger);
    setEnabled(agent.enabled);
    setSelectedTools(agent.toolNames);
    setSelectedMcps(agent.mcpIds);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      Promise.all([
        extensionService.getBuiltInTools(),
        extensionService.getBuiltInMcpConfigs(),
        extensionService.getMcpExtensions(),
        extensionService.getAgentExtensions(),
      ]).then(([nextTools, nextBuiltInMcps, nextCustomMcps, nextAgents]) => {
        if (!mounted) return;
        setTools(nextTools);
        setBuiltInMcps(nextBuiltInMcps);
        setCustomMcps(nextCustomMcps);
        if (agentId) {
          const agent = nextAgents.find(item => item.id === agentId);
          if (!agent) {
            Alert.alert('加载失败', '未找到要编辑的 Agent。');
            return;
          }
          applyAgentToForm(agent);
        }
      }).catch(err => {
        Alert.alert('加载失败', err?.message || String(err));
      });
      return () => {
        mounted = false;
      };
    }, [agentId, applyAgentToForm]),
  );

  const mcpOptions = useMemo<MpcOption[]>(() => [
    ...builtInMcps.map(item => ({
      id: `builtin:${item.id}`,
      label: item.name,
      desc: item.tools.join(', '),
    })),
    ...customMcps.filter(item => item.enabled).map(item => ({
      id: `custom:${item.id}`,
      label: item.name,
      desc: item.url,
    })),
  ], [builtInMcps, customMcps]);

  const slugValid = SLUG_PATTERN.test(slug.trim());
  const canSave = !!(name.trim() && slugValid && prompt.trim()) && !saving;
  const canGenerate = !!aiDescription.trim() && !generating;

  const toggleTool = useCallback((toolName: string) => {
    setSelectedTools(prev => prev.includes(toolName)
      ? prev.filter(item => item !== toolName)
      : [...prev, toolName]);
  }, []);

  const toggleMcp = useCallback((id: string) => {
    setSelectedMcps(prev => prev.includes(id)
      ? prev.filter(item => item !== id)
      : [...prev, id]);
  }, []);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const input = {
        enabled,
        name: name.trim(),
        slug: slug.trim(),
        prompt: prompt.trim(),
        trigger: trigger.trim(),
        toolNames: selectedTools,
        mcpIds: selectedMcps,
      };
      if (agentId) {
        await extensionService.updateAgentExtension(agentId, input);
      } else {
        await extensionService.saveAgentExtension(input);
      }
      onBack();
    } catch (err: any) {
      Alert.alert('保存失败', err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }, [agentId, canSave, enabled, name, onBack, prompt, selectedMcps, selectedTools, slug, trigger]);

  const handleGenerateWithAi = useCallback(async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      const [models, selectedId] = await Promise.all([
        modelStorage.getModels(),
        modelStorage.getSelectedModelId(),
      ]);
      const model = models.find(item => item.id === selectedId) || models[0];
      if (!model) {
        Alert.alert('缺少模型', '请先在设置中添加并选择一个模型。');
        return;
      }

      const toolList = tools.map(tool => ({
        name: tool.name,
        category: tool.category,
        description: tool.description,
      }));
      const mcpList = mcpOptions.map(item => ({
        id: item.id,
        name: item.label,
        description: item.desc,
      }));

      const result = await aiService.sendMessage(
        model,
        [
          {
            role: 'system',
            content: [
              '你是 LineCode 的自定义 Agent 配置生成器。',
              '根据用户描述生成一个 Agent 配置草稿，只输出 JSON 对象，不要 Markdown，不要解释。',
              'JSON 字段必须是：name, slug, prompt, trigger, toolNames, mcpIds。',
              'name 使用简短中文名；slug 使用小写英文、数字、- 或 _，必须以小写字母开头。',
              'prompt 要写成可直接作为 Agent 系统提示词使用的中文说明，包含角色、任务边界、工作流程、输出要求和安全约束。',
              'trigger 用中文描述何时适合触发这个 Agent。',
              'toolNames 只能从可用工具 name 中选择；mcpIds 只能从可用 MCP id 中选择；不确定时优先选择 file_read 和 glob。',
            ].join('\n'),
          },
          {
            role: 'user',
            content: JSON.stringify({
              userNeed: aiDescription.trim(),
              availableTools: toolList,
              availableMcp: mcpList,
            }, null, 2),
          },
        ],
        undefined,
        'off',
        [],
      );

      const draft = extractJsonObject(result.text);
      const allowedTools = new Set(tools.map(tool => tool.name));
      const allowedMcps = new Set(mcpOptions.map(item => item.id));
      const nextName = String(draft.name || '').trim();
      const nextSlug = normalizeSlug(String(draft.slug || nextName || 'custom-agent'));
      const nextPrompt = String(draft.prompt || '').trim();
      const nextTrigger = String(draft.trigger || '').trim();
      const nextTools = Array.isArray(draft.toolNames)
        ? draft.toolNames.map(String).filter(item => allowedTools.has(item))
        : [];
      const nextMcps = Array.isArray(draft.mcpIds)
        ? draft.mcpIds.map(String).filter(item => allowedMcps.has(item))
        : [];

      if (!nextName || !nextSlug || !nextPrompt) {
        throw new Error('AI 返回的配置缺少 name、slug 或 prompt。');
      }

      setName(nextName);
      setSlug(nextSlug);
      setPrompt(nextPrompt);
      setTrigger(nextTrigger);
      setSelectedTools(nextTools.length > 0 ? nextTools : ['file_read', 'glob']);
      setSelectedMcps(nextMcps);
      setAiWriterVisible(false);
    } catch (err: any) {
      Alert.alert('生成失败', err?.message || String(err));
    } finally {
      setGenerating(false);
    }
  }, [aiDescription, canGenerate, mcpOptions, tools]);

  const rightAction = <HeaderActionButton label="保存" onPress={handleSave} disabled={!canSave} />;

  return (
    <ScreenScaffold title={isEditing ? '修改 Agent' : '添加 Agent'} onBack={onBack} rightAction={rightAction}>
        <SettingsSection title="快速创建">
          <ActionRow
            icon={<Sparkles size={20} color={colors.accent} />}
            label="让 AI 写"
            desc="直接描述所需 Agent，自动填写名称、提示词、触发条件和权限。"
            showChevron
            activeOpacity={0.75}
            onPress={() => setAiWriterVisible(true)}
          />
        </SettingsSection>

        <FormSection title="基础信息">
            <FormTextField label="名字" value={name} onChangeText={setName} placeholder="例如：测试修复 Agent" />
            <FormTextField
              label="英文标识"
              value={slug}
              onChangeText={(value) => setSlug(normalizeSlug(value))}
              placeholder="test-fixer"
              hint={slug && !slugValid ? '必须以小写字母开头，只能包含 a-z、0-9、_ 和 -。' : '用于触发和识别自定义 Agent。'}
            />
        </FormSection>

        <FormSection title="行为定义">
            <FormTextField
              label="提示词"
              value={prompt}
              onChangeText={setPrompt}
              placeholder="描述这个 Agent 的角色、边界、输出格式和验收方式"
              multiline
              icon={<Brain size={18} color={colors.textSecondary} />}
            />
            <FormTextField
              label="触发条件"
              value={trigger}
              onChangeText={setTrigger}
              placeholder="例如：用户要求修复测试、分析性能、重构组件时触发"
              multiline
              icon={<FileText size={18} color={colors.textSecondary} />}
            />
        </FormSection>

        <SettingsSection title={`可使用的工具 · 已选 ${selectedTools.length}`}>
            {tools.map((tool, index) => (
              <SelectableRow
                key={tool.name}
                label={tool.name}
                desc={`${tool.category} · ${tool.description}`}
                selected={selectedTools.includes(tool.name)}
                onPress={() => toggleTool(tool.name)}
                icon={<Wrench size={19} color={selectedTools.includes(tool.name) ? colors.accent : colors.textSecondary} />}
                last={index === tools.length - 1}
              />
            ))}
        </SettingsSection>

        <SettingsSection title={`可使用的 MCP · 已选 ${selectedMcps.length}`}>
          {mcpOptions.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无 MCP 可选。</Text>
            </View>
          ) : (
            <>
              {mcpOptions.map((option, index) => (
                <SelectableRow
                  key={option.id}
                  label={option.label}
                  desc={option.desc}
                  selected={selectedMcps.includes(option.id)}
                  onPress={() => toggleMcp(option.id)}
                  icon={<Wrench size={19} color={selectedMcps.includes(option.id) ? colors.accent : colors.textSecondary} />}
                  last={index === mcpOptions.length - 1}
                />
              ))}
            </>
          )}
        </SettingsSection>
      <AiWriterModal
        visible={aiWriterVisible}
        value={aiDescription}
        generating={generating}
        canGenerate={canGenerate}
        onChangeText={setAiDescription}
        onClose={() => {
          if (!generating) setAiWriterVisible(false);
        }}
        onGenerate={handleGenerateWithAi}
      />
    </ScreenScaffold>
  );
}

function AiWriterModal({
  visible,
  value,
  generating,
  canGenerate,
  onChangeText,
  onClose,
  onGenerate,
}: {
  visible: boolean;
  value: string;
  generating: boolean;
  canGenerate: boolean;
  onChangeText: (value: string) => void;
  onClose: () => void;
  onGenerate: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modalCard, { backgroundColor: colors.surfaceElevated }]}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleWrap}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>让 AI 写 Agent</Text>
              <Text style={[styles.modalDesc, { color: colors.textTertiary }]}>描述目标后会自动填入当前表单。</Text>
            </View>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.surfaceLight }]}
              onPress={onClose}
              disabled={generating}
              activeOpacity={0.75}
            >
              <X size={17} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={[styles.aiPromptInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.borderLight }]}
            value={value}
            onChangeText={onChangeText}
            placeholder="例如：我想要一个专门帮我分析 React Native 性能问题的 Agent，会先读相关组件和 hooks，定位重渲染、列表性能和网络请求问题，然后给出修复建议。"
            placeholderTextColor={colors.textTertiary}
            multiline
            textAlignVertical="top"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.generateButton, { backgroundColor: canGenerate ? colors.accent : colors.surfaceLight }]}
            onPress={onGenerate}
            disabled={!canGenerate}
            activeOpacity={0.75}
          >
            {generating ? (
              <ActivityIndicator size="small" color={colors.textOnColor} />
            ) : (
              <>
                <Sparkles size={16} color={canGenerate ? colors.textOnColor : colors.textTertiary} />
                <Text style={[styles.generateText, { color: canGenerate ? colors.textOnColor : colors.textTertiary }]}>
                  生成并填写
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  empty: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSizes.sm,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  modalTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  modalDesc: {
    marginTop: 2,
    fontSize: fontSizes.xs,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiPromptInput: {
    minHeight: 160,
    marginTop: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    fontSize: fontSizes.md,
    lineHeight: 21,
  },
  generateButton: {
    height: 44,
    marginTop: spacing.md,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  generateText: {
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
});
