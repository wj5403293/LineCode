import React, { useState, useCallback } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Copy, Check } from 'lucide-react-native';
import { fontSizes } from '../../constants/theme';
import { useTheme } from '../../theme';

interface Props {
  text: string;
}

export default React.memo(function CopyButton({ text }: Props) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    Clipboard.setString(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <Pressable style={styles.btn} onPress={handleCopy}>
      {copied
        ? <Check size={13} color={colors.accent} />
        : <Copy size={13} color={colors.textTertiary} />}
      <Text style={[styles.label, { color: colors.textTertiary }]}>{copied ? '已复制' : '复制'}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: fontSizes.xs,
  },
});
