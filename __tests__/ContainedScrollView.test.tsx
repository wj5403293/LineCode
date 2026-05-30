import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { ScrollView, Text } from 'react-native';
import ContainedScrollView from '../src/components/ContainedScrollView';
import { ContainedScrollProvider } from '../src/components/ContainedScrollContext';

describe('ContainedScrollView', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('releases the outer scroll lock when touch ends', async () => {
    const setOuterScrollEnabled = jest.fn();
    let tree: TestRenderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = TestRenderer.create(
        <ContainedScrollProvider setOuterScrollEnabled={setOuterScrollEnabled}>
          <ContainedScrollView>
            <Text>nested</Text>
          </ContainedScrollView>
        </ContainedScrollProvider>,
        { unstable_isConcurrent: false } as never,
      );
    });

    const scroll = tree!.root.findByType(ScrollView);

    act(() => {
      scroll.props.onTouchStart({});
      scroll.props.onTouchEnd({});
    });

    expect(setOuterScrollEnabled).toHaveBeenNthCalledWith(1, false);
    expect(setOuterScrollEnabled).toHaveBeenNthCalledWith(2, true);
  });

  it('uses a watchdog to avoid leaving the outer list disabled', async () => {
    const setOuterScrollEnabled = jest.fn();
    let tree: TestRenderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = TestRenderer.create(
        <ContainedScrollProvider setOuterScrollEnabled={setOuterScrollEnabled}>
          <ContainedScrollView>
            <Text>nested</Text>
          </ContainedScrollView>
        </ContainedScrollProvider>,
        { unstable_isConcurrent: false } as never,
      );
    });

    const scroll = tree!.root.findByType(ScrollView);

    act(() => {
      scroll.props.onTouchStart({});
      jest.advanceTimersByTime(4000);
    });

    expect(setOuterScrollEnabled).toHaveBeenNthCalledWith(1, false);
    expect(setOuterScrollEnabled).toHaveBeenNthCalledWith(2, true);
  });
});
