import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Copy, Download, ExternalLink, Search, ShieldCheck, Terminal, Wrench, Server } from 'lucide-react-native';
import { MCPConfig, WebSearchConfig, WebSearchProvider } from '../types';
import { mcpService } from '../services/MCPService';
import { MCPExecutionMode } from '../services/settings';
import {
  getDefaultWebSearchConfig,
  getWebSearchProviderDefaults,
  WEB_SEARCH_PROVIDER_LABELS,
  webSearchService,
} from '../services/WebSearchService';
import {
  SSHConfig,
  TERMUX_ALLOW_EXTERNAL_APPS_COMMAND,
  sshService,
} from '../services/SSHService';
import { spacing, fontSizes, radius } from '../constants/theme';
import { useTheme } from '../theme';
import ScreenHeader from '../components/ScreenHeader';

interface Props {
  onBack: () => void;
}

const MCP_ICONS: Record<string, typeof Wrench> = {
  file_ops: Wrench,
  http_server: Server,
  shell: Terminal,
  web_search: Search,
};

const DEFAULT_SSH_CONFIG: SSHConfig = {
  host: '127.0.0.1',
  port: 8022,
  username: '',
  password: '',
  privateKey: '',
  passphrase: '',
};

type SshTestStatus = {
  type: 'success' | 'error';
  title?: string;
  message: string;
};

const TERMUX_RUN_COMMAND_PERMISSION = 'com.termux.permission.RUN_COMMAND';

function redactTermuxPrivateKey(output: string): string {
  return output.replace(
    /LINEAI_PRIVATE_KEY_BEGIN[\s\S]*?LINEAI_PRIVATE_KEY_END/g,
    'LINEAI_PRIVATE_KEY=[已保存到 SSH Private key]',
  );
}

export default function MCPSettingsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [configs, setConfigs] = useState<MCPConfig[]>([]);
  const [executionMode, setExecutionMode] = useState<MCPExecutionMode>('local');
  const [sshConfig, setSshConfig] = useState<SSHConfig>(DEFAULT_SSH_CONFIG);
  const [testingSsh, setTestingSsh] = useState(false);
  const [settingUpTermux, setSettingUpTermux] = useState(false);
  const [sshTestStatus, setSshTestStatus] = useState<SshTestStatus | null>(null);
  const [webSearchConfig, setWebSearchConfig] = useState<WebSearchConfig>(getDefaultWebSearchConfig());
  const { colors } = useTheme();

  useEffect(() => {
    Promise.all([
      mcpService.getConfigs(),
      mcpService.getExecutionMode(),
      sshService.getConfig(),
      webSearchService.getConfig(),
    ]).then(([nextConfigs, nextMode, nextSshConfig, nextWebSearchConfig]) => {
      setConfigs(nextConfigs);
      setExecutionMode(nextMode);
      setSshConfig(nextSshConfig);
      setWebSearchConfig(nextWebSearchConfig);
    });
  }, []);

  const handleToggle = useCallback(async (id: string) => {
    await mcpService.toggleMCP(id);
    const updated = await mcpService.getConfigs();
    setConfigs(updated);
  }, []);

  const handleModeChange = useCallback(async (mode: MCPExecutionMode) => {
    await mcpService.setExecutionMode(mode);
    setExecutionMode(mode);
  }, []);

  const updateSshConfig = useCallback((patch: Partial<SSHConfig>) => {
    setSshConfig(prev => {
      const next = { ...prev, ...patch };
      sshService.saveConfig(next).catch(() => {});
      return next;
    });
    setSshTestStatus(null);
  }, []);

  const updateWebSearchConfig = useCallback((patch: Partial<WebSearchConfig>) => {
    setWebSearchConfig(prev => {
      const next = { ...prev, ...patch };
      webSearchService.saveConfig(next).catch(() => {});
      return next;
    });
  }, []);

  const handleWebSearchProviderChange = useCallback((provider: WebSearchProvider) => {
    const next = getWebSearchProviderDefaults(provider);
    setWebSearchConfig(next);
    webSearchService.saveConfig(next).catch(() => {});
  }, []);

  const handleTestSshConnection = useCallback(async () => {
    if (testingSsh) return;
    setTestingSsh(true);
    setSshTestStatus(null);
    try {
      await sshService.saveConfig(sshConfig);
      const output = await sshService.testConnection(sshConfig);
      setSshTestStatus({
        type: 'success',
        message: output.trim() || '连接正常',
      });
    } catch (err: any) {
      setSshTestStatus({
        type: 'error',
        message: err?.message || String(err),
      });
    } finally {
      setTestingSsh(false);
    }
  }, [sshConfig, testingSsh]);

  const handleCopyTermuxPermissionCommand = useCallback(() => {
    if (Platform.OS !== 'android') {
      Alert.alert('当前平台不支持', 'Termux 配置指令只适用于 Android。');
      return;
    }
    Clipboard.setString(TERMUX_ALLOW_EXTERNAL_APPS_COMMAND);
    setSshTestStatus({
      type: 'success',
      title: '已复制',
      message: 'Termux intent 执行授权指令已复制。打开 Termux 粘贴执行后，会写入 allow-external-apps=true 并尝试重新加载 Termux 设置。',
    });
  }, []);

  const requestTermuxRunCommandPermission = useCallback(async () => {
    try {
      const result = await PermissionsAndroid.request(TERMUX_RUN_COMMAND_PERMISSION as any);
      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        setSshTestStatus({ type: 'success', title: '已授权', message: 'LineAI 已获得 Termux RUN_COMMAND 权限。' });
        return;
      }
      await sshService.openLineAiAppSettings();
      setSshTestStatus({
        type: 'error',
        message: '请在 LineAI 的应用权限中允许“Run commands in Termux environment”，并先在 Termux 执行“复制授权指令”写入 allow-external-apps=true。',
      });
    } catch (err: any) {
      setSshTestStatus({
        type: 'error',
        message: err?.message || String(err),
      });
    }
  }, []);

  const handleRequestTermuxPermission = useCallback(() => {
    if (Platform.OS !== 'android') {
      Alert.alert('当前平台不支持', 'Termux 自动配置只支持 Android。');
      return;
    }

    Alert.alert(
      '先打开 Termux',
      '请先打开 Termux，并执行“复制授权指令”里的命令，确认 allow-external-apps=true 已写入。完成后再回来继续授权 RUN_COMMAND。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '打开 Termux',
          onPress: async () => {
            try {
              await sshService.openTermux();
            } catch (err: any) {
              setSshTestStatus({
                type: 'error',
                message: err?.message || String(err),
              });
            }
          },
        },
        {
          text: '继续授权',
          onPress: requestTermuxRunCommandPermission,
        },
      ],
    );
  }, [requestTermuxRunCommandPermission]);

  const handleOpenTermux = useCallback(async () => {
    try {
      await sshService.openTermux();
    } catch (err: any) {
      setSshTestStatus({
        type: 'error',
        message: err?.message || String(err),
      });
    }
  }, []);

  const handleSetupTermuxOpenSsh = useCallback(async () => {
    if (settingUpTermux) return;
    setSettingUpTermux(true);
    setSshTestStatus(null);
    try {
      const setup = await sshService.setupTermuxOpenSsh();
      setSshConfig(setup.config);
      const testOutput = await sshService.testConnection(setup.config);
      setSshTestStatus({
        type: 'success',
        message: [
          'Termux OpenSSH 已通过 intent 自动配置，SSH 设置已自动填入。',
          `shell: ${setup.shell || 'unknown'}`,
          `rc: ${setup.rcPath || 'unknown'}`,
          redactTermuxPrivateKey(testOutput.trim() || '连接正常'),
        ].join('\n'),
      });
    } catch (err: any) {
      setSshTestStatus({
        type: 'error',
        message: redactTermuxPrivateKey(err?.message || String(err)),
      });
    } finally {
      setSettingUpTermux(false);
    }
  }, [settingUpTermux]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader title="MCP 工具" onBack={onBack} />

      <ScrollView style={styles.list}>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>执行目标</Text>
          <View style={[styles.segment, { backgroundColor: colors.surfaceLight }]}>
            <ModeButton
              label="本地工作区"
              active={executionMode === 'local'}
              onPress={() => handleModeChange('local')}
            />
            <ModeButton
              label="SSH Shell"
              active={executionMode === 'ssh'}
              onPress={() => handleModeChange('ssh')}
            />
          </View>
          <Text style={[styles.cardDesc, { color: colors.textTertiary }]}>
            SSH Shell 模式会禁用本地文件读写、文件搜索、Agent 和 HTTP 服务器；网页搜索仍由应用侧网络配置执行。
          </Text>
        </View>

        {executionMode === 'ssh' && (
          <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>SSH 连接</Text>
            <Text style={[styles.cardDesc, { color: colors.textTertiary }]}>
              Termux 默认 host 为 127.0.0.1，端口为 8022；远程主机填写对应 IP 和端口。
            </Text>
            <View style={styles.termuxActions}>
              <ActionButton
                label="复制授权指令"
                icon={Copy}
                onPress={handleCopyTermuxPermissionCommand}
              />
              <ActionButton
                label="RUN_COMMAND 权限"
                icon={ShieldCheck}
                variant="secondary"
                onPress={handleRequestTermuxPermission}
              />
              <ActionButton
                label="打开 Termux"
                icon={ExternalLink}
                variant="secondary"
                onPress={handleOpenTermux}
              />
              <ActionButton
                label="自动配置 OpenSSH"
                icon={Download}
                loading={settingUpTermux}
                onPress={handleSetupTermuxOpenSsh}
              />
            </View>
            <LabeledInput
              label="Host"
              value={sshConfig.host}
              onChangeText={(host) => updateSshConfig({ host })}
            />
            <LabeledInput
              label="Port"
              value={String(sshConfig.port)}
              keyboardType="number-pad"
              onChangeText={(port) => updateSshConfig({ port: Number(port) || 8022 })}
            />
            <LabeledInput
              label="Username"
              value={sshConfig.username}
              onChangeText={(username) => updateSshConfig({ username })}
            />
            <LabeledInput
              label="Password (可选)"
              value={sshConfig.password}
              secureTextEntry
              onChangeText={(password) => updateSshConfig({ password })}
            />
            <LabeledInput
              label="Private key (无密码登录)"
              value={sshConfig.privateKey}
              multiline
              onChangeText={(privateKey) => updateSshConfig({ privateKey })}
            />
            <LabeledInput
              label="Key passphrase (可选)"
              value={sshConfig.passphrase}
              secureTextEntry
              onChangeText={(passphrase) => updateSshConfig({ passphrase })}
            />
            <TouchableOpacity
              style={[
                styles.testButton,
                { backgroundColor: colors.accent },
                testingSsh && styles.testButtonDisabled,
              ]}
              onPress={handleTestSshConnection}
              activeOpacity={0.75}
              disabled={testingSsh}
            >
              {testingSsh ? (
                <ActivityIndicator size="small" color={colors.textOnColor} />
              ) : (
                <Text style={[styles.testButtonText, { color: colors.textOnColor }]}>测试连接</Text>
              )}
            </TouchableOpacity>
            {sshTestStatus && (
              <View
                style={[
                  styles.testStatus,
                  {
                    backgroundColor: sshTestStatus.type === 'success' ? colors.accentMuted : colors.dangerMuted,
                    borderColor: sshTestStatus.type === 'success' ? colors.success : colors.danger,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.testStatusText,
                    { color: sshTestStatus.type === 'success' ? colors.success : colors.danger },
                  ]}
                >
                  {sshTestStatus.title || (sshTestStatus.type === 'success' ? '连接成功' : '连接失败')}
                </Text>
                <Text style={[styles.testStatusOutput, { color: colors.textSecondary }]}>
                  {sshTestStatus.message}
                </Text>
              </View>
            )}
            <View style={[styles.termuxBox, { backgroundColor: colors.codeBg, borderColor: colors.codeBorder }]}>
              <Text style={[styles.termuxTitle, { color: colors.text }]}>Termux intent 授权</Text>
              <Text style={[styles.commandText, { color: colors.textSecondary }]}>
                {TERMUX_ALLOW_EXTERNAL_APPS_COMMAND}
              </Text>
              <Text style={[styles.termuxHint, { color: colors.textTertiary }]}>
                先复制授权指令到 Termux 执行，它会写入 allow-external-apps=true。然后授权 LineAI 的 RUN_COMMAND 权限，再点自动配置 OpenSSH，通过 intent 安装 openssh、生成 LineAI 专用密钥、写入 authorized_keys、检测 shell rc 并启动 sshd。Termux 没有默认 SSH 密码；如需密码登录再手动执行 passwd。
              </Text>
            </View>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>网页搜索配置</Text>
          <Text style={[styles.cardDesc, { color: colors.textTertiary }]}>
            需要先打开“网页搜索”工具，并填写你自己的搜索 API、模型/搜索源和密钥。本地与 SSH 模式共用这组配置。
          </Text>
          <View style={styles.providerGrid}>
            {(Object.keys(WEB_SEARCH_PROVIDER_LABELS) as WebSearchProvider[]).map(provider => (
              <ProviderButton
                key={provider}
                label={WEB_SEARCH_PROVIDER_LABELS[provider]}
                active={webSearchConfig.provider === provider}
                onPress={() => handleWebSearchProviderChange(provider)}
              />
            ))}
          </View>
          <LabeledInput
            label="Search API URL"
            value={webSearchConfig.baseUrl}
            placeholder="https://api.example.com/search"
            onChangeText={(baseUrl) => updateWebSearchConfig({ baseUrl })}
          />
          <LabeledInput
            label="API Key"
            value={webSearchConfig.apiKey}
            placeholder="搜索服务密钥"
            secureTextEntry
            onChangeText={(apiKey) => updateWebSearchConfig({ apiKey })}
          />
          <LabeledInput
            label="模型 / 搜索源"
            value={webSearchConfig.model || ''}
            placeholder="如 basic、advanced、google，可留空"
            onChangeText={(model) => updateWebSearchConfig({ model })}
          />
          {webSearchConfig.provider === 'custom' && (
            <>
              <LabeledInput
                label="查询参数名"
                value={webSearchConfig.queryParam || 'q'}
                placeholder="q"
                onChangeText={(queryParam) => updateWebSearchConfig({ queryParam })}
              />
              <LabeledInput
                label="密钥 Header"
                value={webSearchConfig.apiKeyHeader || ''}
                placeholder="Authorization，可留空"
                onChangeText={(apiKeyHeader) => updateWebSearchConfig({ apiKeyHeader })}
              />
              <LabeledInput
                label="密钥 Query 参数"
                value={webSearchConfig.apiKeyParam || ''}
                placeholder="api_key，可留空"
                onChangeText={(apiKeyParam) => updateWebSearchConfig({ apiKeyParam })}
              />
            </>
          )}
        </View>

        {configs.map(config => {
          if (executionMode === 'local' && config.id === 'shell') return null;
          if (executionMode === 'ssh' && config.id !== 'shell' && config.id !== 'web_search') return null;
          const Icon = MCP_ICONS[config.id] || Wrench;
          return (
            <View key={config.id} style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconWrap, { backgroundColor: colors.accentMuted }]}>
                  <Icon size={18} color={config.enabled ? colors.accent : colors.textTertiary} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{config.name}</Text>
                  <Text style={[styles.cardDesc, { color: colors.textTertiary }]}>{config.description}</Text>
                </View>
                <Switch
                  value={config.enabled}
                  onValueChange={() => handleToggle(config.id)}
                  trackColor={{ false: colors.surfaceLight, true: colors.accentDim }}
                  thumbColor={config.enabled ? colors.accent : colors.textTertiary}
                />
              </View>
              <View style={[styles.toolsList, { borderTopColor: colors.borderLight }]}>
                {config.tools.map(tool => (
                  <View key={tool} style={[styles.toolBadge, { backgroundColor: colors.surfaceLight }]}>
                    <Text style={[styles.toolName, { color: colors.textSecondary }]}>{tool}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.modeButton, active && { backgroundColor: colors.accent }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.modeText, { color: active ? colors.textOnColor : colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ProviderButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.providerButton,
        {
          backgroundColor: active ? colors.accent : colors.surfaceLight,
          borderColor: active ? colors.accent : colors.borderLight,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.providerButtonText, { color: active ? colors.textOnColor : colors.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ActionButton({
  label,
  icon: Icon,
  loading,
  variant = 'primary',
  onPress,
}: {
  label: string;
  icon: typeof Copy;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        {
          backgroundColor: primary ? colors.accent : colors.surfaceLight,
          borderColor: primary ? colors.accent : colors.borderLight,
        },
        loading && styles.testButtonDisabled,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={primary ? colors.textOnColor : colors.textSecondary} />
      ) : (
        <>
          <Icon size={15} color={primary ? colors.textOnColor : colors.textSecondary} />
          <Text
            style={[
              styles.actionButtonText,
              { color: primary ? colors.textOnColor : colors.textSecondary },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  secureTextEntry?: boolean;
  multiline?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.inputRow}>
      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.borderLight }]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1, padding: spacing.lg },
  card: {
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    padding: 3,
    marginBottom: spacing.sm,
  },
  modeButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  providerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  providerButton: {
    minHeight: 34,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    flexBasis: '30%',
    flexGrow: 1,
  },
  providerButtonText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  cardDesc: {
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  inputRow: {
    marginTop: spacing.sm,
  },
  termuxActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    minHeight: 38,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexGrow: 1,
    flexBasis: '46%',
  },
  actionButtonText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: fontSizes.xs,
    marginBottom: 4,
  },
  input: {
    minHeight: 42,
    maxHeight: 160,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    fontSize: fontSizes.sm,
    textAlignVertical: 'top',
  },
  testButton: {
    minHeight: 42,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  testButtonDisabled: {
    opacity: 0.65,
  },
  testButtonText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  testStatus: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  testStatusText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    marginBottom: 3,
  },
  testStatusOutput: {
    fontSize: fontSizes.xs,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  termuxBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  termuxTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  commandText: {
    fontSize: fontSizes.xs,
    fontFamily: 'monospace',
    lineHeight: 19,
  },
  termuxHint: {
    fontSize: fontSizes.xs,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  toolsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toolBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  toolName: {
    fontSize: fontSizes.xs,
    fontFamily: 'monospace',
  },
});
