import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { fontSizes } from '../../constants/theme';
import { useTheme } from '../../theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export default React.memo(function HeaderActionButton({ label, onPress, disabled = false }: Props) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <Text style={[styles.text, { color: disabled ? colors.textTertiary : colors.accent }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  button: {
    minWidth: 54,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
});
