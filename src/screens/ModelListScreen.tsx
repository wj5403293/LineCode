import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, Trash2, X } from 'lucide-react-native';
import { Model } from '../types';
import { modelStorage } from '../services/storage';
import ModelCard from '../components/ModelCard';
import ScreenHeader from '../components/ScreenHeader';
import { spacing, fontSizes } from '../constants/theme';
import { useTheme } from '../theme';

interface Props {
  onBack: () => void;
  onAdd: () => void;
  onEdit: (modelId: string) => void;
  onSelect: () => void;
}

export default function ModelListScreen({ onBack, onAdd, onEdit, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [models, setModels] = useState<Model[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [multiSelect, setMultiSelect] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const [m, sid] = await Promise.all([modelStorage.getModels(), modelStorage.getSelectedModelId()]);
        setModels(m);
        setSelectedId(sid);
      };
      load();
    }, [])
  );

  const handleSelect = useCallback(async (id: string) => {
    if (multiSelect.length > 0) {
      setMultiSelect(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
      return;
    }
    setSelectedId(id);
    await modelStorage.setSelectedModelId(id);
    onSelect();
  }, [multiSelect, onSelect]);

  const handleLongPress = useCallback((id: string) => {
    const model = models.find(item => item.id === id);
    Alert.alert(model?.name || '模型', '选择操作', [
      { text: '取消', style: 'cancel' },
      { text: '修改', onPress: () => onEdit(id) },
      { text: '多选', onPress: () => setMultiSelect([id]) },
    ]);
  }, [models, onEdit]);

  const handleDelete = useCallback(() => {
    Alert.alert('删除模型', `确定删除 ${multiSelect.length} 个模型？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive', onPress: async () => {
          const rest = models.filter(m => !multiSelect.includes(m.id));
          await modelStorage.saveModels(rest);
          setModels(rest);
          if (selectedId && multiSelect.includes(selectedId)) {
            setSelectedId(null);
            await modelStorage.setSelectedModelId('');
          }
          setMultiSelect([]);
        },
      },
    ]);
  }, [multiSelect, models, selectedId]);

  const renderItem = useCallback(({ item }: { item: Model }) => (
    <ModelCard
      model={item}
      isSelected={item.id === selectedId}
      isMultiSelect={multiSelect.length > 0}
      isChecked={multiSelect.includes(item.id)}
      onPress={() => handleSelect(item.id)}
      onLongPress={() => handleLongPress(item.id)}
    />
  ), [selectedId, multiSelect, handleSelect, handleLongPress]);

  const keyExtractor = useCallback((item: Model) => item.id, []);

  const headerRight = multiSelect.length > 0 ? (
    <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
      <Trash2 size={20} color={colors.danger} />
    </TouchableOpacity>
  ) : (
    <TouchableOpacity onPress={onAdd} style={styles.iconBtn}>
      <Plus size={20} color={colors.text} />
    </TouchableOpacity>
  );

  const headerLeft = multiSelect.length > 0 ? (
    <TouchableOpacity onPress={() => setMultiSelect([])} style={styles.iconBtn}>
      <X size={20} color={colors.text} />
    </TouchableOpacity>
  ) : undefined;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader
        title={multiSelect.length > 0 ? `已选 ${multiSelect.length} 项` : '模型'}
        onBack={multiSelect.length > 0 ? undefined : onBack}
        leftAction={headerLeft}
        rightAction={headerRight}
      />

      {models.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>还没有添加模型</Text>
          <Text style={[styles.emptySubText, { color: colors.textTertiary }]}>点击右上角 + 添加</Text>
        </View>
      ) : (
        <FlatList
          data={models}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  list: { padding: spacing.lg },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: fontSizes.lg },
  emptySubText: { fontSize: fontSizes.sm, marginTop: spacing.xs },
});
