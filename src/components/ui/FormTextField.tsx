import React from 'react';
import {
  KeyboardTypeOptions,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { fontSizes, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../theme';

interface Props {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  icon?: React.ReactNode;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  inputBackgroundColor?: string;
  textAlignVertical?: TextInputProps['textAlignVertical'];
}

export default React.memo(function FormTextField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  multiline,
  icon,
  keyboardType,
  secureTextEntry,
  inputBackgroundColor,
  textAlignVertical,
}: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        {icon}
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <TextInput
        style={[
          styles.input,
          multiline && styles.multilineInput,
          {
            backgroundColor: inputBackgroundColor || colors.surfaceLight,
            color: colors.text,
            borderColor: colors.borderLight,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        textAlignVertical={textAlignVertical ?? (multiline ? 'top' : 'center')}
      />
      {!!hint && <Text style={[styles.hint, { color: colors.textTertiary }]}>{hint}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  labelRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  input: {
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.md,
  },
  multilineInput: {
    minHeight: 120,
  },
  hint: {
    fontSize: fontSizes.xs,
    lineHeight: 17,
  },
});
