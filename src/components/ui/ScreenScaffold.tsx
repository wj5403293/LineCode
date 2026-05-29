import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../constants/theme';
import { useTheme } from '../../theme';
import ScreenHeader from '../ScreenHeader';

interface Props {
  title: string;
  onBack?: () => void;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  contentPaddingBottom?: number;
}

export default React.memo(function ScreenScaffold({
  title,
  onBack,
  leftAction,
  rightAction,
  children,
  scroll = true,
  contentPaddingBottom = 100,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const contentStyle = [styles.content, { paddingBottom: contentPaddingBottom }];

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader
        title={title}
        onBack={onBack}
        leftAction={leftAction}
        rightAction={rightAction}
      />
      {scroll ? (
        <ScrollView style={styles.scrollView} contentContainerStyle={contentStyle}>
          {children}
        </ScrollView>
      ) : children}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { paddingBottom: spacing.xl },
});
