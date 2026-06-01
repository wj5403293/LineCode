import { StreamBufferedUpdate, StreamUpdateBuffer } from '../src/chat/StreamUpdateBuffer';

describe('StreamUpdateBuffer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses the latest dynamic flush interval when scheduling updates', () => {
    const intervals = [80, 360];
    const flushed: StreamBufferedUpdate[][] = [];
    const buffer = new StreamUpdateBuffer(
      () => intervals.shift() ?? 360,
      updates => flushed.push(updates),
    );

    buffer.pushStatus('first');
    jest.advanceTimersByTime(79);
    expect(flushed).toEqual([]);

    jest.advanceTimersByTime(1);
    expect(flushed).toEqual([[{ type: 'status', status: 'first' }]]);

    buffer.pushStatus('second');
    jest.advanceTimersByTime(359);
    expect(flushed).toHaveLength(1);

    jest.advanceTimersByTime(1);
    expect(flushed).toEqual([
      [{ type: 'status', status: 'first' }],
      [{ type: 'status', status: 'second' }],
    ]);
  });
});
