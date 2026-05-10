import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { Model } from '../types';
import { colors, spacing, fontSizes, radius } from '../constants/theme';

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
  anthropic: 'Anthropic',
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10A37F',
  anthropic: '#D4A574',
};

export default React.memo(function ModelCard({ model, isSelected, isMultiSelect, isChecked, onPress, onLongPress }: Props) {
  const cardStyle = useMemo(
    () => [styles.card, isSelected && styles.selected, isChecked && styles.checked],
    [isSelected, isChecked],
  );

  return (
    <TouchableOpacity style={cardStyle} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.7}>
      <View style={[styles.badge, { backgroundColor: PROVIDER_COLORS[model.provider] || colors.surfaceLight }]}>
        <Text style={styles.badgeText}>{PROVIDER_LABELS[model.provider] || model.provider}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{model.name}</Text>
        <Text style={styles.modelId} numberOfLines={1}>{model.modelId}</Text>
      </View>
      {isMultiSelect ? (
        <View style={[styles.checkCircle, isChecked && styles.checkCircleActive]}>
          {isChecked && <Check size={14} color="#000" />}
        </View>
      ) : isSelected ? (
        <View style={styles.activeDot} />
      ) : null}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selected: {
    borderColor: colors.accent,
  },
  checked: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(48, 209, 88, 0.08)',
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
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  modelId: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkCircleActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});
