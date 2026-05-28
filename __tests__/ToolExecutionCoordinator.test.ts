import { ToolExecutionCoordinator } from '../src/chat/ToolExecutionCoordinator';
import { ToolCall } from '../src/types';

function tool(name: string, args = '{}'): ToolCall {
  return {
    id: `${name}-${Math.random()}`,
    name,
    arguments: args,
  };
}

describe('ToolExecutionCoordinator', () => {
  it('runs read-only tools concurrently and mutating tools sequentially', () => {
    const coordinator = new ToolExecutionCoordinator();
    const read = tool('file_read');
    const glob = tool('glob');
    const write = tool('file_write');
    const shell = tool('shell_execute');

    const plan = coordinator.createPlan([read, glob, write, shell]);

    expect(plan.concurrentTasks).toEqual([read, glob]);
    expect(plan.sequentialTasks).toEqual([write, shell]);
  });

  it('only treats explore agents as concurrency safe', () => {
    const coordinator = new ToolExecutionCoordinator();
    const explore = tool('agent', JSON.stringify({ type: 'explore' }));
    const subCoding = tool('agent', JSON.stringify({ type: 'sub-coding' }));
    const invalid = tool('agent', '{invalid');

    const plan = coordinator.createPlan([explore, subCoding, invalid]);

    expect(plan.concurrentTasks).toEqual([explore]);
    expect(plan.sequentialTasks).toEqual([subCoding, invalid]);
  });
});
