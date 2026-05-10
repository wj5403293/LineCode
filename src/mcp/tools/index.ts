import { ToolRegistry } from './ToolRegistry';
import { FileReadTool } from './builtins/FileReadTool';
import { FileWriteTool } from './builtins/FileWriteTool';
import { FileEditTool } from './builtins/FileEditTool';
import { FileDeleteTool } from './builtins/FileDeleteTool';
import { GlobTool } from './builtins/GlobTool';
import { HttpServerTool } from './builtins/HttpServerTool';
import { AgentTool } from './builtins/AgentTool';

export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(new FileReadTool());
  registry.register(new FileWriteTool());
  registry.register(new FileEditTool());
  registry.register(new FileDeleteTool());
  registry.register(new GlobTool());
  registry.register(new HttpServerTool());
  registry.register(new AgentTool());
  return registry;
}

export { ToolRegistry } from './ToolRegistry';
export { BaseTool, type ToolContext } from './BaseTool';
