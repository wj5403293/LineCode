import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const BOTTOM_FOLLOW_THRESHOLD = 80;

interface ScrollMetrics {
  layoutHeight: number;
  contentHeight: number;
  offsetY: number;
}

function isScrollMetricsNearBottom(metrics: ScrollMetrics): boolean {
  const maxOffset = Math.max(0, metrics.contentHeight - metrics.layoutHeight);
  const currentOffset = Math.max(0, metrics.offsetY);
  return maxOffset - currentOffset <= BOTTOM_FOLLOW_THRESHOLD;
}

function getScrollMetrics(event: NativeScrollEvent): ScrollMetrics {
  return {
    layoutHeight: event.layoutMeasurement.height,
    contentHeight: event.contentSize.height,
    offsetY: event.contentOffset.y,
  };
}

export function useChatScrollState() {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const shouldFollowBottomRef = useRef(true);
  const scrollMetricsRef = useRef<ScrollMetrics>({ layoutHeight: 0, contentHeight: 0, offsetY: 0 });
  const scrollToBottomFrameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const setAtBottom = useCallback((next: boolean) => {
    setIsAtBottom(prev => prev === next ? prev : next);
  }, []);

  const enableBottomFollow = useCallback(() => {
    shouldFollowBottomRef.current = true;
    setAtBottom(true);
  }, [setAtBottom]);

  const requestScrollToBottom = useCallback((animated = true) => {
    if (scrollToBottomFrameRef.current !== null) {
      cancelAnimationFrame(scrollToBottomFrameRef.current);
    }
    scrollToBottomFrameRef.current = requestAnimationFrame(() => {
      scrollToBottomFrameRef.current = null;
      flatListRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    return () => {
      if (scrollToBottomFrameRef.current !== null) {
        cancelAnimationFrame(scrollToBottomFrameRef.current);
      }
    };
  }, []);

  const scrollToBottom = useCallback((animated = true) => {
    if (shouldFollowBottomRef.current) {
      requestScrollToBottom(animated);
    }
  }, [requestScrollToBottom]);

  const jumpToBottom = useCallback((animated = true) => {
    enableBottomFollow();
    requestScrollToBottom(animated);
  }, [enableBottomFollow, requestScrollToBottom]);

  const handleScrollBeginDrag = useCallback(() => {
    shouldFollowBottomRef.current = false;
  }, []);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const metrics = getScrollMetrics(e.nativeEvent);
    scrollMetricsRef.current = metrics;
    setAtBottom(isScrollMetricsNearBottom(metrics));
  }, [setAtBottom]);

  const handleScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const metrics = getScrollMetrics(e.nativeEvent);
    scrollMetricsRef.current = metrics;
    const nextAtBottom = isScrollMetricsNearBottom(metrics);
    setAtBottom(nextAtBottom);
    if (nextAtBottom) {
      shouldFollowBottomRef.current = true;
    }
  }, [setAtBottom]);

  const handleContentSizeChange = useCallback((_width: number, height: number) => {
    const metrics = { ...scrollMetricsRef.current, contentHeight: height };
    scrollMetricsRef.current = metrics;
    if (shouldFollowBottomRef.current) {
      setAtBottom(true);
      requestScrollToBottom(false);
      return;
    }
    setAtBottom(isScrollMetricsNearBottom(metrics));
  }, [requestScrollToBottom, setAtBottom]);

  const handleListLayout = useCallback((e: LayoutChangeEvent) => {
    const metrics = { ...scrollMetricsRef.current, layoutHeight: e.nativeEvent.layout.height };
    scrollMetricsRef.current = metrics;
    if (shouldFollowBottomRef.current) {
      setAtBottom(true);
      requestScrollToBottom(false);
      return;
    }
    setAtBottom(isScrollMetricsNearBottom(metrics));
  }, [requestScrollToBottom, setAtBottom]);

  return {
    flatListRef,
    isAtBottom,
    enableBottomFollow,
    scrollToBottom,
    jumpToBottom,
    handleScrollBeginDrag,
    handleScroll,
    handleScrollEnd,
    handleContentSizeChange,
    handleListLayout,
  };
}
