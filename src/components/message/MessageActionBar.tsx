import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Check, Copy, RotateCcw } from 'lucide-react-native';
import { spacing } from '../../constants/theme';
import { useTheme } from '../../theme';

interface Props {
  copyText: string;
  align?: 'left' | 'right';
  onRecall?: () => void;
}

export default React.memo(function MessageActionBar({ copyText, align = 'left', onRecall }: Props) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }
  }, []);

  const handleCopy = useCallback(() => {
    Clipboard.setString(copyText);
    setCopied(true);
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = setTimeout(() => setCopied(false), 1200);
  }, [copyText]);

  if (!copyText && !onRecall) return null;

  return (
    <View style={[styles.row, align === 'right' && styles.rowRight]}>
      {!!copyText && (
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={handleCopy}
          activeOpacity={0.7}
          accessibilityLabel="复制消息"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {copied
            ? <Check size={15} color={colors.accent} />
            : <Copy size={15} color={colors.textTertiary} />}
        </TouchableOpacity>
      )}
      {onRecall && (
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onRecall}
          activeOpacity={0.7}
          accessibilityLabel="撤回消息"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <RotateCcw size={15} color={colors.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 3,
    minHeight: 22,
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  iconBtn: {
    width: 24,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
