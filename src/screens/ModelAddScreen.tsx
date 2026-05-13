import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView,
  ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Check, ChevronDown, ExternalLink } from 'lucide-react-native';
import { Model } from '../types';
import { modelStorage } from '../services/storage';
import { spacing, fontSizes, radius } from '../constants/theme';
import { useTheme } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import { openURL } from '../utils/openURL';
import { GPT55_PROMO_TITLE, GPT55_PROMO_URL } from '../constants/promo';
import { getModelProviderPreset } from '../constants/modelProviders';

interface Props {
  onBack: () => void;
  presetId?: string;
}

const CUSTOM_ID = '__custom__';
type ProviderId = Model['provider'];

const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: 'OpenAI',
  codex: 'Codex',
  anthropic: 'Anthropic',
};

const PROVIDER_DEFAULT_BASE_URLS: Record<ProviderId, string> = {
  openai: 'https://api.openai.com/v1',
  codex: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
};

const PROVIDER_PLACEHOLDERS: Record<ProviderId, string> = {
  openai: 'https://api.example.com/v1',
  codex: 'https://api.example.com/v1',
  anthropic: 'https://api.example.com/anthropic',
};

const PROVIDER_BASE_URL_HINTS: Record<ProviderId, string> = {
  openai: 'OpenAI 兼容协议必须填到 /v1 结尾，例如 https://api.example.com/v1；不要只填域名，也不要加 /chat/completions。',
  codex: 'Codex 使用 Responses API，也必须填到 /v1 结尾，例如 https://api.example.com/v1；不要加 /responses。',
  anthropic: 'Anthropic 协议必须填到 /anthropic 结尾，例如 https://api.example.com/anthropic；不要加 /v1/messages。',
};

export default function ModelAddScreen({ onBack, presetId }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const preset = getModelProviderPreset(presetId);
  const lockedPreset = !!preset;
  const [provider, setProvider] = useState<ProviderId>(preset?.provider || 'openai');
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(preset?.baseUrl || '');

  const [modelId, setModelId] = useState('');
  const [isCustomId, setIsCustomId] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);

  const effectiveBaseUrl = preset
    ? (baseUrl.trim() || preset.baseUrl)
    : (baseUrl.trim() || PROVIDER_DEFAULT_BASE_URLS[provider]);
  const canQuery = !!(effectiveBaseUrl && apiKey.trim());
  const resolvedName = name.trim() || (preset ? modelId.trim() : '');
  const canSave = !!(resolvedName && modelId.trim() && apiKey.trim());

  const handleFetchModels = useCallback(async () => {
    if (!canQuery) return;
    setFetchingModels(true);
    setFetchError(null);

    try {
      const cleanBase = effectiveBaseUrl.replace(/\/$/, '');
      let modelsUrl: string;
      let headers: Record<string, string>;

      if (provider === 'openai' || provider === 'codex') {
        modelsUrl = `${cleanBase}/models`;
        headers = { 'Authorization': `Bearer ${apiKey}` };
      } else {
        // Anthropic models 用 root origin，避免 /anthropic 路径干扰
        let root: string;
        try {
          root = new URL(cleanBase).origin;
        } catch {
          root = cleanBase.replace(/\/.*$/, '');
        }
        modelsUrl = `${root}/v1/models`;
        headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
      }

      const res = await fetch(modelsUrl, { headers });

      if (!res.ok) {
        const rawText = await res.text();
        let errText = rawText;
        try { const j = JSON.parse(rawText); if (j?.error?.message) errText = j.error.message; } catch {}
        throw new Error(
          `${res.status}: ${errText}\n\n请求地址: ${modelsUrl}\n提示: 请检查 Base URL 和 API Key 是否正确`
        );
      }

      const json = await res.json();
      const ids: string[] = (json.data || [])
        .map((m: any) => m.id)
        .filter((id: string) => !!id)
        .sort();

      if (ids.length === 0) {
        throw new Error('未获取到模型列表，请检查 Base URL 和 API Key');
      }

      setFetchedModels(ids);
      setShowModelPicker(true);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setFetchError(err.message);
    } finally {
      setFetchingModels(false);
    }
  }, [canQuery, effectiveBaseUrl, apiKey, provider]);

  const handleSelectModel = useCallback((id: string) => {
    if (id === CUSTOM_ID) {
      setIsCustomId(true);
      setModelId('');
    } else {
      setIsCustomId(false);
      setModelId(id);
      if (preset && !name.trim()) setName(id);
    }
    setShowModelPicker(false);
  }, [name, preset]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;

    const models = await modelStorage.getModels();
    const newModel: Model = {
      id: String(Date.now()),
      name: resolvedName,
      provider,
      providerLabel: preset?.label,
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
  }, [resolvedName, modelId, apiKey, baseUrl, provider, preset?.label, canSave, onBack]);

  const handleOpenPromo = useCallback(() => {
    openURL(GPT55_PROMO_URL, (url) => navigation.navigate('InAppBrowser', { url })).catch(() => {});
  }, [navigation]);

  const rightAction = (
    <TouchableOpacity
      onPress={handleSave}
      style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
      disabled={!canSave}
    >
      <Text style={[styles.saveBtnText, { color: canSave ? colors.accent : colors.textTertiary }]}>保存</Text>
    </TouchableOpacity>
  );

  const modelDisplayText = isCustomId
    ? (modelId || '输入自定义模型 ID')
    : (modelId || '请先查询并选择模型');

  const pickerItems = [...fetchedModels, CUSTOM_ID];

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader title="添加模型" onBack={onBack} rightAction={rightAction} />

      <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {preset ? `提供商：${preset.label}` : '提供商'}
        </Text>
        <View style={styles.toggleRow}>
          {(['openai', 'codex', 'anthropic'] as const).map(p => (
            <TouchableOpacity
              key={p}
              style={[
                styles.toggleBtn,
                { backgroundColor: provider === p ? colors.accent : colors.surfaceLight },
                lockedPreset && p !== provider && styles.toggleBtnDisabled,
              ]}
              onPress={() => {
                if (lockedPreset) return;
                setProvider(p);
                setBaseUrl(baseUrl);
                setFetchedModels([]);
                setModelId('');
                setIsCustomId(false);
              }}
              disabled={lockedPreset}
            >
              <Text style={[styles.toggleText, { color: provider === p ? colors.textOnColor : colors.textSecondary }]}>
                {PROVIDER_LABELS[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>名称</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surfaceLight, color: colors.text, borderColor: colors.borderLight }]}
          placeholder={preset ? '可留空，默认使用模型 ID' : '如 GPT-4o、Claude Sonnet'}
          placeholderTextColor={colors.textTertiary}
          value={name}
          onChangeText={setName}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Base URL</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surfaceLight, color: colors.text, borderColor: colors.borderLight }]}
          placeholder={preset?.placeholder || PROVIDER_PLACEHOLDERS[provider]}
          placeholderTextColor={colors.textTertiary}
          value={baseUrl}
          onChangeText={setBaseUrl}
          autoCapitalize="none"
        />
        <Text style={[styles.hintText, { color: colors.textTertiary }]}>
          {preset?.hint || PROVIDER_BASE_URL_HINTS[provider]}
        </Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>API Key</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surfaceLight, color: colors.text, borderColor: colors.borderLight }]}
          placeholder="sk-..."
          placeholderTextColor={colors.textTertiary}
          value={apiKey}
          onChangeText={setApiKey}
          secureTextEntry
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>模型 ID</Text>

        {isCustomId ? (
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceLight, color: colors.text, borderColor: colors.borderLight }]}
            placeholder="输入模型 ID"
            placeholderTextColor={colors.textTertiary}
            value={modelId}
            onChangeText={setModelId}
            autoCapitalize="none"
          />
        ) : (
          <View style={styles.modelRow}>
            <TouchableOpacity
              style={[styles.modelSelector, { backgroundColor: colors.surfaceLight, borderColor: colors.borderLight }]}
              onPress={() => {
                if (fetchedModels.length > 0) {
                  setShowModelPicker(true);
                } else {
                  handleFetchModels();
                }
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.modelSelectorText, { color: modelId ? colors.text : colors.textTertiary }]}
                numberOfLines={1}
              >
                {modelDisplayText}
              </Text>
              <ChevronDown size={16} color={colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.queryBtn, { backgroundColor: canQuery ? colors.accent : colors.surfaceLight }]}
              onPress={handleFetchModels}
              disabled={!canQuery || fetchingModels}
              activeOpacity={0.7}
            >
              {fetchingModels ? (
                <ActivityIndicator size="small" color={canQuery ? colors.textOnColor : colors.textTertiary} />
              ) : (
                <>
                  <Search size={16} color={canQuery ? colors.textOnColor : colors.textTertiary} />
                  <Text style={[styles.queryText, { color: canQuery ? colors.textOnColor : colors.textTertiary }]}>查询</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {isCustomId && (
          <TouchableOpacity
            style={styles.switchBtn}
            onPress={() => { setIsCustomId(false); setModelId(''); }}
          >
            <Text style={[styles.switchBtnText, { color: colors.accent }]}>从列表中选择</Text>
          </TouchableOpacity>
        )}

        {fetchError && (
          <Text style={[styles.errorText, { color: colors.danger }]}>{fetchError}</Text>
        )}

        <TouchableOpacity
          style={[styles.promoCard, { backgroundColor: colors.surfaceLight, borderColor: colors.borderLight }]}
          onPress={handleOpenPromo}
          activeOpacity={0.75}
        >
          <View style={styles.promoTextWrap}>
            <Text style={[styles.promoTitle, { color: colors.text }]} numberOfLines={1}>
              {GPT55_PROMO_TITLE}
            </Text>
            <Text style={[styles.promoSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              点击前往领取
            </Text>
          </View>
          <View style={[styles.promoAction, { backgroundColor: colors.accentMuted }]}>
            <Text style={[styles.promoActionText, { color: colors.accent }]}>前往</Text>
            <ExternalLink size={14} color={colors.accent} />
          </View>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showModelPicker} transparent animationType="slide" onRequestClose={() => setShowModelPicker(false)}>
        <View style={styles.pickerOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowModelPicker(false)} />
          <View style={[styles.pickerSheet, { backgroundColor: colors.surfaceElevated }]}>
            <View style={[styles.pickerHandle, { backgroundColor: colors.textTertiary }]} />
            <Text style={[styles.pickerTitle, { color: colors.text }]}>选择模型</Text>
            <View style={[styles.pickerDivider, { backgroundColor: colors.borderLight }]} />
            <FlatList
              data={pickerItems}
              keyExtractor={(item) => item}
              style={styles.pickerList}
              renderItem={({ item }) => {
                const isCustom = item === CUSTOM_ID;
                const isSelected = !isCustom && item === modelId;
                return (
                  <TouchableOpacity
                    style={[styles.pickerItem, { borderBottomColor: colors.borderLight }]}
                    onPress={() => handleSelectModel(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pickerItemContent}>
                      <Text
                        style={[
                          styles.pickerItemText,
                          { color: isCustom ? colors.accent : colors.text },
                          isSelected && { fontWeight: '700', color: colors.accent },
                        ]}
                      >
                        {isCustom ? '自定义 ID...' : item}
                      </Text>
                      {isSelected && <Check size={16} color={colors.accent} />}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  saveBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: fontSizes.md, fontWeight: '600' },
  form: { flex: 1 },
  formContent: { padding: spacing.lg },
  label: {
    fontSize: fontSizes.sm, fontWeight: '600',
    marginBottom: spacing.sm, marginTop: spacing.lg,
  },
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggleBtn: {
    flex: 1, paddingVertical: spacing.md, borderRadius: radius.md,
    alignItems: 'center',
  },
  toggleBtnDisabled: {
    opacity: 0.45,
  },
  toggleText: { fontSize: fontSizes.md, fontWeight: '600' },
  input: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    fontSize: fontSizes.md,
    borderWidth: 1,
  },
  modelRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modelSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
  },
  modelSelectorText: {
    fontSize: fontSizes.md,
    flex: 1,
  },
  queryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  queryText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  switchBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-end',
  },
  switchBtnText: {
    fontSize: fontSizes.sm,
  },
  errorText: {
    fontSize: fontSizes.xs,
    marginTop: spacing.sm,
  },
  hintText: {
    fontSize: fontSizes.xs,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  promoCard: {
    marginTop: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  promoTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  promoTitle: {
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  promoSubtitle: {
    fontSize: fontSizes.sm,
    marginTop: 2,
  },
  promoAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  promoActionText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '70%',
    paddingBottom: 34,
  },
  pickerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  pickerTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  pickerDivider: {
    height: StyleSheet.hairlineWidth,
  },
  pickerList: {
    flexGrow: 0,
  },
  pickerItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  pickerItemText: {
    fontSize: fontSizes.md,
    flex: 1,
  },
});
