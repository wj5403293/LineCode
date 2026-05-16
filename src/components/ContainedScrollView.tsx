import React, { useCallback, useEffect, useRef } from 'react';
import { ScrollView } from 'react-native';
import type { GestureResponderEvent, ScrollViewProps } from 'react-native';
import { useContainedScrollLock } from './ContainedScrollContext';

type Props = ScrollViewProps;

export default React.forwardRef<ScrollView, Props>(function ContainedScrollView(
  props,
  ref,
) {
  const {
    nestedScrollEnabled = true,
    keyboardShouldPersistTaps = 'handled',
    onStartShouldSetResponder,
    onMoveShouldSetResponder,
    onResponderTerminationRequest,
    onTouchStart,
    onTouchEnd,
    onTouchCancel,
    ...rest
  } = props;
  const { lockOuterScroll, unlockOuterScroll } = useContainedScrollLock();
  const lockedRef = useRef(false);

  const handleStartShouldSetResponder = useCallback((event: GestureResponderEvent) => {
    return onStartShouldSetResponder?.(event) ?? false;
  }, [onStartShouldSetResponder]);

  const handleMoveShouldSetResponder = useCallback((event: GestureResponderEvent) => {
    return onMoveShouldSetResponder?.(event) ?? false;
  }, [onMoveShouldSetResponder]);

  const handleResponderTerminationRequest = useCallback((event: GestureResponderEvent) => {
    return onResponderTerminationRequest?.(event) ?? false;
  }, [onResponderTerminationRequest]);

  const releaseLock = useCallback(() => {
    if (!lockedRef.current) return;
    lockedRef.current = false;
    unlockOuterScroll();
  }, [unlockOuterScroll]);

  const handleTouchStart = useCallback((event: GestureResponderEvent) => {
    if (!lockedRef.current) {
      lockedRef.current = true;
      lockOuterScroll();
    }
    onTouchStart?.(event);
  }, [lockOuterScroll, onTouchStart]);

  const handleTouchEnd = useCallback((event: GestureResponderEvent) => {
    onTouchEnd?.(event);
    releaseLock();
  }, [onTouchEnd, releaseLock]);

  const handleTouchCancel = useCallback((event: GestureResponderEvent) => {
    onTouchCancel?.(event);
    releaseLock();
  }, [onTouchCancel, releaseLock]);

  useEffect(() => releaseLock, [releaseLock]);

  return (
    <ScrollView
      ref={ref}
      nestedScrollEnabled={nestedScrollEnabled}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      onStartShouldSetResponder={handleStartShouldSetResponder}
      onMoveShouldSetResponder={handleMoveShouldSetResponder}
      onResponderTerminationRequest={handleResponderTerminationRequest}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      {...rest}
    />
  );
});
