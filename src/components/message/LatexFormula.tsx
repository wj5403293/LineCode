import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { fontSizes, spacing } from '../../constants/theme';

interface MathViewProps {
  math: string;
  color?: string;
  resizeMode?: 'cover' | 'contain';
  config?: Record<string, unknown>;
  style?: StyleProp<TextStyle>;
  renderError?: React.ComponentType<any>;
}

const MathView = require('react-native-math-view/src/fallback/SvgXml').default as React.ComponentType<MathViewProps>;

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
  const config = useMemo(() => ({
    displayAlign: display ? 'center' : 'auto',
    inline: !display,
  }), [display]);

  const formula = (
    <MathView
      math={math}
      color={color}
      resizeMode="contain"
      config={config}
      renderError={LatexError}
      style={[display ? styles.blockFormula : styles.inlineFormula, { color }]}
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
    minHeight: 22,
    justifyContent: 'center',
  },
  inlineFormula: {
    minHeight: 18,
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
    minHeight: 36,
  },
  errorText: {
    fontFamily: 'monospace',
    fontSize: fontSizes.sm,
  },
});
