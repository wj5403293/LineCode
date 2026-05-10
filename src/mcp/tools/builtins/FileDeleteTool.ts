import RNFS from 'react-native-fs';
import { BaseTool, ToolContext } from '../BaseTool';
import { ToolResult } from '../../../types';

export class FileDeleteTool extends BaseTool {
  readonly name = 'file_delete';
  readonly description = '删除一个或多个文件/目录。此操作不可逆，会永久删除。支持批量删除。';
  readonly category = 'write' as const;
  readonly requiresConfirmation = true;
  readonly parameters = {
    type: 'object',
    properties: {
      paths: {
        type: 'array',
        items: { type: 'string' },
        description: '要删除的文件或目录路径列表',
      },
    },
    required: ['paths'],
  };

  async execute(input: { paths: string[] }, context: ToolContext): Promise<ToolResult> {
    const results: string[] = [];
    const errors: string[] = [];

    for (const path of input.paths) {
      try {
        const targetPath = this.resolvePath(path, context.homePath);

        const exists = await RNFS.exists(targetPath);
        if (!exists) {
          errors.push(`路径不存在: ${path}`);
          continue;
        }

        await RNFS.unlink(targetPath);
        results.push(`已删除: ${path}`);
      } catch (err: any) {
        errors.push(`删除 ${path} 失败: ${err.message}`);
      }
    }

    let content = '';
    if (results.length > 0) {
      content += `成功删除 ${results.length} 项:\n${results.join('\n')}`;
    }
    if (errors.length > 0) {
      content += `\n\n失败 ${errors.length} 项:\n${errors.join('\n')}`;
    }
    if (results.length > 0) {
      content += '\n\n删除操作已完成。请继续其他操作或向用户报告结果。';
    }

    return {
      content: content || '没有删除任何文件',
      toolCallId: '',
      isError: errors.length > 0 && results.length === 0,
    };
  }

  private resolvePath(path: string, homePath: string): string {
    if (path.startsWith('/')) return path;
    return `${homePath}/${path}`;
  }
}
