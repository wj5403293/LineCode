import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Compass, ExternalLink, AlertCircle } from 'lucide-react-native';
import { colors, spacing, fontSizes, radius } from '../../constants/theme';
import { getServerInfo } from '../../mcp/tools/builtins/HttpServerTool';

interface Props {
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

export default React.memo(function ToolCallHttpServer({ input, result, isError }: Props) {
  const serverInfo = getServerInfo();
  const address = serverInfo ? `http://localhost:${serverInfo.port}` : null;

  const handleOpen = () => {
    if (address) Linking.openURL(address);
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Compass size={16} color={isError ? '#F85149' : colors.accent} />
        <Text style={styles.label}>HTTP 服务器</Text>
        {address && (
          <TouchableOpacity style={styles.linkBtn} onPress={handleOpen} activeOpacity={0.7}>
            <Text style={styles.address}>{address}</Text>
            <ExternalLink size={12} color={colors.accent} />
          </TouchableOpacity>
        )}
      </View>
      {result && !isError && <Text style={styles.result}>{result}</Text>}
      {isError && result && (
        <View style={styles.errorRow}>
          <AlertCircle size={14} color="#F85149" />
          <Text style={styles.errorText}>{result}</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.sm,
    marginVertical: 4,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  address: {
    color: colors.accent,
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
  },
  result: {
    color: colors.textSecondary,
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
    color: '#F85149',
    fontSize: fontSizes.xs,
    flex: 1,
  },
});
