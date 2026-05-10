import { ToolCategory } from '../../types';
import { BaseTool } from './BaseTool';

export class ToolRegistry {
  private tools = new Map<string, BaseTool>();

  register(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  getAll(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  getByCategory(category: ToolCategory): BaseTool[] {
    return this.getAll().filter(t => t.category === category);
  }

  getByNameList(names: string[]): BaseTool[] {
    return names.map(n => this.tools.get(n)).filter(Boolean) as BaseTool[];
  }

  toJSONSchema(names?: string[]): Record<string, unknown>[] {
    const tools = names ? this.getByNameList(names) : this.getAll();
    return tools.map(t => t.toJSON());
  }
}
