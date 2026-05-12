import React, { useCallback, useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gift } from 'lucide-react-native';
import { GPT55_PROMO_TITLE, GPT55_PROMO_URL } from '../constants/promo';
import { spacing, fontSizes, radius } from '../constants/theme';
import { settingsService } from '../services/settings';
import { useTheme } from '../theme';
import { openURL } from '../utils/openURL';

interface Props {
  navigateToUrl?: (url: string) => void;
  enabled?: boolean;
}

export default function FirstLaunchPromoModal({ navigateToUrl, enabled = true }: Props) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!enabled) return () => { mounted = false; };

    settingsService.getGpt55PromoSeen()
      .then((seen) => {
        if (mounted && !seen) setVisible(true);
      })
      .catch(() => {});

    return () => { mounted = false; };
  }, [enabled]);

  const dismiss = useCallback(() => {
    setVisible(false);
    settingsService.setGpt55PromoSeen(true).catch(() => {});
  }, []);

  const handleOpen = useCallback(() => {
    dismiss();
    openURL(GPT55_PROMO_URL, navigateToUrl).catch(() => {});
  }, [dismiss, navigateToUrl]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.accentMuted }]}>
            <Gift size={22} color={colors.accent} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{GPT55_PROMO_TITLE}</Text>
          <Text style={[styles.url, { color: colors.textSecondary }]} numberOfLines={1}>
            {GPT55_PROMO_URL}
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton, { borderColor: colors.borderLight }]}
              onPress={dismiss}
              activeOpacity={0.75}
              accessibilityRole="button"
            >
              <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.accent }]}
              onPress={handleOpen}
              activeOpacity={0.75}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>前往</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
  },
  url: {
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
  },
  primaryText: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: '#000',
  },
  secondaryText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
});
