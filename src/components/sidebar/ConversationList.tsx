import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { ConversationMeta } from '../../services/conversation';
import { spacing, fontSizes, radius } from '../../constants/theme';
import { useTheme } from '../../theme';
import { ConversationItem } from './ConversationItem';

interface ConversationListProps {
  conversations: ConversationMeta[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export function ConversationList({
  conversations,
  currentId,
  onSelect,
  onDelete,
  onNew,
}: ConversationListProps) {
  const { colors } = useTheme();

  const renderItem = useCallback(({ item }: { item: ConversationMeta }) => (
    <ConversationItem
      item={item}
      isActive={item.id === currentId}
      onSelect={() => onSelect(item.id)}
      onDelete={() => onDelete(item.id)}
    />
  ), [currentId, onSelect, onDelete]);

  const keyExtractor = useCallback((item: ConversationMeta) => item.id, []);

  return (
    <>
      <TouchableOpacity style={[styles.newBtn, { backgroundColor: colors.accent }]} onPress={onNew} activeOpacity={0.7}>
        <Plus size={18} color="#000" />
        <Text style={styles.newBtnText}>新建对话</Text>
      </TouchableOpacity>

      {conversations.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无对话记录</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  newBtnText: {
    color: '#000',
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: spacing.sm,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSizes.sm,
  },
});
