import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Boxes, ChevronRight, SlidersHorizontal } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import { spacing, fontSizes, radius } from '../constants/theme';
import { useTheme } from '../theme';
import {
  MODEL_PROVIDER_PRESETS,
  MODEL_PROVIDER_PROTOCOL_LABELS,
  ModelProviderPreset,
} from '../constants/modelProviders';

interface Props {
  onBack: () => void;
  onCustom: () => void;
  onProvider: (providerId: string) => void;
}

export default function ModelAddOptionsScreen({ onBack, onCustom, onProvider }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const renderProvider = useCallback((preset: ModelProviderPreset) => (
    <TouchableOpacity
      key={preset.id}
      style={[styles.providerRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight }]}
      onPress={() => onProvider(preset.id)}
      activeOpacity={0.75}
    >
      <View style={[styles.providerIcon, { backgroundColor: colors.accentMuted }]}>
        <Text style={[styles.providerInitial, { color: colors.accent }]}>{preset.label.slice(0, 1)}</Text>
      </View>
      <View style={styles.providerText}>
        <Text style={[styles.providerName, { color: colors.text }]} numberOfLines={1}>{preset.label}</Text>
        <Text style={[styles.providerDesc, { color: colors.textTertiary }]} numberOfLines={1}>
          {preset.desc} · {MODEL_PROVIDER_PROTOCOL_LABELS[preset.provider]}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  ), [colors, onProvider]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader title="添加模型" onBack={onBack} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={[styles.customCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight }]}
          onPress={onCustom}
          activeOpacity={0.75}
        >
          <View style={[styles.largeIcon, { backgroundColor: colors.accentMuted }]}>
            <SlidersHorizontal size={22} color={colors.accent} />
          </View>
          <View style={styles.customText}>
            <Text style={[styles.customTitle, { color: colors.text }]}>自定义模型</Text>
            <Text style={[styles.customDesc, { color: colors.textTertiary }]}>
              进入原添加页，手动选择协议并填写 Base URL、模型 ID 和密钥
            </Text>
          </View>
          <ChevronRight size={19} color={colors.textTertiary} />
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Boxes size={16} color={colors.textSecondary} />
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>预置提供商</Text>
        </View>
        <View style={styles.providerList}>
          {MODEL_PROVIDER_PRESETS.map(renderProvider)}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    padding: spacing.lg,
  },
  customCard: {
    minHeight: 92,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  largeIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customText: {
    flex: 1,
    minWidth: 0,
  },
  customTitle: {
    fontSize: fontSizes.md,
    fontWeight: '800',
  },
  customDesc: {
    fontSize: fontSizes.xs,
    lineHeight: 18,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  providerList: {
    gap: spacing.sm,
  },
  providerRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  providerIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerInitial: {
    fontSize: fontSizes.md,
    fontWeight: '800',
  },
  providerText: {
    flex: 1,
    minWidth: 0,
  },
  providerName: {
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  providerDesc: {
    fontSize: fontSizes.xs,
    marginTop: 3,
  },
});
