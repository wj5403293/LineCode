import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MessageSquare, FolderOpen } from 'lucide-react-native';
import { colors, spacing, fontSizes, radius } from '../../constants/theme';

type TabType = 'conversations' | 'files';

interface SidebarTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function SidebarTabs({ activeTab, onTabChange }: SidebarTabsProps) {
  return (
    <View style={styles.tabs}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'conversations' && styles.tabActive]}
        onPress={() => onTabChange('conversations')}
      >
        <MessageSquare size={14} color={activeTab === 'conversations' ? colors.accent : colors.textTertiary} />
        <Text style={[styles.tabText, activeTab === 'conversations' && styles.tabTextActive]}>对话</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'files' && styles.tabActive]}
        onPress={() => onTabChange('files')}
      >
        <FolderOpen size={14} color={activeTab === 'files' ? colors.accent : colors.textTertiary} />
        <Text style={[styles.tabText, activeTab === 'files' && styles.tabTextActive]}>文件</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.sm,
    padding: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm - 2,
  },
  tabActive: {
    backgroundColor: colors.surfaceElevated,
  },
  tabText: {
    color: colors.textTertiary,
    fontSize: fontSizes.sm,
  },
  tabTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
});
