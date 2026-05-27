import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ChevronLeft } from 'lucide-react-native';
import { spacing, fontSizes } from '../constants/theme';
import { useTheme } from '../theme';

interface Props {
  url: string;
  onBack: () => void;
}

export default function InAppBrowserScreen({ url, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [title, setTitle] = useState(url);
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ChevronLeft size={22} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>退出</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        <View style={styles.backBtn} />
      </View>

      {loading && (
        <View style={[styles.loadingBar, { backgroundColor: colors.accentMuted }]}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={styles.webview}
        onLoad={({ nativeEvent }) => {
          setTitle(nativeEvent.title || url);
          setLoading(false);
        }}
        onError={() => setLoading(false)}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        allowsInlineMediaPlayback
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 56,
  },
  backText: {
    fontSize: fontSizes.md,
    marginLeft: 2,
  },
  title: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  loadingBar: {
    height: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webview: {
    flex: 1,
  },
});
