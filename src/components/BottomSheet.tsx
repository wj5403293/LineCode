import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Pressable, PanResponder, Animated as RNAnimated } from 'react-native';
import { useTheme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function BottomSheet({ visible, onClose, children }: Props) {
  const { colors } = useTheme();
  const translateY = useRef(new RNAnimated.Value(600)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      RNAnimated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 80,
        stiffness: 300,
      }).start();
    } else {
      RNAnimated.timing(translateY, {
        toValue: 600,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 10,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          translateY.setValue(g.dy);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.5) {
          RNAnimated.timing(translateY, {
            toValue: 600,
            duration: 250,
            useNativeDriver: true,
          }).start(() => onClose());
        } else {
          RNAnimated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 80,
            stiffness: 300,
          }).start();
        }
      },
    })
  ).current;

  if (!mounted) return null;

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, 600],
    outputRange: [0.55, 0],
  });

  return (
    <>
      <RNAnimated.View style={[styles.backdrop, { opacity: backdropOpacity, backgroundColor: '#000' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </RNAnimated.View>
      <RNAnimated.View
        style={[styles.sheet, { backgroundColor: colors.surfaceElevated }, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        <Pressable style={styles.handleContainer}>
          <Pressable style={[styles.handle, { backgroundColor: colors.textTertiary }]} />
        </Pressable>
        {children}
      </RNAnimated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
});
