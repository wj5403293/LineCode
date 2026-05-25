import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, radius } from '../../constants/theme';
import { useTheme } from '../../theme';
import { Message } from '../../types';
import { getUserMessageCopyText, getVisibleUserMessageText } from '../../utils/messageText';
import MessageActionBar from './MessageActionBar';

interface Props {
  message: Message;
  onRecall?: (message: Message) => void;
}

export default React.memo(function UserBubble({ message, onRecall }: Props) {
  const { colors } = useTheme();
  const visibleContent = getVisibleUserMessageText(message.content, message.attachments);
  const copyText = getUserMessageCopyText(message.content, message.attachments);
  const handleRecall = useCallback(() => onRecall?.(message), [message, onRecall]);

  return (
    <View style={styles.row}>
      <View style={styles.stack}>
        {!!visibleContent && (
          <View style={[styles.bubble, { backgroundColor: colors.userBubble }]}>
            <Text style={[styles.text, { color: colors.textOnColor }]}>{visibleContent}</Text>
          </View>
        )}
        {!!message.attachments?.length && (
          <View style={styles.attachmentList}>
            {message.attachments.map(item => (
              <View
                key={`${item.source}:${item.path}`}
                style={[
                  styles.attachmentChip,
                  {
                    backgroundColor: colors.surfaceLight,
                    borderColor: colors.borderLight,
                  },
                ]}
              >
                <Text style={[styles.attachmentName, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
            ))}
          </View>
        )}
        <MessageActionBar copyText={copyText} align="right" onRecall={onRecall ? handleRecall : undefined} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    marginBottom: 6,
  },
  stack: {
    maxWidth: '80%',
    alignItems: 'flex-end',
  },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.lg,
    borderBottomRightRadius: 4,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
  attachmentList: {
    marginTop: spacing.xs,
    gap: spacing.xs,
    alignItems: 'flex-end',
  },
  attachmentChip: {
    maxWidth: 220,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  attachmentName: {
    fontSize: 12,
    fontWeight: '600',
  },
});
