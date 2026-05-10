import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, Animated as RNAnimated,
} from 'react-native';
import { Plus, X, Trash2, MessageSquare } from 'lucide-react-native';
import { Conversation, conversationStore } from '../services/conversation';
import { colors, spacing, fontSizes, radius } from '../constants/theme';

const SIDEBAR_WIDTH = 300;

interface Props {
  visible: boolean;
  currentId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
}

const ConversationItem = React.memo(function ConversationItem({
  item, isActive, onSelect, onDelete,
}: {
  item: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
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
});

export default function Sidebar({ visible, currentId, onClose, onSelect, onNew }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const slideAnim = useRef(new RNAnimated.Value(-SIDEBAR_WIDTH)).current;
  const backdropAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      conversationStore.getConversations().then(setConversations);
      RNAnimated.parallel([
        RNAnimated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        RNAnimated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(-SIDEBAR_WIDTH);
      backdropAnim.setValue(0);
    }
  }, [visible]);

  const handleDelete = useCallback(async (id: string) => {
    await conversationStore.deleteConversation(id);
    setConversations(prev => prev.filter(c => c.id !== id));
  }, []);

  const renderItem = useCallback(({ item }: { item: Conversation }) => (
    <ConversationItem
      item={item}
      isActive={item.id === currentId}
      onSelect={() => onSelect(item.id)}
      onDelete={() => handleDelete(item.id)}
    />
  ), [currentId, onSelect, handleDelete]);

  const keyExtractor = useCallback((item: Conversation) => item.id, []);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <RNAnimated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </RNAnimated.View>
        <RNAnimated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>对话历史</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

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
        </RNAnimated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.surfaceElevated,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
