import { BaseTool, ToolContext } from '../BaseTool';
import { ToolResult } from '../../../types';
import { workspaceFs } from '../../../services/WorkspaceFileSystem';

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
      const filePath = workspaceFs.resolvePath(input.file_path, context.homePath);
      const dir = workspaceFs.parentPath(filePath);

      const dirExists = await workspaceFs.exists(dir);
      if (!dirExists) {
        await this.mkdirRecursive(dir);
      }

      const fileExists = await workspaceFs.exists(filePath);
      if (fileExists) {
        try {
          const stat = await workspaceFs.stat(filePath);
          if (stat.isDirectory()) {
            return {
              content: `路径是一个目录，无法写入文件: ${input.file_path}\n如需创建文件，请指定完整文件路径。`,
              toolCallId: '',
              isError: true,
            };
          }
        } catch {}
      }

      const contentSize = typeof Blob !== 'undefined'
        ? new Blob([input.content]).size
        : input.content.length;
      if (contentSize > 50 * 1024) {
        await workspaceFs.writeFileChunked(filePath, input.content);
      } else {
        await workspaceFs.writeFile(filePath, input.content);
      }

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
    const exists = await workspaceFs.exists(dirPath);
    if (exists) return;

    const parentDir = workspaceFs.parentPath(dirPath);
    if (parentDir && parentDir !== dirPath) {
      await this.mkdirRecursive(parentDir);
    }

    await workspaceFs.mkdir(dirPath);
  }
}
