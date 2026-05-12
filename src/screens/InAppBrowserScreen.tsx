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
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#FFF" />
          <Text style={styles.backText}>退出</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <View style={styles.backBtn} />
      </View>

      {loading && (
        <View style={styles.loadingBar}>
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

const BROWN = '#8B6914';

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BROWN,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 56,
  },
  backText: {
    color: '#FFF',
    fontSize: fontSizes.md,
    marginLeft: 2,
  },
  title: {
    color: '#FFF',
    fontSize: fontSizes.md,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  loadingBar: {
    height: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#5C3D00',
  },
  webview: {
    flex: 1,
  },
});
