import React, { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Server, Terminal, Wrench } from 'lucide-react-native';
import { spacing, fontSizes, radius } from '../constants/theme';
import { TERMUX_ALLOW_EXTERNAL_APPS_COMMAND } from '../services/SSHService';
import { settingsService } from '../services/settings';
import { useTheme } from '../theme';

interface Props {
  onDone?: () => void;
}

export default function FirstLaunchGuideModal({ onDone }: Props) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    settingsService.getFirstLaunchGuideSeen()
      .then((seen) => {
        if (!mounted) return;
        if (seen) {
          onDone?.();
        } else {
          setVisible(true);
        }
      })
      .catch(() => onDone?.());

    return () => { mounted = false; };
  }, [onDone]);

  const dismiss = useCallback(() => {
    setVisible(false);
    settingsService.setFirstLaunchGuideSeen(true).catch(() => {});
    onDone?.();
  }, [onDone]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight }]}>
          <Text style={[styles.title, { color: colors.text }]}>使用指南</Text>
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <GuideItem
              icon={<Wrench size={18} color={colors.accent} />}
              title="添加模型"
              text="在设置中添加 OpenAI 兼容或 Anthropic 模型，填写 Base URL、API key 和模型 ID。"
            />
            <GuideItem
              icon={<Terminal size={18} color={colors.accent} />}
              title="MCP 与权限"
              text="本地工作区支持文件读写、搜索、Agent 和 HTTP 服务器；SSH Shell 模式只允许执行 shell 命令。"
            />
            <GuideItem
              icon={<Server size={18} color={colors.accent} />}
              title="Termux intent 授权"
              text={TERMUX_ALLOW_EXTERNAL_APPS_COMMAND}
              monospace
            />
            <Text style={[styles.note, { color: colors.textSecondary }]}>
              先在 Termux 执行授权指令，再回设置页授权 RUN_COMMAND 并自动配置 OpenSSH。Termux 默认连接 127.0.0.1:8022；没有默认 SSH 密码。
            </Text>
          </ScrollView>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.accent }]}
            onPress={dismiss}
            activeOpacity={0.75}
          >
            <Text style={[styles.buttonText, { color: colors.textOnColor }]}>知道了</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function GuideItem({
  icon,
  title,
  text,
  monospace,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  monospace?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.item}>
      <View style={[styles.iconWrap, { backgroundColor: colors.accentMuted }]}>
        {icon}
      </View>
      <View style={styles.itemText}>
        <Text style={[styles.itemTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.itemDesc, { color: colors.textSecondary }, monospace && styles.monospace]}>
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    maxHeight: '82%',
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  body: {
    marginBottom: spacing.md,
  },
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    marginBottom: 3,
  },
  itemDesc: {
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  monospace: {
    fontFamily: 'monospace',
  },
  note: {
    fontSize: fontSizes.xs,
    lineHeight: 18,
  },
  button: {
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
});
