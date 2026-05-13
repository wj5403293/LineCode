import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { Model } from '../types';
import { spacing, fontSizes, radius } from '../constants/theme';
import { useTheme } from '../theme';

interface Props {
  model: Model;
  isSelected: boolean;
  isMultiSelect: boolean;
  isChecked: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  codex: 'Codex',
  anthropic: 'Anthropic',
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10A37F',
  codex: '#4B8BFF',
  anthropic: '#D4A574',
};

export default React.memo(function ModelCard({ model, isSelected, isMultiSelect, isChecked, onPress, onLongPress }: Props) {
  const { colors } = useTheme();
  const cardStyle = useMemo(
    () => [styles.card, isSelected && { borderColor: colors.accent }, isChecked && { borderColor: colors.accent, backgroundColor: colors.accentMuted }],
    [isSelected, isChecked, colors.accent, colors.accentMuted],
  );

  return (
    <TouchableOpacity style={cardStyle} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.7}>
      <View style={[styles.badge, { backgroundColor: PROVIDER_COLORS[model.provider] || colors.surfaceLight }]}>
        <Text style={styles.badgeText}>{model.providerLabel || PROVIDER_LABELS[model.provider] || model.provider}</Text>
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{model.name}</Text>
        <Text style={[styles.modelId, { color: colors.textTertiary }]} numberOfLines={1}>{model.modelId}</Text>
      </View>
      {isMultiSelect ? (
        <View style={[styles.checkCircle, { borderColor: colors.textTertiary }, isChecked && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
          {isChecked && <Check size={14} color="#000" />}
        </View>
      ) : isSelected ? (
        <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />
      ) : null}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  badgeText: {
    color: '#FFF',
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  modelId: {
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
