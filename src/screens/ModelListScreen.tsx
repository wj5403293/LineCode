import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Trash2, X } from 'lucide-react-native';
import { Model } from '../types';
import { modelStorage } from '../services/storage';
import ModelCard from '../components/ModelCard';
import ScreenHeader from '../components/ScreenHeader';
import { colors, spacing, fontSizes } from '../constants/theme';

interface Props {
  onBack: () => void;
  onAdd: () => void;
  onSelect: () => void;
}

export default function ModelListScreen({ onBack, onAdd, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const [models, setModels] = useState<Model[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [multiSelect, setMultiSelect] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      const [m, sid] = await Promise.all([modelStorage.getModels(), modelStorage.getSelectedModelId()]);
      setModels(m);
      setSelectedId(sid);
    };
    load();
  }, []);

  useEffect(() => {
    const load = async () => {
      const [m, sid] = await Promise.all([modelStorage.getModels(), modelStorage.getSelectedModelId()]);
      setModels(m);
      setSelectedId(sid);
    };
    load();
  }, [onBack, onAdd, onSelect]);

  const handleSelect = useCallback(async (id: string) => {
    if (multiSelect.length > 0) {
      setMultiSelect(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
      return;
    }
    setSelectedId(id);
    await modelStorage.setSelectedModelId(id);
  }, [multiSelect]);

  const handleLongPress = useCallback((id: string) => {
    setMultiSelect([id]);
  }, []);

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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={multiSelect.length > 0 ? `已选 ${multiSelect.length} 项` : '模型'}
        onBack={multiSelect.length > 0 ? undefined : onBack}
        rightAction={headerRight}
      />

      {models.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>还没有添加模型</Text>
          <Text style={styles.emptySubText}>点击右上角 + 添加</Text>
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
  container: { flex: 1, backgroundColor: colors.bg },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  list: { padding: spacing.lg },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: fontSizes.lg },
  emptySubText: { color: colors.textTertiary, fontSize: fontSizes.sm, marginTop: spacing.xs },
});
