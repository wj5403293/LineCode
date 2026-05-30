import React, { useCallback, useEffect, useRef } from 'react';
import { ScrollView } from 'react-native';
import type { GestureResponderEvent, ScrollViewProps } from 'react-native';
import { useContainedScrollLock } from './ContainedScrollContext';

type Props = ScrollViewProps;
const OUTER_SCROLL_LOCK_TIMEOUT_MS = 4000;

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
    onResponderRelease,
    onResponderTerminate,
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
    scrollEventThrottle,
    onTouchStart,
    onTouchEnd,
    onTouchCancel,
    ...rest
  } = props;
  const { lockOuterScroll, unlockOuterScroll } = useContainedScrollLock();
  const lockedRef = useRef(false);
  const lockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleStartShouldSetResponder = useCallback((event: GestureResponderEvent) => {
    return onStartShouldSetResponder?.(event) ?? false;
  }, [onStartShouldSetResponder]);

  const handleMoveShouldSetResponder = useCallback((event: GestureResponderEvent) => {
    return onMoveShouldSetResponder?.(event) ?? false;
  }, [onMoveShouldSetResponder]);

  const handleResponderTerminationRequest = useCallback((event: GestureResponderEvent) => {
    return onResponderTerminationRequest?.(event) ?? false;
  }, [onResponderTerminationRequest]);

  const clearLockTimeout = useCallback(() => {
    if (lockTimeoutRef.current === null) return;
    clearTimeout(lockTimeoutRef.current);
    lockTimeoutRef.current = null;
  }, []);

  const releaseLock = useCallback(() => {
    clearLockTimeout();
    if (!lockedRef.current) return;
    lockedRef.current = false;
    unlockOuterScroll();
  }, [clearLockTimeout, unlockOuterScroll]);

  const scheduleLockTimeout = useCallback(() => {
    clearLockTimeout();
    lockTimeoutRef.current = setTimeout(() => {
      releaseLock();
    }, OUTER_SCROLL_LOCK_TIMEOUT_MS);
  }, [clearLockTimeout, releaseLock]);

  const acquireLock = useCallback(() => {
    if (!lockedRef.current) {
      lockedRef.current = true;
      lockOuterScroll();
    }
    scheduleLockTimeout();
  }, [lockOuterScroll, scheduleLockTimeout]);

  const handleTouchStart = useCallback((event: GestureResponderEvent) => {
    acquireLock();
    onTouchStart?.(event);
  }, [acquireLock, onTouchStart]);

  const handleTouchEnd = useCallback((event: GestureResponderEvent) => {
    onTouchEnd?.(event);
    releaseLock();
  }, [onTouchEnd, releaseLock]);

  const handleTouchCancel = useCallback((event: GestureResponderEvent) => {
    onTouchCancel?.(event);
    releaseLock();
  }, [onTouchCancel, releaseLock]);

  const handleResponderRelease = useCallback((event: GestureResponderEvent) => {
    onResponderRelease?.(event);
    releaseLock();
  }, [onResponderRelease, releaseLock]);

  const handleResponderTerminate = useCallback((event: GestureResponderEvent) => {
    onResponderTerminate?.(event);
    releaseLock();
  }, [onResponderTerminate, releaseLock]);

  const handleScroll = useCallback<NonNullable<ScrollViewProps['onScroll']>>((event) => {
    if (lockedRef.current) {
      scheduleLockTimeout();
    }
    onScroll?.(event);
  }, [onScroll, scheduleLockTimeout]);

  const handleScrollBeginDrag = useCallback<NonNullable<ScrollViewProps['onScrollBeginDrag']>>((event) => {
    acquireLock();
    onScrollBeginDrag?.(event);
  }, [acquireLock, onScrollBeginDrag]);

  const handleScrollEndDrag = useCallback<NonNullable<ScrollViewProps['onScrollEndDrag']>>((event) => {
    onScrollEndDrag?.(event);
    releaseLock();
  }, [onScrollEndDrag, releaseLock]);

  const handleMomentumScrollEnd = useCallback<NonNullable<ScrollViewProps['onMomentumScrollEnd']>>((event) => {
    onMomentumScrollEnd?.(event);
    releaseLock();
  }, [onMomentumScrollEnd, releaseLock]);

  useEffect(() => releaseLock, [releaseLock]);

  return (
    <ScrollView
      ref={ref}
      nestedScrollEnabled={nestedScrollEnabled}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      onStartShouldSetResponder={handleStartShouldSetResponder}
      onMoveShouldSetResponder={handleMoveShouldSetResponder}
      onResponderTerminationRequest={handleResponderTerminationRequest}
      onResponderRelease={handleResponderRelease}
      onResponderTerminate={handleResponderTerminate}
      onScroll={handleScroll}
      onScrollBeginDrag={handleScrollBeginDrag}
      onScrollEndDrag={handleScrollEndDrag}
      onMomentumScrollEnd={handleMomentumScrollEnd}
      scrollEventThrottle={scrollEventThrottle ?? 32}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      {...rest}
    />
  );
});
