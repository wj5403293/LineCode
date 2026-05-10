import { ToolCategory, ToolResult } from '../../types';

export interface ToolContext {
  homePath: string;
}

export abstract class BaseTool<TInput = Record<string, unknown>> {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly category: ToolCategory;
  abstract readonly requiresConfirmation: boolean;
  abstract readonly parameters: Record<string, unknown>;

  abstract execute(input: TInput, context: ToolContext): Promise<ToolResult>;

  toJSON(): Record<string, unknown> {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
    };
  }
}
