import { BaseTool, ToolContext } from '../BaseTool';
import { ToolResult } from '../../../types';
import { WorkspaceFileItem, workspaceFs } from '../../../services/WorkspaceFileSystem';

export class FileReadTool extends BaseTool {
  readonly name = 'file_read';
  readonly description = '读取文件内容。返回带行号的文件内容。';
  readonly category = 'read' as const;
  readonly requiresConfirmation = false;
  readonly parameters = {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '文件的绝对或相对路径' },
      offset: { type: 'number', description: '起始行号 (从 0 开始)' },
      limit: { type: 'number', description: '最大读取行数 (默认: 2000)' },
    },
    required: ['file_path'],
  };

  async execute(input: { file_path: string; offset?: number; limit?: number }, context: ToolContext): Promise<ToolResult> {
    try {
      const filePath = workspaceFs.resolvePath(input.file_path, context.homePath);
      const exists = await workspaceFs.exists(filePath);
      if (!exists) {
        return { content: `文件不存在: ${filePath}`, toolCallId: '', isError: true };
      }

      try {
        const stat = await workspaceFs.stat(filePath);
        if (!stat.isDirectory()) {
          throw new Error('not directory');
        }
        const items = await workspaceFs.readDir(filePath);
        const list = await this.listDir(items, '');
        return {
          content: `目录 ${filePath}:\n${list}\n\n如需读取文件，请指定具体文件路径。`,
          toolCallId: ''
        };
      } catch {
        // not a directory, continue to read as file
      }

      const content = await workspaceFs.readFile(filePath);
      const lines = content.split('\n');
      const offset = input.offset || 0;
      const limit = input.limit || 2000;
      const sliced = lines.slice(offset, offset + limit);

      const numbered = sliced.map((line, i) => `${offset + i + 1}\t${line}`).join('\n');
      let result = numbered;
      if (lines.length > limit) {
        result += `\n\n... (共 ${lines.length} 行，显示 ${offset}-${Math.min(offset + limit, lines.length)})`;
      }

      return { content: result, toolCallId: '' };
    } catch (err: any) {
      return { content: `读取文件失败: ${err.message}`, toolCallId: '', isError: true };
    }
  }

  private async listDir(items: WorkspaceFileItem[], prefix: string): Promise<string> {
    let result = '';
    for (const item of items) {
      const indent = prefix ? '  ' + prefix : '';
      if (item.isDirectory()) {
        result += `${indent}[DIR]  ${item.name}/\n`;
        try {
          const subItems = await workspaceFs.readDir(item.path);
          result += await this.listDir(subItems, prefix + '  ');
        } catch {}
      } else {
        result += `${indent}[FILE] ${item.name}\n`;
      }
    }
    return result;
  }
}
