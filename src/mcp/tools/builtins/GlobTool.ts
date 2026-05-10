import RNFS from 'react-native-fs';
import { BaseTool, ToolContext } from '../BaseTool';
import { ToolResult } from '../../../types';

export class GlobTool extends BaseTool {
  readonly name = 'glob';
  readonly description = '搜索匹配的文件。支持 * 通配符。';
  readonly category = 'read' as const;
  readonly requiresConfirmation = false;
  readonly parameters = {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: '文件匹配模式，如 *.ts, src/**/*.tsx' },
      path: { type: 'string', description: '搜索根目录（可选，默认为 home 目录）' },
    },
    required: ['pattern'],
  };

  async execute(input: { pattern: string; path?: string }, context: ToolContext): Promise<ToolResult> {
    try {
      const searchPath = input.path
        ? (input.path.startsWith('/') ? input.path : `${context.homePath}/${input.path}`)
        : context.homePath;

      const results = await this.search(searchPath, input.pattern, searchPath);
      if (results.length === 0) {
        return { content: '未找到匹配的文件', toolCallId: '' };
      }

      return {
        content: `找到 ${results.length} 个匹配文件:\n${results.join('\n')}`,
        toolCallId: '',
      };
    } catch (err: any) {
      return { content: `搜索失败: ${err.message}`, toolCallId: '', isError: true };
    }
  }

  private async search(dir: string, pattern: string, rootPath: string): Promise<string[]> {
    const results: string[] = [];
    try {
      const items = await RNFS.readDir(dir);
      for (const item of items) {
        const relativePath = item.path.replace(rootPath, '').replace(/^\//, '');
        if (item.isDirectory()) {
          if (!item.name.startsWith('.')) {
            const subResults = await this.search(item.path, pattern, rootPath);
            results.push(...subResults);
          }
        } else {
          if (this.matchPattern(item.name, pattern)) {
            results.push(relativePath);
          }
        }
      }
    } catch {
      // 忽略无权限的目录
    }
    return results;
  }

  private matchPattern(name: string, pattern: string): boolean {
    const regex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regex}$`).test(name);
  }
}
