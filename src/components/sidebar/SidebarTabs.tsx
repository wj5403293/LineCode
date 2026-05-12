import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MessageSquare, FolderOpen } from 'lucide-react-native';
import { spacing, fontSizes, radius } from '../../constants/theme';
import { useTheme } from '../../theme';

type TabType = 'conversations' | 'files';

interface SidebarTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function SidebarTabs({ activeTab, onTabChange }: SidebarTabsProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.tabs, { backgroundColor: colors.surfaceLight }]}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'conversations' && { backgroundColor: colors.surfaceElevated }]}
        onPress={() => onTabChange('conversations')}
      >
        <MessageSquare size={14} color={activeTab === 'conversations' ? colors.accent : colors.textTertiary} />
        <Text style={[styles.tabText, { color: activeTab === 'conversations' ? colors.accent : colors.textTertiary }, activeTab === 'conversations' && styles.tabTextActive]}>对话</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'files' && { backgroundColor: colors.surfaceElevated }]}
        onPress={() => onTabChange('files')}
      >
        <FolderOpen size={14} color={activeTab === 'files' ? colors.accent : colors.textTertiary} />
        <Text style={[styles.tabText, { color: activeTab === 'files' ? colors.accent : colors.textTertiary }, activeTab === 'files' && styles.tabTextActive]}>文件</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
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
  tabText: {
    fontSize: fontSizes.sm,
  },
  tabTextActive: {
    fontWeight: '600',
  },
});
