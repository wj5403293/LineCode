import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { ArrowUp, Square } from 'lucide-react-native';
import { spacing, fontSizes, radius } from '../constants/theme';
import { useTheme } from '../theme';

interface Props {
  onSend: (text: string) => void;
  onStop?: () => void;
  streaming?: boolean;
}

export default React.memo(function InputBar({ onSend, onStop, streaming }: Props) {
  const [text, setText] = useState('');
  const { colors } = useTheme();
  const hasText = text.trim().length > 0;

  const sendBtnBg = useMemo(
    () => streaming ? colors.danger : hasText ? colors.accent : colors.surfaceLight,
    [streaming, hasText, colors.accent, colors.surfaceLight, colors.danger],
  );
  const sendBtnStyle = useMemo(
    () => [styles.sendBtn, { backgroundColor: sendBtnBg }, streaming && styles.stopBtn],
    [streaming, sendBtnBg],
  );

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.container, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
          value={text}
          onChangeText={setText}
          placeholder="输入消息..."
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={4000}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={handleSend}
          editable={!streaming}
        />
        <TouchableOpacity
          style={sendBtnStyle}
          onPress={streaming ? onStop : handleSend}
          disabled={!streaming && !hasText}
          activeOpacity={0.7}
        >
          {streaming
            ? <Square size={18} color={colors.textOnColor} fill={colors.textOnColor} />
            : <ArrowUp size={22} color={hasText ? colors.textOnColor : colors.textTertiary} strokeWidth={2.5} />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSizes.md,
    lineHeight: 20,
    maxHeight: 100,
    borderWidth: 1,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopBtn: {
    borderRadius: 20,
  },
});
