import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronRight, Search } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import { fontSizes, radius, spacing } from '../constants/theme';
import { CustomMcpExtension, extensionService, McpToolSummary } from '../services/ExtensionService';
import { useTheme } from '../theme';

interface Props {
  onBack: () => void;
  mcpId?: string;
}

export default function McpExtensionEditScreen({ onBack, mcpId }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const isEditing = !!mcpId;
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [tools, setTools] = useState<McpToolSummary[]>([]);
  const [querying, setQuerying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [queried, setQueried] = useState(false);

  const applyMcpToForm = useCallback((mcp: CustomMcpExtension) => {
    setName(mcp.name);
    setUrl(mcp.url);
    setEnabled(mcp.enabled);
    setTools(mcp.tools);
    setQueried(mcp.tools.length > 0);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!mcpId) return;
      let mounted = true;
      extensionService.getMcpExtensions().then(mcps => {
        if (!mounted) return;
        const mcp = mcps.find(item => item.id === mcpId);
        if (!mcp) {
          Alert.alert('加载失败', '未找到要编辑的 MCP。');
          return;
        }
        applyMcpToForm(mcp);
      }).catch(err => {
        Alert.alert('加载失败', err?.message || String(err));
      });
      return () => {
        mounted = false;
      };
    }, [applyMcpToForm, mcpId]),
  );

  const urlValid = /^https?:\/\//i.test(url.trim());
  const canQuery = urlValid && !querying;
  const canSave = !!(name.trim() && urlValid) && !saving;

  const handleQuery = useCallback(async () => {
    if (!canQuery) return;
    setQuerying(true);
    try {
      const nextTools = await extensionService.queryMcpTools(url);
      setTools(nextTools);
      setQueried(true);
    } catch (err: any) {
      Alert.alert('查询失败', err?.message || String(err));
    } finally {
      setQuerying(false);
    }
  }, [canQuery, url]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const input = {
        enabled,
        name: name.trim(),
        url: url.trim().replace(/\/$/, ''),
        tools,
      };
      if (mcpId) {
        await extensionService.updateMcpExtension(mcpId, input);
      } else {
        await extensionService.saveMcpExtension(input);
      }
      onBack();
    } catch (err: any) {
      Alert.alert('保存失败', err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }, [canSave, enabled, mcpId, name, onBack, tools, url]);

  const rightAction = (
    <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={!canSave} activeOpacity={0.75}>
      <Text style={[styles.saveText, { color: canSave ? colors.accent : colors.textTertiary }]}>
        保存
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader title={isEditing ? '修改 MCP' : '添加 MCP'} onBack={onBack} rightAction={rightAction} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <SectionHeader title="连接信息" />
          <View style={[styles.formGroup, { backgroundColor: colors.surfaceElevated }]}>
            <LabeledInput
              label="名称"
              value={name}
              onChangeText={setName}
              placeholder="例如：公司 MCP 服务"
            />
            <LabeledInput
              label="HTTP/S 地址"
              value={url}
              onChangeText={(value) => {
                setUrl(value);
                setTools([]);
                setQueried(false);
              }}
              placeholder="https://example.com/mcp"
              hint={url && !urlValid ? '地址必须以 http:// 或 https:// 开头。' : '查询会请求 tools/list 并展示 MCP 工具列表。'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="查询" />
          <View style={[styles.group, { backgroundColor: colors.surfaceElevated }]}>
            <TouchableOpacity
              style={[styles.actionRow, !canQuery && styles.rowDisabled]}
              onPress={handleQuery}
              disabled={!canQuery}
              activeOpacity={0.75}
            >
              <View style={[styles.rowIcon, { backgroundColor: canQuery ? colors.accentMuted : colors.surfaceLight }]}>
                {querying ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Search size={19} color={canQuery ? colors.accent : colors.textTertiary} />
                )}
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: canQuery ? colors.text : colors.textTertiary }]}>
                  查询 MCP 列表
                </Text>
                <Text style={[styles.rowDesc, { color: colors.textTertiary }]}>
                  {tools.length > 0 ? `已查询到 ${tools.length} 个 tools，保存后会随扩展启用。` : '填写地址后查询服务暴露的 tools。'}
                </Text>
              </View>
              <ChevronRight size={17} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title={`TOOLS 列表 · ${tools.length}`} />
          <View style={[styles.group, { backgroundColor: colors.surfaceElevated }]}>
            {querying ? (
              <StateRow text="正在查询 MCP tools..." />
            ) : tools.length === 0 ? (
              <StateRow text={queried ? '没有查询到 tools。' : '查询后会在这里显示只读 tools 列表。'} />
            ) : tools.map((tool, index) => (
              <ToolRow
                key={tool.name}
                tool={tool}
                last={index === tools.length - 1}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surfaceLight, color: colors.text, borderColor: colors.borderLight }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {!!hint && <Text style={[styles.hint, { color: colors.textTertiary }]}>{hint}</Text>}
    </View>
  );
}

function ToolRow({ tool, last }: { tool: McpToolSummary; last: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.toolRow,
        !last && { borderBottomColor: colors.borderLight, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <View style={[styles.checkCircle, { backgroundColor: colors.accentMuted }]}>
        <Check size={13} color={colors.accent} />
      </View>
      <View style={styles.toolText}>
        <Text style={[styles.toolName, { color: colors.text }]} numberOfLines={1}>{tool.name}</Text>
        {!!tool.description && (
          <Text style={[styles.toolDesc, { color: colors.textTertiary }]} numberOfLines={2}>
            {tool.description}
          </Text>
        )}
      </View>
    </View>
  );
}

function StateRow({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stateRow}>
      <Text style={[styles.stateText, { color: colors.textTertiary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingBottom: 100,
  },
  saveButton: {
    minWidth: 54,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  section: {
    paddingTop: spacing.lg,
  },
  group: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  formGroup: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  input: {
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.md,
  },
  hint: {
    fontSize: fontSizes.xs,
    lineHeight: 17,
  },
  actionRow: {
    minHeight: 68,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  rowDesc: {
    marginTop: 2,
    fontSize: fontSizes.xs,
    lineHeight: 18,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolRow: {
    minHeight: 60,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  toolText: {
    flex: 1,
    minWidth: 0,
  },
  toolName: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  toolDesc: {
    marginTop: 3,
    fontSize: fontSizes.xs,
    lineHeight: 17,
  },
  stateRow: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  stateText: {
    paddingVertical: spacing.lg,
    textAlign: 'center',
    fontSize: fontSizes.sm,
  },
});
