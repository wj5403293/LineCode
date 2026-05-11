import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Conversation } from '../../services/conversation';
import { colors, spacing, fontSizes, radius } from '../../constants/theme';
import { ConversationItem } from './ConversationItem';

interface ConversationListProps {
  conversations: Conversation[];
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
  const renderItem = useCallback(({ item }: { item: Conversation }) => (
    <ConversationItem
      item={item}
      isActive={item.id === currentId}
      onSelect={() => onSelect(item.id)}
      onDelete={() => onDelete(item.id)}
    />
  ), [currentId, onSelect, onDelete]);

  const keyExtractor = useCallback((item: Conversation) => item.id, []);

  return (
    <>
      <TouchableOpacity style={styles.newBtn} onPress={onNew} activeOpacity={0.7}>
        <Plus size={18} color="#000" />
        <Text style={styles.newBtnText}>新建对话</Text>
      </TouchableOpacity>

      {conversations.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>暂无对话记录</Text>
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
    backgroundColor: colors.accent,
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
    color: colors.textTertiary,
    fontSize: fontSizes.sm,
  },
});
