const fs = require('fs');
const path = require('path');

describe('sub-agent loop limits', () => {
  const projectRoot = path.resolve(__dirname, '..');

  const readSource = (relativePath: string) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

  it('does not impose a fixed max-iteration cap on built-in sub agents', () => {
    const agentTool = readSource('src/mcp/tools/builtins/AgentTool.ts');
    const agentPipelineTool = readSource('src/mcp/tools/builtins/AgentPipelineTool.ts');

    expect(agentTool).not.toMatch(/AGENT_MAX_ITERATIONS/);
    expect(agentPipelineTool).not.toMatch(/AGENT_MAX_ITERATIONS/);
    expect(agentTool).toMatch(/while \(true\)/);
    expect(agentPipelineTool).toMatch(/while \(true\)/);
  });

  it('does not impose a fixed max-iteration cap on custom agent extensions', () => {
    const runtimeRegistry = readSource('src/mcp/tools/runtimeRegistry.ts');

    expect(runtimeRegistry).not.toMatch(/CUSTOM_AGENT_MAX_ITERATIONS/);
    expect(runtimeRegistry).not.toContain('已达到最大迭代次数');
    expect(runtimeRegistry).toMatch(/while \(true\)/);
  });
});
