import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Model } from '../types';
import { modelStorage } from '../services/storage';
import { colors, spacing, fontSizes, radius } from '../constants/theme';
import ScreenHeader from '../components/ScreenHeader';

interface Props {
  onBack: () => void;
}

export default function ModelAddScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [provider, setProvider] = useState<'openai' | 'anthropic'>('openai');
  const [name, setName] = useState('');
  const [modelId, setModelId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  const canSave = name.trim() && modelId.trim() && apiKey.trim();

  const handleSave = useCallback(async () => {
    if (!canSave) return;

    const models = await modelStorage.getModels();
    const newModel: Model = {
      id: String(Date.now()),
      name: name.trim(),
      provider,
      modelId: modelId.trim(),
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || undefined,
    };

    const updated = [...models, newModel];
    await modelStorage.saveModels(updated);

    if (updated.length === 1) {
      await modelStorage.setSelectedModelId(newModel.id);
    }

    onBack();
  }, [name, modelId, apiKey, baseUrl, provider, canSave, onBack]);

  const rightAction = (
    <TouchableOpacity
      onPress={handleSave}
      style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
      disabled={!canSave}
    >
      <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>保存</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="添加模型" onBack={onBack} rightAction={rightAction} />

      <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
        <Text style={styles.label}>提供商</Text>
        <View style={styles.toggleRow}>
          {(['openai', 'anthropic'] as const).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.toggleBtn, provider === p && styles.toggleActive]}
              onPress={() => setProvider(p)}
            >
              <Text style={[styles.toggleText, provider === p && styles.toggleTextActive]}>
                {p === 'openai' ? 'OpenAI' : 'Anthropic'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>名称</Text>
        <TextInput
          style={styles.input}
          placeholder="如 GPT-4o、Claude Sonnet"
          placeholderTextColor={colors.textTertiary}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>模型 ID</Text>
        <TextInput
          style={styles.input}
          placeholder={provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-20250514'}
          placeholderTextColor={colors.textTertiary}
          value={modelId}
          onChangeText={setModelId}
        />

        <Text style={styles.label}>API Key</Text>
        <TextInput
          style={styles.input}
          placeholder="sk-..."
          placeholderTextColor={colors.textTertiary}
          value={apiKey}
          onChangeText={setApiKey}
          secureTextEntry
        />

        <Text style={styles.label}>Base URL（可选）</Text>
        <TextInput
          style={styles.input}
          placeholder={provider === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com'}
          placeholderTextColor={colors.textTertiary}
          value={baseUrl}
          onChangeText={setBaseUrl}
          autoCapitalize="none"
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  saveBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: colors.accent, fontSize: fontSizes.md, fontWeight: '600' },
  saveBtnTextDisabled: { color: colors.textTertiary },
  form: { flex: 1 },
  formContent: { padding: spacing.lg },
  label: {
    color: colors.textSecondary, fontSize: fontSizes.sm, fontWeight: '600',
    marginBottom: spacing.sm, marginTop: spacing.lg,
  },
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggleBtn: {
    flex: 1, paddingVertical: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.surfaceLight, alignItems: 'center',
  },
  toggleActive: { backgroundColor: colors.accent },
  toggleText: { color: colors.textSecondary, fontSize: fontSizes.md, fontWeight: '600' },
  toggleTextActive: { color: '#000' },
  input: {
    backgroundColor: colors.surfaceLight, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    color: colors.text, fontSize: fontSizes.md,
    borderWidth: 1, borderColor: colors.borderLight,
  },
});
