import React, { useCallback, useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BookOpen, GraduationCap, Wrench } from 'lucide-react-native';
import { fontSizes, radius, spacing } from '../constants/theme';
import type { TutorialVariant } from '../constants/tutorial';
import { settingsService } from '../services/settings';
import { useTheme } from '../theme';

interface Props {
  onOpenTutorial: (variant: TutorialVariant) => void;
  onDone?: () => void;
}

export default function FirstLaunchGuideModal({ onOpenTutorial, onDone }: Props) {
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

  const handleOpen = useCallback((variant: TutorialVariant) => {
    dismiss();
    onOpenTutorial(variant);
  }, [dismiss, onOpenTutorial]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.accentMuted }]}>
            <BookOpen size={28} color={colors.accent} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>欢迎使用 LineCode</Text>
          <Text style={[styles.desc, { color: colors.textSecondary }]}>第一次使用建议先阅读教程。你可以选择适合自己的版本，之后也能从聊天页右上角三个点再次打开。</Text>

          <TouchableOpacity
            style={[styles.option, { backgroundColor: colors.surfaceLight, borderColor: colors.borderLight }]}
            onPress={() => handleOpen('beginner')}
            activeOpacity={0.75}
          >
            <GraduationCap size={22} color={colors.accent} />
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>新手版教程</Text>
              <Text style={[styles.optionDesc, { color: colors.textTertiary }]}>零基础，按步骤配置模型、Termux、SSH、MCP。</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.option, { backgroundColor: colors.surfaceLight, borderColor: colors.borderLight }]}
            onPress={() => handleOpen('professional')}
            activeOpacity={0.75}
          >
            <Wrench size={22} color={colors.accent} />
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>专业版手册</Text>
              <Text style={[styles.optionDesc, { color: colors.textTertiary }]}>面向开发者，覆盖协议、执行后端、权限与排障。</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={dismiss} activeOpacity={0.75}>
            <Text style={[styles.skipText, { color: colors.textTertiary }]}>稍后再看</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  desc: {
    fontSize: fontSizes.sm,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  option: {
    minHeight: 78,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  optionText: { flex: 1 },
  optionTitle: { fontSize: fontSizes.md, fontWeight: '800' },
  optionDesc: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 3 },
  skipButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { fontSize: fontSizes.sm, fontWeight: '600' },
});
