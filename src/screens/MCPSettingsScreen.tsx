import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Terminal, Wrench, Server } from 'lucide-react-native';
import { MCPConfig } from '../types';
import { mcpService } from '../services/MCPService';
import { MCPExecutionMode } from '../services/settings';
import { SSHConfig, sshService } from '../services/SSHService';
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
  message: string;
};

export default function MCPSettingsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [configs, setConfigs] = useState<MCPConfig[]>([]);
  const [executionMode, setExecutionMode] = useState<MCPExecutionMode>('local');
  const [sshConfig, setSshConfig] = useState<SSHConfig>(DEFAULT_SSH_CONFIG);
  const [testingSsh, setTestingSsh] = useState(false);
  const [sshTestStatus, setSshTestStatus] = useState<SshTestStatus | null>(null);
  const { colors } = useTheme();

  useEffect(() => {
    Promise.all([
      mcpService.getConfigs(),
      mcpService.getExecutionMode(),
      sshService.getConfig(),
    ]).then(([nextConfigs, nextMode, nextSshConfig]) => {
      setConfigs(nextConfigs);
      setExecutionMode(nextMode);
      setSshConfig(nextSshConfig);
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
            SSH Shell 模式会禁用本地读写、搜索、Agent 和 HTTP 服务器，只允许执行 SSH 命令。
          </Text>
        </View>

        {executionMode === 'ssh' && (
          <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>SSH 连接</Text>
            <Text style={[styles.cardDesc, { color: colors.textTertiary }]}>
              Termux 默认 host 为 127.0.0.1，端口为 8022；远程主机填写对应 IP 和端口。
            </Text>
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
                  {sshTestStatus.type === 'success' ? '连接成功' : '连接失败'}
                </Text>
                <Text style={[styles.testStatusOutput, { color: colors.textSecondary }]}>
                  {sshTestStatus.message}
                </Text>
              </View>
            )}
            <View style={[styles.termuxBox, { backgroundColor: colors.codeBg, borderColor: colors.codeBorder }]}>
              <Text style={[styles.termuxTitle, { color: colors.text }]}>Termux 安装 sshd</Text>
              <Text style={[styles.commandText, { color: colors.textSecondary }]}>
                pkg update{'\n'}
                pkg install openssh{'\n'}
                passwd{'\n'}
                sshd{'\n'}
                whoami{'\n'}
                ip addr{'\n\n'}
                ssh-keygen -t ed25519 -f ~/.ssh/lineai_key -N ""{'\n'}
                cat ~/.ssh/lineai_key.pub &gt;&gt; ~/.ssh/authorized_keys{'\n'}
                chmod 700 ~/.ssh{'\n'}
                chmod 600 ~/.ssh/authorized_keys{'\n'}
                cat ~/.ssh/lineai_key
              </Text>
              <Text style={[styles.termuxHint, { color: colors.textTertiary }]}>
                密码登录先执行 passwd；无密码登录把 private key 对应的 public key 写入 Termux 的 authorized_keys。
              </Text>
            </View>
          </View>
        )}

        {configs.map(config => {
          if (executionMode === 'local' && config.id === 'shell') return null;
          if (executionMode === 'ssh' && config.id !== 'shell') return null;
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

function LabeledInput({
  label,
  value,
  onChangeText,
  keyboardType,
  secureTextEntry,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
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
