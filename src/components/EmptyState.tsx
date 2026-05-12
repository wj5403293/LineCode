import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Settings } from 'lucide-react-native';
import { spacing, fontSizes, radius } from '../constants/theme';
import { useTheme } from '../theme';

interface Props {
  onGoSettings: () => void;
}

export default React.memo(function EmptyState({ onGoSettings }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceElevated }]}>
        <Settings size={40} color={colors.textTertiary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>未配置模型</Text>
      <Text style={[styles.desc, { color: colors.textSecondary }]}>请先添加 AI 模型才能开始对话</Text>
      <TouchableOpacity style={[styles.btn, { backgroundColor: colors.accent }]} onPress={onGoSettings} activeOpacity={0.7}>
        <Text style={styles.btnText}>去配置</Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  desc: {
    fontSize: fontSizes.md,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  btn: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
  },
  btnText: {
    color: '#000',
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
});
