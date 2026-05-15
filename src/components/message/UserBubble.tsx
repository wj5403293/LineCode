import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, radius } from '../../constants/theme';
import { useTheme } from '../../theme';
import { InputAttachment } from '../../types';
import { getUserMessageCopyText, getVisibleUserMessageText } from '../../utils/messageText';
import MessageActionBar from './MessageActionBar';

interface Props {
  content: string;
  attachments?: InputAttachment[];
  onRecall?: () => void;
}

export default React.memo(function UserBubble({ content, attachments, onRecall }: Props) {
  const { colors } = useTheme();
  const visibleContent = getVisibleUserMessageText(content, attachments);
  const copyText = getUserMessageCopyText(content, attachments);

  return (
    <View style={styles.row}>
      <View style={styles.stack}>
        {!!visibleContent && (
          <View style={[styles.bubble, { backgroundColor: colors.userBubble }]}>
            <Text style={[styles.text, { color: colors.textOnColor }]}>{visibleContent}</Text>
          </View>
        )}
        {!!attachments?.length && (
          <View style={styles.attachmentList}>
            {attachments.map(item => (
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
        <MessageActionBar copyText={copyText} align="right" onRecall={onRecall} />
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
