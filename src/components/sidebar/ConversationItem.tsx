import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MessageSquare, Trash2 } from 'lucide-react-native';
import { Conversation } from '../../services/conversation';
import { colors, spacing, fontSizes, radius } from '../../constants/theme';

interface ConversationItemProps {
  item: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function ConversationItem({ item, isActive, onSelect, onDelete }: ConversationItemProps) {
  const date = new Date(item.updatedAt);
  const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

  return (
    <TouchableOpacity
      style={[styles.item, isActive && styles.itemActive]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={styles.itemIcon}>
        <MessageSquare size={16} color={isActive ? colors.accent : colors.textTertiary} />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, isActive && styles.itemTitleActive]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.itemTime}>{timeStr}</Text>
      </View>
      <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} hitSlop={8}>
        <Trash2 size={14} color={colors.textTertiary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    gap: spacing.sm,
  },
  itemActive: {
    backgroundColor: 'rgba(48,209,88,0.08)',
  },
  itemIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    color: colors.text,
    fontSize: fontSizes.sm,
  },
  itemTitleActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  itemTime: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 4,
  },
});
