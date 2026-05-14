import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Code2, User, MessageCircle, FileText, ChevronRight, Bug } from 'lucide-react-native';
import { spacing, fontSizes, radius } from '../constants/theme';
import { useTheme } from '../theme';
import { APP_VERSION } from '../constants/appInfo';

interface AboutItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  hiddenPress?: boolean;
}

function AboutItem({ icon, label, value, onPress, hiddenPress }: AboutItemProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: colors.surfaceElevated }]}
      onPress={onPress}
      activeOpacity={onPress && !hiddenPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[styles.itemIcon, { backgroundColor: colors.accentMuted }]}>{icon}</View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemLabel, { color: colors.text }]}>{label}</Text>
        {value && <Text style={[styles.itemValue, { color: colors.textSecondary }]}>{value}</Text>}
      </View>
      {onPress && !hiddenPress && <ChevronRight size={18} color={colors.textTertiary} />}
    </TouchableOpacity>
  );
}

interface Props {
  onOpenLicenses: () => void;
  onOpenDebug: () => void;
}

const AUTHOR_UNLOCK_TAPS = 5;
const QQ_UNLOCK_TAPS = 4;

export default function AboutScreen({ onOpenLicenses, onOpenDebug }: Props) {
  const { colors } = useTheme();
  const [authorTaps, setAuthorTaps] = useState(0);
  const [qqTaps, setQqTaps] = useState(0);
  const debugUnlocked = authorTaps === AUTHOR_UNLOCK_TAPS && qqTaps === QQ_UNLOCK_TAPS;

  const handleAuthorPress = useCallback(() => {
    setAuthorTaps(count => (count >= AUTHOR_UNLOCK_TAPS ? 0 : count + 1));
  }, []);

  const handleQqPress = useCallback(() => {
    setQqTaps(count => (count >= QQ_UNLOCK_TAPS ? 0 : count + 1));
  }, []);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.surface }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: colors.accentMuted }]}>
          <Code2 size={48} color={colors.accent} />
        </View>
        <Text style={[styles.appName, { color: colors.text }]}>LineCode</Text>
        <Text style={[styles.version, { color: colors.textSecondary }]}>v{APP_VERSION}</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>开发者</Text>
        <AboutItem
          icon={<User size={20} color={colors.accent} />}
          label="作者"
          value="LangLang"
          onPress={handleAuthorPress}
          hiddenPress
        />
        <AboutItem
          icon={<MessageCircle size={20} color={colors.accent} />}
          label="QQ"
          value="3772548978"
          onPress={handleQqPress}
          hiddenPress
        />
      </View>

      {debugUnlocked && (
        <View style={styles.section}>
          <AboutItem
            icon={<Bug size={20} color={colors.accent} />}
            label="调试模式"
            value="错误处理器测试和最近错误报告"
            onPress={onOpenDebug}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>法律信息</Text>
        <AboutItem
          icon={<FileText size={20} color={colors.accent} />}
          label="开源许可列表"
          onPress={onOpenLicenses}
        />
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textTertiary }]}>
          Copyright 2025 LangLang. All rights reserved.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  appName: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  version: {
    fontSize: fontSizes.md,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSizes.sm,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  itemContent: {
    flex: 1,
  },
  itemLabel: {
    fontSize: fontSizes.md,
  },
  itemValue: {
    fontSize: fontSizes.sm,
    marginTop: 2,
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: fontSizes.xs,
  },
});
