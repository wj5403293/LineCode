import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Wrench, Server } from 'lucide-react-native';
import { MCPConfig } from '../types';
import { mcpService } from '../services/MCPService';
import { colors, spacing, fontSizes, radius } from '../constants/theme';
import ScreenHeader from '../components/ScreenHeader';

interface Props {
  onBack: () => void;
}

const MCP_ICONS: Record<string, typeof Wrench> = {
  file_ops: Wrench,
  http_server: Server,
};

export default function MCPSettingsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [configs, setConfigs] = useState<MCPConfig[]>([]);

  useEffect(() => {
    mcpService.getConfigs().then(setConfigs);
  }, []);

  const handleToggle = useCallback(async (id: string) => {
    await mcpService.toggleMCP(id);
    const updated = await mcpService.getConfigs();
    setConfigs(updated);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="MCP 工具" onBack={onBack} />

      <ScrollView style={styles.list}>
        {configs.map(config => {
          const Icon = MCP_ICONS[config.id] || Wrench;
          return (
            <View key={config.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconWrap}>
                  <Icon size={18} color={config.enabled ? colors.accent : colors.textTertiary} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{config.name}</Text>
                  <Text style={styles.cardDesc}>{config.description}</Text>
                </View>
                <Switch
                  value={config.enabled}
                  onValueChange={() => handleToggle(config.id)}
                  trackColor={{ false: colors.surfaceLight, true: colors.accentDim }}
                  thumbColor={config.enabled ? colors.accent : colors.textTertiary}
                />
              </View>
              <View style={styles.toolsList}>
                {config.tools.map(tool => (
                  <View key={tool} style={styles.toolBadge}>
                    <Text style={styles.toolName}>{tool}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1, padding: spacing.lg },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(48,209,88,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  cardDesc: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  toolsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  toolBadge: {
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  toolName: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    fontFamily: 'monospace',
  },
});
