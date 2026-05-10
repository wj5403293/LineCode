import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { ArrowUp, Square } from 'lucide-react-native';
import { colors, spacing, fontSizes, radius } from '../constants/theme';

interface Props {
  onSend: (text: string) => void;
  onStop?: () => void;
  streaming?: boolean;
}

export default React.memo(function InputBar({ onSend, onStop, streaming }: Props) {
  const [text, setText] = useState('');
  const hasText = text.trim().length > 0;

  const sendBtnStyle = useMemo(
    () => [styles.sendBtn, streaming ? styles.stopBtn : hasText && styles.sendBtnActive],
    [streaming, hasText],
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
      <View style={styles.container}>
        <TextInput
          style={styles.input}
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
            ? <Square size={14} color="#FFF" fill="#FFF" />
            : <ArrowUp size={18} color={hasText ? '#FFF' : colors.textTertiary} strokeWidth={2.5} />}
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
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: fontSizes.md,
    lineHeight: 20,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnActive: {
    backgroundColor: colors.accent,
  },
  stopBtn: {
    backgroundColor: '#FF453A',
    borderRadius: 16,
  },
});
