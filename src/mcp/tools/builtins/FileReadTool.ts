import RNFS from 'react-native-fs';
import { BaseTool, ToolContext } from '../BaseTool';
import { ToolResult } from '../../../types';

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
      const filePath = this.resolvePath(input.file_path, context.homePath);
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        return { content: `文件不存在: ${filePath}`, toolCallId: '', isError: true };
      }

      let isDirectory = false;
      try {
        const items = await RNFS.readDir(filePath);
        isDirectory = true;
        const fileList = items.map(item => `${item.isDirectory() ? '📁' : '📄'} ${item.name}`).join('\n');
        return { 
          content: `这是一个目录，包含以下内容:\n${fileList}\n\n如需读取文件，请指定具体文件路径。`, 
          toolCallId: '' 
        };
      } catch {
        isDirectory = false;
      }

      const content = await RNFS.readFile(filePath, 'utf8');
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

  private resolvePath(path: string, homePath: string): string {
    if (path.startsWith('/')) return path;
    return `${homePath}/${path}`;
  }
}
