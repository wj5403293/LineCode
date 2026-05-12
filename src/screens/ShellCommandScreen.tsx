import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { fontSizes, radius, spacing } from '../constants/theme';
import { useTheme } from '../theme';

interface Props {
  command: string;
  onBack: () => void;
}

export default function ShellCommandScreen({ command, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ChevronLeft size={22} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>退出</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>完整命令</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={[styles.commandBox, { backgroundColor: colors.codeBg, borderColor: colors.codeBorder }]}>
            <Text selectable style={[styles.commandText, { color: colors.text }]}>
              {command || '(空命令)'}
            </Text>
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 68,
  },
  backText: {
    fontSize: fontSizes.md,
    marginLeft: 2,
  },
  title: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.lg,
  },
  commandBox: {
    minWidth: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  commandText: {
    fontSize: fontSizes.sm,
    lineHeight: 21,
    fontFamily: 'monospace',
  },
});
