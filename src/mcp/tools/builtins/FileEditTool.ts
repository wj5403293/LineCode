import RNFS from 'react-native-fs';
import { BaseTool, ToolContext } from '../BaseTool';
import { ToolResult } from '../../../types';

export class FileEditTool extends BaseTool {
  readonly name = 'file_edit';
  readonly description = '编辑文件内容。通过搜索替换的方式修改文件。';
  readonly category = 'write' as const;
  readonly requiresConfirmation = true;
  readonly parameters = {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '文件的绝对或相对路径' },
      old_string: { type: 'string', description: '要搜索的原始文本' },
      new_string: { type: 'string', description: '替换后的新文本' },
    },
    required: ['file_path', 'old_string', 'new_string'],
  };

  async execute(input: { file_path: string; old_string: string; new_string: string }, context: ToolContext): Promise<ToolResult> {
    try {
      const filePath = this.resolvePath(input.file_path, context.homePath);
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        return { content: `文件不存在: ${filePath}`, toolCallId: '', isError: true };
      }

      const content = await RNFS.readFile(filePath, 'utf8');
      if (!content.includes(input.old_string)) {
        return { content: `未找到匹配的文本`, toolCallId: '', isError: true };
      }

      const count = content.split(input.old_string).length - 1;
      const newContent = content.replace(input.old_string, input.new_string);
      await RNFS.writeFile(filePath, newContent, 'utf8');

      return {
        content: `编辑文件 ${input.file_path} (${count} 处匹配)`,
        toolCallId: '',
      };
    } catch (err: any) {
      return { content: `编辑文件失败: ${err.message}`, toolCallId: '', isError: true };
    }
  }

  private resolvePath(path: string, homePath: string): string {
    if (path.startsWith('/')) return path;
    return `${homePath}/${path}`;
  }
}
