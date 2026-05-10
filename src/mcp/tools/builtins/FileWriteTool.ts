import RNFS from 'react-native-fs';
import { BaseTool, ToolContext } from '../BaseTool';
import { ToolResult } from '../../../types';

export class FileWriteTool extends BaseTool {
  readonly name = 'file_write';
  readonly description = '将内容写入文件。如果文件或目录不存在会自动创建。';
  readonly category = 'write' as const;
  readonly requiresConfirmation = false;
  readonly parameters = {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '文件的绝对或相对路径' },
      content: { type: 'string', description: '要写入的内容' },
    },
    required: ['file_path', 'content'],
  };

  async execute(input: { file_path: string; content: string }, context: ToolContext): Promise<ToolResult> {
    try {
      const filePath = this.resolvePath(input.file_path, context.homePath);
      const dir = filePath.substring(0, filePath.lastIndexOf('/'));

      // 确保目录存在（递归创建）
      const dirExists = await RNFS.exists(dir);
      if (!dirExists) {
        await this.mkdirRecursive(dir);
      }

      let oldContent = '';
      const fileExists = await RNFS.exists(filePath);
      if (fileExists) {
        try {
          const items = await RNFS.readDir(filePath);
          return { 
            content: `路径是一个目录，无法写入文件: ${input.file_path}\n如需创建文件，请指定完整文件路径。`, 
            toolCallId: '', 
            isError: true 
          };
        } catch {
          oldContent = await RNFS.readFile(filePath, 'utf8');
        }
      }

      // 写入新内容
      await RNFS.writeFile(filePath, input.content, 'utf8');

      const isNewFile = !fileExists;
      const lineCount = input.content.split('\n').length;
      const header = isNewFile
        ? `成功创建文件 ${input.file_path} (${lineCount} 行)`
        : `成功更新文件 ${input.file_path} (${lineCount} 行)`;

      return {
        content: header,
        toolCallId: '',
      };
    } catch (err: any) {
      return { content: `写入文件失败: ${err.message}`, toolCallId: '', isError: true };
    }
  }

  private async mkdirRecursive(dirPath: string): Promise<void> {
    const exists = await RNFS.exists(dirPath);
    if (exists) return;

    const parentDir = dirPath.substring(0, dirPath.lastIndexOf('/'));
    if (parentDir && parentDir !== dirPath) {
      await this.mkdirRecursive(parentDir);
    }

    await RNFS.mkdir(dirPath, { NSURLIsExcludedFromBackupKey: true });
  }

  private resolvePath(path: string, homePath: string): string {
    if (path.startsWith('/')) return path;
    return `${homePath}/${path}`;
  }
}
