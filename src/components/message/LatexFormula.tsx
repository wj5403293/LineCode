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
  const [failed, setFailed] = useState(false);
  const [measuredSize, setMeasuredSize] = useState<{ width: number; height: number } | null>(null);

  const html = useMemo(() => {
    const expression = display ? `\\[${escapeHtml(math)}\\]` : `\\(${escapeHtml(math)}\\)`;
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
      'html,body{margin:0;padding:0;background:transparent;overflow:hidden;width:100%;}',
      'body{-webkit-text-size-adjust:100%;}',
      `#formula{visibility:hidden;color:${color};font-size:${fontSize}px;line-height:${lineHeight};display:inline-block;max-width:100%;}`,
      'mjx-container{margin:0!important;}',
      display ? 'mjx-container[jax="SVG"]{display:block!important;max-width:100%;}' : 'mjx-container[jax="SVG"]{display:inline-block!important;max-width:100%;}',
      'mjx-container[jax="SVG"] svg{max-width:100%;height:auto!important;}',
      '</style>',
      '<script>',
      `window.MathJax=${mathJaxConfig};`,
      'window.MathJax.startup={',
      'typeset:true,',
      'pageReady:function(){',
      'function post(value){if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify(value));}}',
      'function measure(){',
      'var formula=document.getElementById("formula");',
      'if(!formula){post({type:"error"});return;}',
      'formula.style.visibility="visible";',
      'var rect=formula.getBoundingClientRect();',
      'var width=Math.ceil(Math.max(rect.width, formula.scrollWidth, 1));',
      'var height=Math.ceil(Math.max(rect.height, formula.scrollHeight, 1));',
      'post({type:"rendered",width:width,height:height});',
      '}',
      'return MathJax.startup.defaultPageReady().then(function(){',
      'requestAnimationFrame(function(){setTimeout(measure,0);});',
      '}).catch(function(error){console.error(error);post({type:"error"});});',
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
    height: measuredSize
      ? Math.min(Math.max(display ? 34 : 24, measuredSize.height + 4), display ? 220 : 42)
      : display
        ? Math.min(Math.max(56, Math.ceil(math.length / 48) * 30 + 28), 180)
        : 32,
    width: display
      ? Math.max(240, windowWidth - spacing.lg * 2)
      : Math.min(
          Math.max(measuredSize ? measuredSize.width + 8 : Math.ceil(math.length * 8.5) + 34, 48),
          Math.max(120, windowWidth - 96),
        ),
  }), [display, math.length, measuredSize, windowWidth]);

  useEffect(() => {
    setRendered(false);
    setFailed(false);
    setMeasuredSize(null);
  }, [html]);

  useEffect(() => {
    if (rendered || failed) return undefined;
    const timeout = setTimeout(() => setFailed(true), 2500);
    return () => clearTimeout(timeout);
  }, [failed, rendered, html]);

  const handleRendered = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data || '{}');
      if (data.type === 'rendered') {
        const width = Number(data.width);
        const height = Number(data.height);
        if (Number.isFinite(width) && Number.isFinite(height)) {
          setMeasuredSize({ width, height });
        }
        setRendered(true);
        return;
      }
    } catch {}

    if (event.nativeEvent.data === 'rendered') {
      setRendered(true);
    } else if (event.nativeEvent.data === 'error') {
      setFailed(true);
    }
  }, []);

  const fallbackLabel = display ? `$$${math}$$` : math;

  if (!math.trim() || failed) {
    return <LatexError math={fallbackLabel} style={{ color }} />;
  }

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
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
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
    flexShrink: 0,
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
