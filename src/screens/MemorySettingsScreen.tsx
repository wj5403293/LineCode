import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BookOpen, Clock3, Database, FolderKanban, Globe2, Plus } from 'lucide-react-native';
import { ActionRow, ScreenScaffold, SettingsSection } from '../components/ui';
import { MemoryOverview, memoryOverviewService } from '../services/evolution';
import { EvolutionMemory, MemoryScope } from '../services/evolution/types';
import { fontSizes, radius, spacing } from '../constants/theme';
import { useTheme } from '../theme';

interface Props {
  onBack: () => void;
}

type MemorySectionKey = 'longTerm' | 'project' | 'environment' | 'shortTerm' | 'history';

const EMPTY_OVERVIEW: MemoryOverview = {
  longTerm: [],
  project: [],
  environment: [],
  shortTerm: [],
  history: [],
};

function formatTime(value?: number): string {
  if (!value) return '未知时间';
  return new Date(value).toLocaleString();
}

function itemText(section: MemorySectionKey, item: any): string {
  if (section === 'history') {
    return `${item.title ? `标题: ${item.title}\n` : ''}${item.role}: ${item.text}\n\n对话: ${item.conversationId}\n消息: ${item.messageId || '-'}\n更新时间: ${formatTime(item.updatedAt)}`;
  }
  if (section === 'shortTerm') {
    return `${item.content}\n\n来源: ${item.source}\n项目: ${item.projectId || '全局'}\n创建: ${formatTime(item.createdAt)}\n更新: ${formatTime(item.updatedAt)}\n过期: ${item.expiresAt ? formatTime(item.expiresAt) : '不过期'}`;
  }
  return `${item.content}\n\n范围: ${item.scope}\n来源: ${item.source}\n项目: ${item.projectId || '全局'}\n置信度: ${item.confidence}\n使用次数: ${item.useCount}\n创建: ${formatTime(item.createdAt)}\n更新: ${formatTime(item.updatedAt)}\n上次使用: ${item.lastUsedAt ? formatTime(item.lastUsedAt) : '尚未使用'}`;
}

function previewText(section: MemorySectionKey, item: any): string {
  const text = section === 'history' ? item.text : item.content;
  return String(text || '').replace(/\s+/g, ' ').slice(0, 80) || '空内容';
}

function isEditableMemorySection(section: MemorySectionKey): section is 'longTerm' | 'project' | 'environment' {
  return section === 'longTerm' || section === 'project' || section === 'environment';
}

function dialogPreview(content: string): string {
  return content.length > 120 ? `${content.slice(0, 120)}...` : content;
}

export default function MemorySettingsScreen({ onBack }: Props) {
  const { colors } = useTheme();
  const [overview, setOverview] = useState<MemoryOverview>(EMPTY_OVERVIEW);
  const [addVisible, setAddVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<EvolutionMemory | null>(null);
  const [draftScope, setDraftScope] = useState<MemoryScope>('user');
  const [draftContent, setDraftContent] = useState('');

  const load = useCallback(async () => {
    try {
      setOverview(await memoryOverviewService.getOverview());
    } catch (err: any) {
      Alert.alert('读取记忆失败', err?.message || String(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sections = useMemo(() => [
    { key: 'longTerm' as const, title: '长期记忆', icon: Database, items: overview.longTerm },
    { key: 'project' as const, title: '项目记忆', icon: FolderKanban, items: overview.project },
    { key: 'environment' as const, title: '环境记忆', icon: Globe2, items: overview.environment },
    { key: 'shortTerm' as const, title: '短期记忆', icon: Clock3, items: overview.shortTerm },
    { key: 'history' as const, title: '聊天索引', icon: BookOpen, items: overview.history },
  ], [overview]);

  const closeEditor = useCallback(() => {
    setAddVisible(false);
    setEditTarget(null);
  }, []);

  const openAdd = useCallback(() => {
    setEditTarget(null);
    setDraftScope('user');
    setDraftContent('');
    setAddVisible(true);
  }, []);

  const openEdit = useCallback((memory: EvolutionMemory) => {
    setAddVisible(false);
    setEditTarget(memory);
    setDraftScope(memory.scope);
    setDraftContent(memory.content);
  }, []);

  const handleSave = useCallback(async () => {
    const content = draftContent.trim();
    if (!content) return;
    try {
      if (editTarget) {
        await memoryOverviewService.updateMemory(editTarget.id, {
          content,
          scope: draftScope,
          projectId: overview.projectId,
        });
      } else {
        await memoryOverviewService.addMemory(content, draftScope, overview.projectId);
      }
      setDraftContent('');
      closeEditor();
      await load();
    } catch (err: any) {
      Alert.alert(editTarget ? '编辑记忆失败' : '添加记忆失败', err?.message || String(err));
    }
  }, [closeEditor, draftContent, draftScope, editTarget, load, overview.projectId]);

  const handleDelete = useCallback((memory: EvolutionMemory) => {
    Alert.alert('删除记忆', `确定删除这条记忆？\n\n${dialogPreview(memory.content)}`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await memoryOverviewService.deleteMemory(memory.id);
            await load();
          } catch (err: any) {
            Alert.alert('删除记忆失败', err?.message || String(err));
          }
        },
      },
    ]);
  }, [load]);

  const handleMemoryLongPress = useCallback((memory: EvolutionMemory) => {
    Alert.alert('记忆操作', '选择操作', [
      { text: '取消', style: 'cancel' },
      { text: '编辑', onPress: () => openEdit(memory) },
      { text: '删除', style: 'destructive', onPress: () => handleDelete(memory) },
    ]);
  }, [handleDelete, openEdit]);

  const editorVisible = addVisible || !!editTarget;

  const rightAction = (
    <TouchableOpacity style={styles.headerButton} onPress={openAdd}>
      <Plus size={20} color={colors.accent} />
    </TouchableOpacity>
  );

  return (
    <ScreenScaffold title="记忆" onBack={onBack} rightAction={rightAction}>
      <Text style={[styles.projectHint, { color: colors.textTertiary }]}>当前项目: {overview.projectId || '未选择项目'}</Text>
      {sections.map(section => (
        <SettingsSection key={section.key} title={`${section.title}（${section.items.length}）`}>
          {section.items.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textTertiary }]}>暂无内容</Text>
          ) : section.items.map((item: any) => {
            const Icon = section.icon;
            return (
              <ActionRow
                key={item.id}
                icon={<Icon size={20} color={colors.accent} />}
                label={previewText(section.key, item)}
                desc={formatTime(item.updatedAt || item.createdAt)}
                showChevron
                onPress={() => Alert.alert(section.title, itemText(section.key, item))}
                onLongPress={isEditableMemorySection(section.key) ? () => handleMemoryLongPress(item as EvolutionMemory) : undefined}
              />
            );
          })}
        </SettingsSection>
      ))}

      <Modal visible={editorVisible} transparent animationType="fade" onRequestClose={closeEditor}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}> 
          <View style={[styles.modalCard, { backgroundColor: colors.surfaceElevated }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editTarget ? '编辑记忆' : '添加记忆'}</Text>
            <View style={styles.scopeRow}>
              {(['user', 'project', 'environment'] as MemoryScope[]).map(scope => (
                <TouchableOpacity
                  key={scope}
                  style={[styles.scopeButton, { borderColor: draftScope === scope ? colors.accent : colors.borderLight }]}
                  onPress={() => setDraftScope(scope)}
                >
                  <Text style={[styles.scopeText, { color: draftScope === scope ? colors.accent : colors.textSecondary }]}>{scope}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.borderLight, backgroundColor: colors.inputBg }]}
              value={draftContent}
              onChangeText={setDraftContent}
              placeholder="输入要保存的记忆"
              placeholderTextColor={colors.textTertiary}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={closeEditor}>
                <Text style={[styles.modalActionText, { color: colors.textSecondary }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave}>
                <Text style={[styles.modalSaveText, { color: colors.accent }]}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  headerButton: { padding: spacing.sm },
  projectHint: { marginHorizontal: spacing.lg, marginTop: spacing.md, fontSize: fontSizes.xs },
  empty: { padding: spacing.lg, fontSize: fontSizes.sm },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  modalCard: { borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  modalTitle: { fontSize: fontSizes.lg, fontWeight: '700' },
  scopeRow: { flexDirection: 'row', gap: spacing.sm },
  scopeButton: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  scopeText: { fontSize: fontSizes.sm },
  input: { minHeight: 120, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, padding: spacing.md, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg },
  modalActionText: { fontSize: fontSizes.md },
  modalSaveText: { fontSize: fontSizes.md, fontWeight: '700' },
});
