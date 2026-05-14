import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { MATHJAX_TEX_SVG } from '../../assets/mathjaxTexSvg';
import { fontSizes, spacing } from '../../constants/theme';

interface LatexFormulaProps {
  math: string;
  color: string;
  display?: boolean;
}

interface LatexErrorProps {
  math: string;
  style?: StyleProp<TextStyle>;
}

function LatexError({ math, style }: LatexErrorProps) {
  return (
    <Text selectable style={[style, styles.errorText]}>
      {math}
    </Text>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default React.memo(function LatexFormula({ math, color, display }: LatexFormulaProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [rendered, setRendered] = useState(false);

  const html = useMemo(() => {
    const expression = display ? `$$${escapeHtml(math)}$$` : `\\(${escapeHtml(math)}\\)`;
    const fontSize = display ? 18 : 16;
    const lineHeight = display ? 1.45 : 1.35;
    const mathJaxConfig = JSON.stringify({
      tex: {
        inlineMath: [['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']],
        processEscapes: true,
      },
      svg: {
        fontCache: 'none',
      },
    });

    return [
      '<!doctype html><html><head>',
      '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">',
      '<style>',
      'html,body{margin:0;padding:0;background:transparent;overflow:hidden;}',
      'body{-webkit-text-size-adjust:100%;}',
      `#formula{visibility:hidden;color:${color};font-size:${fontSize}px;line-height:${lineHeight};}`,
      'mjx-container{margin:0!important;}',
      'mjx-container[jax="SVG"]{display:inline-block;}',
      'mjx-container[jax="SVG"] svg{max-width:100%;height:auto;}',
      '</style>',
      '<script>',
      `window.MathJax=${mathJaxConfig};`,
      'window.MathJax.startup={',
      'typeset:true,',
      'pageReady:function(){',
      'function post(value){if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(value);}}',
      'return MathJax.startup.defaultPageReady().then(function(){',
      'var formula=document.getElementById("formula");',
      'if(formula){formula.style.visibility="visible";}',
      'post("rendered");',
      '}).catch(function(error){console.error(error);post("error");});',
      '}',
      '};',
      '</script>',
      '<script>',
      MATHJAX_TEX_SVG,
      '</script>',
      '</head><body>',
      `<div id="formula">${expression}</div>`,
      '</body></html>',
    ].join('');
  }, [color, display, math]);

  const formulaStyle = useMemo(() => ({
    backgroundColor: 'transparent',
    height: display
      ? Math.min(Math.max(56, Math.ceil(math.length / 48) * 30 + 28), 180)
      : 32,
    width: display
      ? Math.max(240, windowWidth - spacing.lg * 2)
      : Math.min(Math.max(Math.ceil(math.length * 8.5) + 34, 48), Math.max(120, windowWidth - 96)),
  }), [display, math.length, windowWidth]);

  useEffect(() => {
    setRendered(false);
  }, [html]);

  const handleRendered = useCallback((event: WebViewMessageEvent) => {
    if (event.nativeEvent.data === 'rendered') {
      setRendered(true);
    }
  }, []);

  const fallbackLabel = display ? `$$${math}$$` : math;

  const formula = (
    <View style={[styles.formulaFrame, formulaStyle]}>
      <WebView
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled={false}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        setSupportMultipleWindows={false}
        androidLayerType="software"
        textZoom={100}
        onMessage={handleRendered}
        style={[styles.webView, formulaStyle]}
      />
      {!rendered && (
        <View pointerEvents="none" style={styles.fallbackOverlay}>
          <Text
            selectable
            numberOfLines={display ? undefined : 1}
            style={[styles.fallbackText, { color }, display && styles.blockFallbackText]}
          >
            {fallbackLabel}
          </Text>
        </View>
      )}
    </View>
  );

  if (!math.trim()) {
    return <LatexError math={math} style={{ color }} />;
  }

  if (display) {
    return (
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.blockScroll}
        contentContainerStyle={styles.blockContent}
      >
        {formula}
      </ScrollView>
    );
  }

  return (
    <View style={styles.inlineWrap}>
      {formula}
    </View>
  );
});

const styles = StyleSheet.create({
  inlineWrap: {
    alignSelf: 'center',
    marginHorizontal: 2,
    minHeight: 28,
    justifyContent: 'center',
  },
  blockScroll: {
    maxWidth: '100%',
    marginVertical: spacing.sm,
  },
  blockContent: {
    minWidth: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  formulaFrame: {
    position: 'relative',
    overflow: 'hidden',
  },
  webView: {
    backgroundColor: 'transparent',
  },
  fallbackOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    backgroundColor: 'transparent',
  },
  fallbackText: {
    fontFamily: 'monospace',
    fontSize: fontSizes.sm,
  },
  blockFallbackText: {
    textAlign: 'center',
  },
  errorText: {
    fontFamily: 'monospace',
    fontSize: fontSizes.sm,
  },
});
