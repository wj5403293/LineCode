import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { RaTeXView } from 'ratex-react-native';
import { fontSizes, spacing } from '../../constants/theme';
import { normalizeLatexSource } from './latexUtils';

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

export default React.memo(function LatexFormula({ math, color, display }: LatexFormulaProps) {
  const [failed, setFailed] = useState(false);
  const trimmedMath = normalizeLatexSource(math);
  const fallbackLabel = display ? `$$${math}$$` : math;

  useEffect(() => {
    setFailed(false);
  }, [color, display, math]);

  if (!trimmedMath || failed) {
    return <LatexError math={fallbackLabel} style={{ color }} />;
  }

  const formula = (
    <RaTeXView
      latex={trimmedMath}
      fontSize={display ? 18 : 16}
      displayMode={!!display}
      color={color}
      onError={() => setFailed(true)}
      style={display ? styles.blockFormula : styles.inlineFormula}
    />
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
  inlineFormula: {
    minWidth: 8,
    minHeight: 22,
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
  blockFormula: {
    minWidth: 24,
    minHeight: 34,
  },
  errorText: {
    fontFamily: 'monospace',
    fontSize: fontSizes.sm,
  },
});
