import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type KeyboardEvent,
} from 'react-native';
import { ArrowUp, Plus, Square, X } from 'lucide-react-native';
import { spacing, fontSizes } from '../constants/theme';
import { useTheme } from '../theme';
import { MCPExecutionMode } from '../services/settings';
import { sshService } from '../services/SSHService';
import { FileTreeNode, useFileTree } from '../hooks/useFileTree';
import { InputAttachment } from '../types';
import AttachmentPickerModal from './AttachmentPickerModal';
import { parseModelContext } from '../utils/modelContext';
import { projectService } from '../services/ProjectService';

interface Props {
  onSend: (text: string, attachments?: InputAttachment[]) => void;
  onStop?: () => void;
  streaming?: boolean;
  mode: MCPExecutionMode;
  homePath: string;
  modelId: string;
  contextSizeLabel: string;
  contextPercent: number;
  draftText?: string;
  onDraftConsumed?: () => void;
}

type PickerSource = 'local' | 'ssh';
type RemoteStatus = 'idle' | 'checking' | 'loading' | 'ready' | 'missing' | 'error';

const INSTALL_PY_PROMPT = '当前 SSH 环境没有检测到 python3、python 或 py。请先通过 shell 安装 Python，并确保可以通过 python3、python 或 py 执行。安装完成后再继续生成远端目录结构 JSON。';

const REMOTE_TREE_SCRIPT = `
import json
import os

IGNORED = {".git", "node_modules", "__pycache__", ".gradle", "build", "dist"}
MAX_DEPTH = 2
MAX_ITEMS = 120

def make_node(path, depth):
    abs_path = os.path.abspath(path)
    name = os.path.basename(abs_path) or abs_path
    is_dir = os.path.isdir(abs_path)
    node = {"name": name, "path": abs_path, "isDirectory": is_dir}
    if is_dir:
        children = []
        if depth < MAX_DEPTH:
            try:
                entries = list(os.scandir(abs_path))
                entries.sort(key=lambda entry: (not entry.is_dir(follow_symlinks=False), entry.name.lower()))
                for entry in entries[:MAX_ITEMS]:
                    if entry.name in IGNORED:
                        continue
                    try:
                        children.append(make_node(entry.path, depth + 1))
                    except Exception:
                        pass
            except Exception:
                pass
        node["children"] = children
    return node

project_root = os.environ.get("LINECODE_PROJECT_PATH")
root = project_root or os.getcwd()
if project_root and not os.path.isdir(root):
    raise SystemExit("Project directory is not accessible: " + root)
print(json.dumps(make_node(root, 0), ensure_ascii=False))
`;

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function buildRemoteTreeCommand(pythonPath: string, projectPath: string | null): string {
  const pythonExpression = `exec(${JSON.stringify(REMOTE_TREE_SCRIPT)})`;
  const projectEnv = projectPath ? `LINECODE_PROJECT_PATH=${shellSingleQuote(projectPath)} ` : '';
  return `PY_BIN=${shellSingleQuote(pythonPath)}; ${projectEnv}"$PY_BIN" -c ${shellSingleQuote(pythonExpression)}`;
}

function normalizeRemoteNode(value: unknown, expanded = false): FileTreeNode | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const path = String(record.path || '');
  if (!path) return null;

  const children = Array.isArray(record.children)
    ? record.children
        .map(child => normalizeRemoteNode(child))
        .filter((child): child is FileTreeNode => !!child)
    : undefined;

  return {
    name: String(record.name || path.split('/').filter(Boolean).pop() || path),
    path,
    isDirectory: Boolean(record.isDirectory),
    children,
    expanded,
  };
}

function parseRemoteTree(output: string): FileTreeNode {
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new Error('SSH 返回的目录结构不是 JSON');
  }

  const parsed = JSON.parse(output.slice(start, end + 1));
  const tree = normalizeRemoteNode(parsed, true);
  if (!tree) {
    throw new Error('SSH 返回的目录结构为空');
  }
  return tree;
}

function toggleExpanded(node: FileTreeNode, path: string): FileTreeNode {
  if (node.path === path) {
    return { ...node, expanded: !node.expanded };
  }
  if (!node.children) return node;
  return {
    ...node,
    children: node.children.map(child => toggleExpanded(child, path)),
  };
}

function ignorePromise<T>(promise: Promise<T>) {
  promise.catch(() => {});
}

export default React.memo(function InputBar({
  onSend,
  onStop,
  streaming,
  mode,
  homePath,
  modelId,
  contextSizeLabel,
  contextPercent,
  draftText,
  onDraftConsumed,
}: Props) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<InputAttachment[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerSource, setPickerSource] = useState<PickerSource>('local');
  const [remoteStatus, setRemoteStatus] = useState<RemoteStatus>('idle');
  const [remoteMessage, setRemoteMessage] = useState('');
  const [remoteTree, setRemoteTree] = useState<FileTreeNode | null>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const containerRef = useRef<View>(null);
  const keyboardVisibleRef = useRef(false);
  const { colors } = useTheme();
  const { tree: localTree, loadTree, expandNode } = useFileTree(homePath);
  const hasText = text.trim().length > 0;
  const canSend = hasText || attachments.length > 0;
  const pickerBusy = pickerVisible && pickerSource === 'ssh' && (remoteStatus === 'checking' || remoteStatus === 'loading');
  const modelLabel = useMemo(() => parseModelContext(modelId).apiModelId || '未选择模型', [modelId]);
  const contextLabel = `${contextPercent}% / ${contextSizeLabel}`;

  const sendBtnBg = useMemo(
    () => streaming ? colors.danger : canSend ? colors.accent : colors.surfaceLight,
    [streaming, canSend, colors.accent, colors.surfaceLight, colors.danger],
  );
  const sendBtnStyle = useMemo(
    () => [styles.actionBtn, { backgroundColor: sendBtnBg }, streaming && styles.stopBtn],
    [streaming, sendBtnBg],
  );
  const containerStyle = useMemo(() => [
    styles.container,
    {
      backgroundColor: colors.bg,
      borderTopColor: colors.border,
      transform: [{ translateY: -keyboardOffset }],
    },
  ], [colors.bg, colors.border, keyboardOffset]);

  useEffect(() => {
    setAttachments([]);
    setPickerVisible(false);
  }, [mode]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const timers: ReturnType<typeof setTimeout>[] = [];

    const clearTimers = () => {
      while (timers.length) {
        const timer = timers.pop();
        if (timer) clearTimeout(timer);
      }
    };

    const applyOffset = (nextOffset: number) => {
      const normalizedOffset = Math.max(0, Math.ceil(nextOffset));
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardOffset(prev => prev === normalizedOffset ? prev : normalizedOffset);
    };

    const measureOverlap = (event: KeyboardEvent) => {
      if (!keyboardVisibleRef.current) return;
      containerRef.current?.measureInWindow((_x, y, _width, height) => {
        if (!keyboardVisibleRef.current) return;
        const keyboardHeight = event.endCoordinates.height;
        const keyboardTop = event.endCoordinates.screenY > 0
          ? event.endCoordinates.screenY
          : Dimensions.get('window').height - keyboardHeight;
        applyOffset(y + height - keyboardTop);
      });
    };

    const scheduleMeasure = (event: KeyboardEvent, delay: number) => {
      const timer = setTimeout(() => measureOverlap(event), delay);
      timers.push(timer);
    };

    const showSubscription = Keyboard.addListener('keyboardDidShow', event => {
      keyboardVisibleRef.current = true;
      clearTimers();
      scheduleMeasure(event, 0);
      scheduleMeasure(event, 80);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      keyboardVisibleRef.current = false;
      clearTimers();
      applyOffset(0);
    });

    return () => {
      keyboardVisibleRef.current = false;
      clearTimers();
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (draftText === undefined) return;
    setText(draftText);
    setAttachments([]);
    setPickerVisible(false);
    onDraftConsumed?.();
  }, [draftText, onDraftConsumed]);

  const detectRemotePython = useCallback(async (): Promise<string> => {
    const output = await sshService.executeCommand('command -v python3 || command -v python || command -v py || true', 10000);
    return output.split(/\r?\n/).map(line => line.trim()).find(Boolean) || '';
  }, []);

  const loadRemoteTree = useCallback(async () => {
    setRemoteTree(null);
    setRemoteStatus('checking');
    setRemoteMessage('正在检测 SSH 环境中的 Python...');

    try {
      const pythonPath = await detectRemotePython();
      if (!pythonPath) {
        setRemoteStatus('missing');
        setRemoteMessage('SSH 环境没有检测到 python3、python 或 py。');
        return;
      }

      setRemoteStatus('loading');
      const project = await projectService.getSelectedProject();
      const projectPath = projectService.getProjectShellPath(project);
      if (project.source === 'saf' && !projectPath) {
        setRemoteStatus('error');
        setRemoteMessage('当前 SAF 项目路径无法转换为 SSH 可用路径。');
        return;
      }
      setRemoteMessage(projectPath ? `正在读取远端项目目录: ${projectPath}` : '正在读取远端目录结构...');
      const output = await sshService.executeCommand(buildRemoteTreeCommand(pythonPath, projectPath), 30000);
      setRemoteTree(parseRemoteTree(output));
      setRemoteStatus('ready');
      setRemoteMessage('');
    } catch (err: any) {
      setRemoteStatus('error');
      setRemoteMessage(err?.message || '读取 SSH 目录失败');
    }
  }, [detectRemotePython]);

  const openPicker = useCallback(() => {
    if (streaming) return;
    const source: PickerSource = mode === 'ssh' ? 'ssh' : 'local';
    setPickerSource(source);
    setPickerVisible(true);

    if (source === 'local') {
      ignorePromise(loadTree());
    } else {
      ignorePromise(loadRemoteTree());
    }
  }, [streaming, mode, loadTree, loadRemoteTree]);

  const handleToggleFile = useCallback((node: FileTreeNode) => {
    if (node.isDirectory) return;
    const source = pickerSource;
    setAttachments(prev => {
      if (prev.some(item => item.path === node.path && item.source === source)) {
        return prev.filter(item => !(item.path === node.path && item.source === source));
      }
      return [...prev, { name: node.name, path: node.path, source }];
    });
  }, [pickerSource]);

  const handleRemoveAttachment = useCallback((path: string, source: PickerSource) => {
    setAttachments(prev => prev.filter(item => !(item.path === path && item.source === source)));
  }, []);

  const handleExpand = useCallback((path: string) => {
    if (pickerSource === 'local') {
      ignorePromise(expandNode(path));
      return;
    }
    setRemoteTree(prev => prev ? toggleExpanded(prev, path) : prev);
  }, [pickerSource, expandNode]);

  const handleAskInstallPy = useCallback(() => {
    setPickerVisible(false);
    onSend(INSTALL_PY_PROMPT, []);
  }, [onSend]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    onSend(trimmed, attachments);
    setText('');
    setAttachments([]);
    setPickerVisible(false);
  };

  const selectedPaths = useMemo(
    () => attachments.filter(item => item.source === pickerSource).map(item => item.path),
    [attachments, pickerSource],
  );

  const pickerTree = pickerSource === 'local' ? localTree : remoteTree;
  const pickerLoading = pickerSource === 'ssh'
    ? remoteStatus === 'checking' || remoteStatus === 'loading'
    : !localTree;
  const pickerMessage = pickerSource === 'ssh' ? remoteMessage : '正在读取本地文件...';
  const pickerAction = pickerSource === 'ssh' && remoteStatus === 'missing'
    ? { label: '让 AI 安装 py', onPress: handleAskInstallPy }
    : pickerSource === 'ssh' && remoteStatus === 'error'
      ? { label: '重试', onPress: loadRemoteTree }
      : undefined;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
      pointerEvents="box-none"
    >
      <View ref={containerRef} collapsable={false} pointerEvents="box-none">
        <View style={containerStyle}>
          {attachments.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.chipList}
            >
              {attachments.map(item => (
                <View key={`${item.source}:${item.path}`} style={[styles.chip, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Text style={[styles.chipText, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="middle">
                    {item.name}
                  </Text>
                  <TouchableOpacity
                    style={styles.chipRemove}
                    onPress={() => handleRemoveAttachment(item.path, item.source)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={14} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={[styles.inputPanel, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <View style={styles.metaRow}>
              <Text style={[styles.modelText, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="middle">
                {modelLabel}
              </Text>
              <Text style={[styles.contextText, { color: contextPercent >= 80 ? colors.warning : colors.textTertiary }]}>
                {contextLabel}
              </Text>
            </View>
            <View style={[styles.panelDivider, { backgroundColor: colors.borderLight }]} />
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.surfaceLight }, streaming && styles.disabledBtn]}
                onPress={openPicker}
                disabled={streaming || pickerBusy}
                activeOpacity={0.7}
              >
                {pickerBusy
                  ? <ActivityIndicator size="small" color={colors.textTertiary} />
                  : <Plus size={22} color={colors.textSecondary} strokeWidth={2.5} />}
              </TouchableOpacity>

              <TextInput
                style={[styles.input, { color: colors.text }]}
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
                disabled={!streaming && !canSend}
                activeOpacity={0.7}
              >
                {streaming
                  ? <Square size={18} color={colors.textOnColor} fill={colors.textOnColor} />
                  : <ArrowUp size={22} color={canSend ? colors.textOnColor : colors.textTertiary} strokeWidth={2.5} />}
              </TouchableOpacity>
            </View>
          </View>

          <AttachmentPickerModal
            visible={pickerVisible}
            title={pickerSource === 'ssh' ? '选择 SSH 文件' : '选择本地文件'}
            tree={pickerTree}
            selectedPaths={selectedPaths}
            loading={pickerLoading}
            message={pickerMessage}
            action={pickerAction}
            onClose={() => setPickerVisible(false)}
            onExpand={handleExpand}
            onToggleFile={handleToggleFile}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
  },
  inputPanel: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 96,
  },
  metaRow: {
    minHeight: 34,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  modelText: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  contextText: {
    flexShrink: 0,
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  panelDivider: {
    height: StyleSheet.hairlineWidth,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.md,
    lineHeight: 20,
    minHeight: 42,
    maxHeight: 100,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopBtn: {
    borderRadius: 20,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  chipList: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  chip: {
    height: 34,
    maxWidth: 220,
    borderRadius: 17,
    borderWidth: 1,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chipText: {
    maxWidth: 170,
    fontSize: fontSizes.sm,
  },
  chipRemove: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
