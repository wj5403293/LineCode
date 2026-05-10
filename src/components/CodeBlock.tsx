import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Clipboard } from 'react-native';
import { Copy, Check } from 'lucide-react-native';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import { colors, spacing, fontSizes, radius } from '../constants/theme';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c++', cpp);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('cs', csharp);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);

interface Props {
  language?: string;
  code: string;
  wordWrap?: boolean;
}

const TOKEN_COLORS: Record<string, string> = {
  keyword: '#FF7B72',
  string: '#A5D6FF',
  comment: '#8B949E',
  number: '#79C0FF',
  function: '#D2A8FF',
  title: '#D2A8FF',
  params: '#C9D1D9',
  built_in: '#79C0FF',
  literal: '#79C0FF',
  type: '#FFA657',
  class: '#FFA657',
  attr: '#79C0FF',
  selector: '#7EE787',
  tag: '#7EE787',
  name: '#7EE787',
  symbol: '#79C0FF',
  bullet: '#79C0FF',
  code: '#A5D6FF',
  regexp: '#A5D6FF',
  link: '#A5D6FF',
  meta: '#8B949E',
  deletion: '#FFA198',
  addition: '#AFF5B4',
  default: '#C9D1D9',
};

// Parse highlight.js HTML result into tokens
function parseHighlightedHTML(html: string): Array<{ text: string; color: string }> {
  const tokens: Array<{ text: string; color: string }> = [];
  const regex = /<span class="hljs-([^"]+)">(.*?)<\/span>|([^<]+)/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    if (match[1]) {
      // Span with class
      tokens.push({
        text: match[2].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
        color: TOKEN_COLORS[match[1]] || TOKEN_COLORS.default,
      });
    } else if (match[3]) {
      // Plain text
      tokens.push({
        text: match[3].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
        color: TOKEN_COLORS.default,
      });
    }
  }

  return tokens;
}

function HighlightedCode({ code, language }: { code: string; language?: string }) {
  const lines = useMemo(() => {
    try {
      const result = language
        ? hljs.highlight(code, { language })
        : hljs.highlightAuto(code);

      // Parse HTML into lines of tokens
      const htmlLines = result.value.split('\n');
      return htmlLines.map(line => parseHighlightedHTML(line));
    } catch {
      return code.split('\n').map(line => [{ text: line, color: TOKEN_COLORS.default }]);
    }
  }, [code, language]);

  return (
    <>
      {lines.map((lineTokens, lineIdx) => (
        <View key={lineIdx} style={styles.codeLine}>
          <Text style={styles.lineNumber}>{lineIdx + 1}</Text>
          <Text style={styles.codeText}>
            {lineTokens.map((token, tokenIdx) => (
              <Text key={tokenIdx} style={{ color: token.color }}>
                {token.text}
              </Text>
            ))}
            {lineTokens.length === 0 && ' '}
          </Text>
        </View>
      ))}
    </>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    Clipboard.setString(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <Pressable style={styles.copyBtn} onPress={handleCopy}>
      {copied
        ? <Check size={13} color={colors.accent} />
        : <Copy size={13} color={colors.textTertiary} />}
      <Text style={styles.copyText}>{copied ? '已复制' : '复制'}</Text>
    </Pressable>
  );
}

export default React.memo(function CodeBlock({ language, code, wordWrap = false }: Props) {
  // Clean language name from markdown fence
  const cleanLang = language?.split('\n')[0]?.trim() || '';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.lang}>{cleanLang || 'code'}</Text>
        <CopyButton text={code} />
      </View>
      <View style={styles.divider} />
      <ScrollView
        horizontal={!wordWrap}
        showsHorizontalScrollIndicator={false}
      >
        <View style={styles.codeContent}>
          <HighlightedCode code={code} language={cleanLang || undefined} />
        </View>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.sm,
    marginVertical: 6,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  lang: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    fontWeight: '500',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyText: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  codeContent: {
    padding: spacing.md,
  },
  codeLine: {
    flexDirection: 'row',
  },
  lineNumber: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    fontFamily: 'monospace',
    width: 28,
    opacity: 0.5,
  },
  codeText: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
    lineHeight: 20,
    flex: 1,
  },
});
