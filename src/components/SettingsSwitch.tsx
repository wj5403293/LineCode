import React, { useCallback, useEffect, useState } from 'react';
import { Switch } from 'react-native';
import { useTheme } from '../theme';

interface Props {
  value: boolean;
  onValueChange: (value: boolean) => void | Promise<void>;
  disabled?: boolean;
}

export default React.memo(function SettingsSwitch({
  value,
  onValueChange,
  disabled,
}: Props) {
  const { colors } = useTheme();
  const [displayValue, setDisplayValue] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const handleValueChange = useCallback(async (nextValue: boolean) => {
    const previousValue = displayValue;
    setDisplayValue(nextValue);
    setSaving(true);
    try {
      await onValueChange(nextValue);
    } catch {
      setDisplayValue(previousValue);
    } finally {
      setSaving(false);
    }
  }, [displayValue, onValueChange]);

  return (
    <Switch
      value={displayValue}
      onValueChange={handleValueChange}
      trackColor={{ false: colors.surfaceLight, true: colors.accentDim }}
      thumbColor={displayValue ? colors.accent : colors.textTertiary}
      disabled={disabled || saving}
    />
  );
});
