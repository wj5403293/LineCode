import { AgentProgressStore } from '../src/mcp/AgentProgressStore';

describe('AgentProgressStore', () => {
  it('keeps parallel agent progress as separate items', () => {
    const store = new AgentProgressStore();

    store.upsert({
      id: 'a',
      name: 'Agent A',
      type: 'explore',
      output: 'A1',
      startTime: 1,
    });
    store.upsert({
      id: 'b',
      name: 'Agent B',
      type: 'sub-coding',
      output: 'B1',
      startTime: 2,
    });
    store.upsert({
      id: 'a',
      name: 'Agent A',
      type: 'explore',
      output: 'A2',
      startTime: 1,
    });

    expect(store.snapshot()).toEqual([
      expect.objectContaining({ id: 'a', output: 'A2' }),
      expect.objectContaining({ id: 'b', output: 'B1' }),
    ]);
  });
});
