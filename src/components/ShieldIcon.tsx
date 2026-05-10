import React from 'react';
import { View, StyleSheet } from 'react-native';

interface Props {
  size?: number;
  color?: string;
}

export default React.memo(function ShieldIcon({ size = 18, color = '#8E8E93' }: Props) {
  const blockSize = size * 0.35;
  const gap = size * 0.06;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={styles.row}>
        <View style={[styles.block, { width: blockSize, height: blockSize, backgroundColor: color }]} />
        <View style={[styles.block, { width: blockSize, height: blockSize, backgroundColor: 'transparent', borderColor: color, borderWidth: 1 }]} />
      </View>
      <View style={[styles.row, { marginTop: gap }]}>
        <View style={[styles.block, { width: blockSize, height: blockSize, backgroundColor: 'transparent', borderColor: color, borderWidth: 1 }]} />
        <View style={[styles.block, { width: blockSize, height: blockSize, backgroundColor: color }]} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 3,
  },
  block: {
    borderRadius: 2,
  },
});
