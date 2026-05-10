import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { getCodeWrap, setCodeWrap } from '../services/settings';
import { colors, spacing, fontSizes, radius } from '../constants/theme';

interface Props {
  onBack: () => void;
}

export default function OutputSettingsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [codeWrapEnabled, setCodeWrapEnabled] = useState(false);

  useEffect(() => {
    getCodeWrap().then(setCodeWrapEnabled);
  }, []);

  const handleToggleCodeWrap = useCallback(async (value: boolean) => {
    setCodeWrapEnabled(value);
    await setCodeWrap(value);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>输出设置</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>代码显示</Text>

        <View style={styles.item}>
          <View style={styles.itemContent}>
            <Text style={styles.itemLabel}>代码自动换行</Text>
            <Text style={styles.itemDesc}>关闭时代码可水平滚动</Text>
          </View>
          <Switch
            value={codeWrapEnabled}
            onValueChange={handleToggleCodeWrap}
            trackColor={{ false: colors.surfaceLight, true: colors.accentDim }}
            thumbColor={codeWrapEnabled ? colors.accent : colors.textTertiary}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '700' },
  section: {
    paddingTop: spacing.xl,
  },
  sectionTitle: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
  },
  itemContent: {
    flex: 1,
  },
  itemLabel: {
    color: colors.text,
    fontSize: fontSizes.md,
  },
  itemDesc: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
});
