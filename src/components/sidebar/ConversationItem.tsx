import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MessageSquare, Trash2 } from 'lucide-react-native';
import { ConversationMeta } from '../../services/conversation';
import { spacing, fontSizes, radius } from '../../constants/theme';
import { useTheme } from '../../theme';

interface ConversationItemProps {
  item: ConversationMeta;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function ConversationItem({ item, isActive, onSelect, onDelete }: ConversationItemProps) {
  const { colors } = useTheme();
  const date = new Date(item.updatedAt);
  const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

  return (
    <TouchableOpacity
      style={[styles.item, isActive && { backgroundColor: colors.accentMuted }]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={[styles.itemIcon, { backgroundColor: colors.surfaceLight }]}>
        <MessageSquare size={16} color={isActive ? colors.accent : colors.textTertiary} />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, { color: isActive ? colors.accent : colors.text }, isActive && styles.itemTitleActive]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.itemTime, { color: colors.textTertiary }]}>{timeStr}</Text>
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
  itemIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: fontSizes.sm,
  },
  itemTitleActive: {
    fontWeight: '600',
  },
  itemTime: {
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 4,
  },
});
