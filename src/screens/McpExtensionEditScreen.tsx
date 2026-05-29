import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, Check, Search, Trash2 } from 'lucide-react-native';
import { fontSizes, radius, spacing } from '../constants/theme';
import { CustomMcpExtension, extensionService, McpRequestHeader, McpToolSummary } from '../services/ExtensionService';
import { ActionRow, FormSection, FormTextField, HeaderActionButton, ScreenScaffold, SettingsSection } from '../components/ui';
import { useTheme } from '../theme';

interface Props {
  onBack: () => void;
  mcpId?: string;
}

export default function McpExtensionEditScreen({ onBack, mcpId }: Props) {
  const { colors } = useTheme();
  const isEditing = !!mcpId;
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [requestHeaders, setRequestHeaders] = useState<McpRequestHeader[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [tools, setTools] = useState<McpToolSummary[]>([]);
  const [querying, setQuerying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [queried, setQueried] = useState(false);

  const applyMcpToForm = useCallback((mcp: CustomMcpExtension) => {
    setName(mcp.name);
    setUrl(mcp.url);
    setRequestHeaders(mcp.requestHeaders || []);
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
      const nextTools = await extensionService.queryMcpTools(url, requestHeaders);
      setTools(nextTools);
      setQueried(true);
    } catch (err: any) {
      Alert.alert('查询失败', err?.message || String(err));
    } finally {
      setQuerying(false);
    }
  }, [canQuery, requestHeaders, url]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const input = {
        enabled,
        name: name.trim(),
        url: url.trim().replace(/\/$/, ''),
        requestHeaders,
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
  }, [canSave, enabled, mcpId, name, onBack, requestHeaders, tools, url]);

  const handleAddHeader = useCallback(() => {
    setRequestHeaders(prev => [...prev, { name: '', value: '' }]);
  }, []);

  const handleChangeHeader = useCallback((index: number, field: keyof McpRequestHeader, value: string) => {
    setRequestHeaders(prev => prev.map((header, headerIndex) => (
      headerIndex === index ? { ...header, [field]: value } : header
    )));
    setTools([]);
    setQueried(false);
  }, []);

  const handleRemoveHeader = useCallback((index: number) => {
    setRequestHeaders(prev => prev.filter((_, headerIndex) => headerIndex !== index));
    setTools([]);
    setQueried(false);
  }, []);

  const rightAction = <HeaderActionButton label="保存" onPress={handleSave} disabled={!canSave} />;

  return (
    <ScreenScaffold title={isEditing ? '修改 MCP' : '添加 MCP'} onBack={onBack} rightAction={rightAction}>
        <FormSection title="连接信息">
            <FormTextField
              label="名称"
              value={name}
              onChangeText={setName}
              placeholder="例如：公司 MCP 服务"
            />
            <FormTextField
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
        </FormSection>

        <FormSection title="自定义请求头">
            <TouchableOpacity style={styles.addHeaderButton} onPress={handleAddHeader} activeOpacity={0.75}>
              <View style={[styles.smallIcon, { backgroundColor: colors.accentMuted }]}>
                <Plus size={16} color={colors.accent} />
              </View>
              <Text style={[styles.addHeaderText, { color: colors.accent }]}>添加请求头</Text>
            </TouchableOpacity>
            {requestHeaders.map((header, index) => (
              <View key={index} style={styles.headerRow}>
                <TextInput
                  style={[styles.headerInput, { backgroundColor: colors.surfaceLight, color: colors.text, borderColor: colors.borderLight }]}
                  value={header.name}
                  onChangeText={value => handleChangeHeader(index, 'name', value)}
                  placeholder="名字"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  style={[styles.headerInput, { backgroundColor: colors.surfaceLight, color: colors.text, borderColor: colors.borderLight }]}
                  value={header.value}
                  onChangeText={value => handleChangeHeader(index, 'value', value)}
                  placeholder="值"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity style={styles.removeHeaderButton} onPress={() => handleRemoveHeader(index)} activeOpacity={0.75}>
                  <Trash2 size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            ))}
            <Text style={[styles.hint, { color: colors.textTertiary }]}>查询和调用 MCP tools 时会附带这些请求头。</Text>
        </FormSection>

        <SettingsSection title="查询">
            <ActionRow
              icon={<Search size={19} color={canQuery ? colors.accent : colors.textTertiary} />}
              label="查询 MCP 列表"
              desc={tools.length > 0 ? `已查询到 ${tools.length} 个 tools，保存后会随扩展启用。` : '填写地址后查询服务暴露的 tools。'}
              busy={querying}
              disabled={!canQuery}
              showChevron
              activeOpacity={0.75}
              onPress={handleQuery}
            />
        </SettingsSection>

        <SettingsSection title={`TOOLS 列表 · ${tools.length}`}>
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
        </SettingsSection>
    </ScreenScaffold>
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
  addHeaderButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  smallIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addHeaderText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.sm,
  },
  removeHeaderButton: {
    width: 34,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontSize: fontSizes.xs,
    lineHeight: 17,
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
