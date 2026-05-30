import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView,
  ActivityIndicator, Modal, FlatList, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Check, ChevronDown, FileUp, Cpu } from 'lucide-react-native';
import RNFS from 'react-native-fs';
import { copyFile, openDocument } from 'react-native-saf-x';
import { Model } from '../types';
import { modelStorage } from '../services/storage';
import { spacing, fontSizes, radius } from '../constants/theme';
import { useTheme } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import { formatContextSize } from '../utils/modelContext';
import { getModelProviderPreset } from '../constants/modelProviders';
import { LOCAL_MODEL_ENABLED } from '../services/RuntimeConfig';

interface Props {
  onBack: () => void;
  presetId?: string;
  modelId?: string;
  local?: boolean;
}

const CUSTOM_ID = '__custom__';
type ProviderId = Model['provider'];
type RemoteProviderId = Exclude<ProviderId, 'local'>;
type LocalAcceleration = NonNullable<Model['localModel']>['acceleration'];
type LocalDocument = {
  uri?: string;
  name?: string | null;
};
const REMOTE_PROVIDERS: RemoteProviderId[] = ['openai', 'codex', 'anthropic'];
const MODEL_IMPORT_DIR = `${RNFS.DocumentDirectoryPath}/local-models`;

const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: 'OpenAI',
  codex: 'Codex',
  anthropic: 'Anthropic',
  local: '本地',
};

const PROVIDER_DEFAULT_BASE_URLS: Record<RemoteProviderId, string> = {
  openai: 'https://api.openai.com/v1',
  codex: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
};

const PROVIDER_PLACEHOLDERS: Record<RemoteProviderId, string> = {
  openai: 'https://api.example.com/v1',
  codex: 'https://api.example.com/v1',
  anthropic: 'https://api.example.com/anthropic',
};

const PROVIDER_BASE_URL_HINTS: Record<RemoteProviderId, string> = {
  openai: 'OpenAI 兼容协议必须填到 /v1 结尾，例如 https://api.example.com/v1；不要只填域名，也不要加 /chat/completions。',
  codex: 'Codex 使用 Responses API，也必须填到 /v1 结尾，例如 https://api.example.com/v1；不要加 /responses。',
  anthropic: 'Anthropic 协议必须填到 /anthropic 结尾，例如 https://api.example.com/anthropic；不要加 /v1/messages。',
};

const LOCAL_ACCELERATION_LABELS: Record<LocalAcceleration, string> = {
  auto: '自动',
  cpu: 'CPU',
  npu: 'NPU',
};

function sanitizeFileName(name: string): string {
  return (name || 'model.gguf').replace(/[^\w.-]+/g, '_').slice(0, 120);
}

function decodeUriFileName(uri?: string): string {
  if (!uri) return '';
  const lastSegment = uri.split('/').pop() || '';
  const rawName = lastSegment.includes(':') ? lastSegment.split(':').pop() || lastSegment : lastSegment;
  let decoded = rawName;
  try {
    decoded = decodeURIComponent(rawName);
  } catch {}
  return decoded.split('/').pop() || decoded;
}

export function getLocalModelDisplayName(document: LocalDocument): string {
  const name = document.name?.trim() || '';
  const uriName = decodeUriFileName(document.uri);
  if (isGgufFile(name) || !uriName) return name;
  if (isGgufFile(uriName)) return uriName;
  return name || uriName;
}

function fileNameWithoutExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '').trim();
}

function isGgufFile(name: string): boolean {
  return /\.gguf$/i.test(name.trim());
}

export function isGgufDocument(document: LocalDocument): boolean {
  return isGgufFile(document.name || '') || isGgufFile(decodeUriFileName(document.uri));
}

function formatFileSize(size?: number): string {
  if (!size || size < 0) return '';
  if (size >= 1024 * 1024 * 1024) return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(0)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${size} B`;
}

function localModelIdFrom(name: string, nCtx: string): string {
  const context = Number(nCtx);
  const contextLabel = Number.isFinite(context) && context > 0 ? ` [${formatContextSize(context)}]` : '';
  return `${name.trim() || 'local-model'}${contextLabel}`;
}

export default function ModelAddScreen({ onBack, presetId, modelId: editingModelId, local }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const preset = getModelProviderPreset(presetId);
  const lockedPreset = !!preset;
  const isEditing = !!editingModelId;
  const [provider, setProvider] = useState<ProviderId>(local && LOCAL_MODEL_ENABLED ? 'local' : preset?.provider || 'openai');
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(preset?.baseUrl || '');

  const [modelId, setModelId] = useState('');
  const [isCustomId, setIsCustomId] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [localFileUri, setLocalFileUri] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [localFileName, setLocalFileName] = useState('');
  const [localFileSize, setLocalFileSize] = useState<number | undefined>(undefined);
  const [localAcceleration, setLocalAcceleration] = useState<LocalAcceleration>('auto');
  const [localContextTokens, setLocalContextTokens] = useState('4096');
  const [importingLocalModel, setImportingLocalModel] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!editingModelId) return;
    let cancelled = false;
    modelStorage.getModels().then(models => {
      if (cancelled) return;
      const target = models.find(item => item.id === editingModelId);
      if (!target) return;
      setProvider(target.provider);
      setName(target.name);
      setApiKey(target.apiKey);
      setBaseUrl(target.baseUrl || '');
      setModelId(target.modelId);
      setIsCustomId(true);
      setFetchedModels([]);
      setFetchError(null);
      setLocalFileUri(target.localModel?.fileUri || '');
      setLocalPath(target.localModel?.localPath || '');
      setLocalFileName(target.localModel?.fileName || '');
      setLocalFileSize(target.localModel?.fileSize);
      setLocalAcceleration(target.localModel?.acceleration || 'auto');
      setLocalContextTokens(String(target.localModel?.nCtx || 4096));
    });
    return () => {
      cancelled = true;
    };
  }, [editingModelId]);

  const isLocalProvider = provider === 'local';
  const localModelUnavailable = isLocalProvider && !LOCAL_MODEL_ENABLED;
  const remoteProvider = isLocalProvider ? 'openai' : provider;
  const effectiveBaseUrl = preset
    ? (baseUrl.trim() || preset.baseUrl)
    : (baseUrl.trim() || PROVIDER_DEFAULT_BASE_URLS[remoteProvider]);
  const canQuery = !isLocalProvider && !!(effectiveBaseUrl && apiKey.trim());
  const resolvedName = name.trim() || (!isLocalProvider && preset ? modelId.trim() : '');
  const canSave = isLocalProvider
    ? !localModelUnavailable && !!(name.trim() && localPath)
    : !!(resolvedName && modelId.trim() && apiKey.trim());

  const handleFetchModels = useCallback(async () => {
    if (!canQuery) return;
    setFetchingModels(true);
    setFetchError(null);

    try {
      const cleanBase = effectiveBaseUrl.replace(/\/$/, '');
      let modelsUrl: string;
      let headers: Record<string, string>;

      if (remoteProvider === 'openai' || remoteProvider === 'codex') {
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
  }, [canQuery, effectiveBaseUrl, apiKey, remoteProvider]);

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

  const handleSelectLocalModel = useCallback(async () => {
    if (importingLocalModel) return;
    if (!LOCAL_MODEL_ENABLED) {
      setLocalError('当前安装包未编译本地模型支持，请安装本地模型版。');
      return;
    }
    setImportingLocalModel(true);
    setLocalError(null);

    try {
      const docs = await openDocument({ persist: true, multiple: false });
      const doc = docs?.[0];
      if (!doc) return;

      if (!isGgufDocument(doc)) {
        Alert.alert('模型格式不支持', '当前本地推理仅支持 GGUF 文件。');
        return;
      }

      await RNFS.mkdir(MODEL_IMPORT_DIR);
      const displayName = getLocalModelDisplayName(doc) || 'model.gguf';
      const fileName = sanitizeFileName(displayName);
      const localModelPath = `${MODEL_IMPORT_DIR}/${Date.now()}_${fileName}`;
      await copyFile(doc.uri, `file://${localModelPath}`, { replaceIfDestinationExists: true });

      setLocalFileUri(doc.uri);
      setLocalPath(localModelPath);
      setLocalFileName(displayName);
      setLocalFileSize(doc.size);
      if (!name.trim()) {
        setName(fileNameWithoutExtension(displayName));
      }
      setModelId(localModelIdFrom(name.trim() || fileNameWithoutExtension(displayName), localContextTokens));
    } catch (err: any) {
      setLocalError(err?.message || String(err));
    } finally {
      setImportingLocalModel(false);
    }
  }, [importingLocalModel, localContextTokens, name]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;

    const models = await modelStorage.getModels();
    const existingModel = editingModelId ? models.find(item => item.id === editingModelId) : undefined;
    const localCtx = Math.max(512, Math.round(Number(localContextTokens) || 4096));
    const nextModel: Model = {
      id: existingModel?.id || String(Date.now()),
      name: isLocalProvider ? name.trim() : resolvedName,
      provider,
      providerLabel: isLocalProvider ? '本地' : preset?.label || existingModel?.providerLabel,
      modelId: isLocalProvider ? localModelIdFrom(name.trim(), String(localCtx)) : modelId.trim(),
      apiKey: isLocalProvider ? '' : apiKey.trim(),
      baseUrl: isLocalProvider ? undefined : baseUrl.trim() || undefined,
      localModel: isLocalProvider ? {
        fileUri: localFileUri,
        fileName: localFileName,
        fileSize: localFileSize,
        localPath,
        acceleration: localAcceleration,
        nCtx: localCtx,
      } : undefined,
    };

    const updated = existingModel
      ? models.map(item => item.id === existingModel.id ? nextModel : item)
      : [...models, nextModel];
    await modelStorage.saveModels(updated);

    if (updated.length === 1) {
      await modelStorage.setSelectedModelId(nextModel.id);
    } else if (existingModel) {
      const selectedId = await modelStorage.getSelectedModelId();
      if (selectedId === existingModel.id) {
        await modelStorage.setSelectedModelId(existingModel.id);
      }
    }

    onBack();
  }, [
    resolvedName,
    modelId,
    apiKey,
    baseUrl,
    provider,
    preset?.label,
    canSave,
    onBack,
    editingModelId,
    isLocalProvider,
    name,
    localFileUri,
    localFileName,
    localFileSize,
    localPath,
    localAcceleration,
    localContextTokens,
  ]);

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
      <ScreenHeader title={isEditing ? '修改模型' : '添加模型'} onBack={onBack} rightAction={rightAction} />

      <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {preset ? `提供商：${preset.label}` : '提供商'}
        </Text>
        <View style={styles.toggleRow}>
          {((LOCAL_MODEL_ENABLED || provider === 'local' ? [...REMOTE_PROVIDERS, 'local'] : REMOTE_PROVIDERS) as ProviderId[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[
                styles.toggleBtn,
                { backgroundColor: provider === p ? colors.accent : colors.surfaceLight },
                ((lockedPreset || isEditing) && p !== provider) || (!LOCAL_MODEL_ENABLED && p === 'local')
                  ? styles.toggleBtnDisabled
                  : null,
              ]}
              onPress={() => {
                if (lockedPreset || isEditing || (!LOCAL_MODEL_ENABLED && p === 'local')) return;
                setProvider(p);
                setFetchedModels([]);
                setModelId('');
                setFetchError(null);
                setIsCustomId(p === 'local');
              }}
              disabled={lockedPreset || isEditing || (!LOCAL_MODEL_ENABLED && p === 'local')}
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
          placeholder={isLocalProvider ? '如 Qwen2.5 7B 本地' : preset ? '可留空，默认使用模型 ID' : '如 GPT-4o、Claude Sonnet'}
          placeholderTextColor={colors.textTertiary}
          value={name}
          onChangeText={setName}
        />

        {isLocalProvider ? (
          <>
            {localModelUnavailable && (
              <Text style={[styles.errorText, { color: colors.danger }]}>
                当前安装包未编译本地模型支持，请安装本地模型版。
              </Text>
            )}
            <Text style={[styles.label, { color: colors.textSecondary }]}>模型文件</Text>
            <TouchableOpacity
              style={[styles.localFileCard, { backgroundColor: colors.surfaceLight, borderColor: colors.borderLight }]}
              onPress={handleSelectLocalModel}
              activeOpacity={0.75}
              disabled={importingLocalModel || localModelUnavailable}
            >
              <View style={[styles.localFileIcon, { backgroundColor: colors.accentMuted }]}>
                <FileUp size={20} color={colors.accent} />
              </View>
              <View style={styles.localFileText}>
                <Text style={[styles.localFileTitle, { color: localFileName ? colors.text : colors.textTertiary }]} numberOfLines={1}>
                  {localFileName || '选择 GGUF 模型文件'}
                </Text>
                <Text style={[styles.localFileDesc, { color: colors.textTertiary }]} numberOfLines={1}>
                  {localFileName ? formatFileSize(localFileSize) || '已导入应用私有目录' : '通过 SAF 选择文件，应用会导入本地副本'}
                </Text>
              </View>
              {importingLocalModel ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <ChevronDown size={16} color={colors.textTertiary} />
              )}
            </TouchableOpacity>
            {!!localPath && (
              <Text style={[styles.hintText, { color: colors.textTertiary }]} numberOfLines={2}>
                {localPath}
              </Text>
            )}

            <Text style={[styles.label, { color: colors.textSecondary }]}>上下文长度</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceLight, color: colors.text, borderColor: colors.borderLight }]}
              placeholder="4096"
              placeholderTextColor={colors.textTertiary}
              value={localContextTokens}
              onChangeText={(value) => setLocalContextTokens(value.replace(/[^\d]/g, ''))}
              editable={!localModelUnavailable}
              keyboardType="number-pad"
            />
            <Text style={[styles.hintText, { color: colors.textTertiary }]}>
              手机端建议从 4096 开始；保存后模型 ID 会自动带上上下文标记。
            </Text>

            <Text style={[styles.label, { color: colors.textSecondary }]}>加速</Text>
            <View style={styles.toggleRow}>
              {(['auto', 'cpu', ...(Platform.OS === 'android' ? ['npu'] : [])] as LocalAcceleration[]).map(acceleration => {
                const active = localAcceleration === acceleration;
                return (
                  <TouchableOpacity
                    key={acceleration}
                    style={[
                      styles.toggleBtn,
                      { backgroundColor: active ? colors.accent : colors.surfaceLight },
                    ]}
                    onPress={() => setLocalAcceleration(acceleration)}
                    disabled={localModelUnavailable}
                    activeOpacity={0.75}
                  >
                    <View style={styles.accelerationButtonContent}>
                      {acceleration !== 'auto' && <Cpu size={14} color={active ? colors.textOnColor : colors.textSecondary} />}
                      <Text style={[styles.toggleText, { color: active ? colors.textOnColor : colors.textSecondary }]}>
                        {LOCAL_ACCELERATION_LABELS[acceleration]}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.hintText, { color: colors.textTertiary }]}>
              自动模式会优先尝试 Android Hexagon NPU，设备或模型不支持时回退 CPU。
            </Text>
            {localError && (
              <Text style={[styles.errorText, { color: colors.danger }]}>{localError}</Text>
            )}
          </>
        ) : (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Base URL</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceLight, color: colors.text, borderColor: colors.borderLight }]}
              placeholder={preset?.placeholder || PROVIDER_PLACEHOLDERS[remoteProvider]}
              placeholderTextColor={colors.textTertiary}
              value={baseUrl}
              onChangeText={setBaseUrl}
              autoCapitalize="none"
            />
            <Text style={[styles.hintText, { color: colors.textTertiary }]}>
              {preset?.hint || PROVIDER_BASE_URL_HINTS[remoteProvider]}
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

          </>
        )}

        <View style={[styles.learningCard, { backgroundColor: colors.surfaceLight, borderColor: colors.borderLight }]}>
          <View style={styles.learningTextWrap}>
            <Text style={[styles.learningTitle, { color: colors.text }]}>学习模式已移至 AI 行为</Text>
            <Text style={[styles.learningDesc, { color: colors.textTertiary }]}>请在设置 → AI 行为中统一开启或关闭学习模式，避免每个模型重复配置。</Text>
          </View>
        </View>
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
                          isSelected && styles.pickerItemSelected,
                          isSelected && { color: colors.accent },
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
  accelerationButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
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
  learningCard: {
    marginTop: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  learningTextWrap: {
    flex: 1,
  },
  learningTitle: {
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  learningDesc: {
    fontSize: fontSizes.xs,
    lineHeight: 18,
    marginTop: 4,
  },
  localFileCard: {
    minHeight: 74,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  localFileIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  localFileText: {
    flex: 1,
    minWidth: 0,
  },
  localFileTitle: {
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  localFileDesc: {
    fontSize: fontSizes.xs,
    marginTop: 3,
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
  pickerItemSelected: {
    fontWeight: '700',
  },
});
