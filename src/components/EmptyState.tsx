import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Settings } from 'lucide-react-native';
import { colors, spacing, fontSizes, radius } from '../constants/theme';

interface Props {
  onGoSettings: () => void;
}

export default React.memo(function EmptyState({ onGoSettings }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Settings size={40} color={colors.textTertiary} />
      </View>
      <Text style={styles.title}>未配置模型</Text>
      <Text style={styles.desc}>请先添加 AI 模型才能开始对话</Text>
      <TouchableOpacity style={styles.btn} onPress={onGoSettings} activeOpacity={0.7}>
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
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.xl,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  desc: {
    color: colors.textSecondary,
    fontSize: fontSizes.md,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  btn: {
    backgroundColor: colors.accent,
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
