import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Code2, User, MessageCircle, FileText, ChevronRight } from 'lucide-react-native';
import { colors, spacing, fontSizes, radius } from '../constants/theme';

const VERSION = '1.0.0-beta.1';

interface AboutItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
}

function AboutItem({ icon, label, value, onPress }: AboutItemProps) {
  return (
    <TouchableOpacity
      style={styles.item}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.itemIcon}>{icon}</View>
      <View style={styles.itemContent}>
        <Text style={styles.itemLabel}>{label}</Text>
        {value && <Text style={styles.itemValue}>{value}</Text>}
      </View>
      {onPress && <ChevronRight size={18} color={colors.textTertiary} />}
    </TouchableOpacity>
  );
}

interface Props {
  onOpenLicenses: () => void;
}

export default function AboutScreen({ onOpenLicenses }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Code2 size={48} color={colors.accent} />
        </View>
        <Text style={styles.appName}>LineCode</Text>
        <Text style={styles.version}>v{VERSION}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>开发者</Text>
        <AboutItem
          icon={<User size={20} color={colors.accent} />}
          label="作者"
          value="LangLang"
        />
        <AboutItem
          icon={<MessageCircle size={20} color={colors.accent} />}
          label="QQ"
          value="3772548978"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>法律信息</Text>
        <AboutItem
          icon={<FileText size={20} color={colors.accent} />}
          label="开源许可列表"
          onPress={onOpenLicenses}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Copyright 2025 LangLang. All rights reserved.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
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
    backgroundColor: 'rgba(48,209,88,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  appName: {
    color: colors.text,
    fontSize: fontSizes.xl,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  version: {
    color: colors.textSecondary,
    fontSize: fontSizes.md,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    color: colors.textTertiary,
    fontSize: fontSizes.sm,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(48,209,88,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  itemContent: {
    flex: 1,
  },
  itemLabel: {
    color: colors.text,
    fontSize: fontSizes.md,
  },
  itemValue: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: 2,
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
  },
});
