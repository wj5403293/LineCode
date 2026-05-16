import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, NativeModules } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Compass, ExternalLink, AlertCircle } from 'lucide-react-native';
import { spacing, fontSizes, radius } from '../../constants/theme';
import { useTheme } from '../../theme';
import { openURL } from '../../utils/openURL';

interface Props {
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

export default React.memo(function ToolCallHttpServer({ input: _input, result, isError }: Props) {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [port, setPort] = useState<number>(0);

  useEffect(() => {
    NativeModules.SimpleHttpServer?.getPort().then((p: number) => {
      if (p > 0) setPort(p);
    }).catch(() => {});
  }, [result]);

  const address = port > 0 ? `http://localhost:${port}` : null;

  const handleOpen = useCallback(() => {
    if (address) {
      openURL(address, (url) => navigation.navigate('InAppBrowser', { url }));
    }
  }, [address, navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.codeBg }]}>
      <View style={styles.row}>
        <Compass size={16} color={isError ? colors.danger : colors.accent} />
        <Text style={[styles.label, { color: colors.text }]}>HTTP 服务器</Text>
        {address && (
          <TouchableOpacity style={styles.linkBtn} onPress={handleOpen} activeOpacity={0.7}>
            <Text style={[styles.address, { color: colors.accent }]}>{address}</Text>
            <ExternalLink size={12} color={colors.accent} />
          </TouchableOpacity>
        )}
      </View>
      {result && !isError && <Text style={[styles.result, { color: colors.textSecondary }]}>{result}</Text>}
      {isError && result && (
        <View style={styles.errorRow}>
          <AlertCircle size={14} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{result}</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    borderRadius: radius.sm,
    marginVertical: 4,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  label: {
    flexShrink: 0,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    minWidth: 0,
  },
  address: {
    flexShrink: 1,
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
  },
  result: {
    fontSize: fontSizes.xs,
    marginTop: spacing.sm,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  errorText: {
    fontSize: fontSizes.xs,
    flex: 1,
    minWidth: 0,
  },
});
