import { BaseTool, ToolContext } from '../BaseTool';
import { ToolResult } from '../../../types';
import { workspaceFs } from '../../../services/WorkspaceFileSystem';
import { toolAccessPolicyService } from '../../../services/ToolAccessPolicyService';

export class FileEditTool extends BaseTool {
  readonly name = 'file_edit';
  readonly description = '编辑文件内容。通过搜索替换的方式修改文件。';
  readonly category = 'write' as const;
  readonly requiresConfirmation = false;
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
      const policy = await toolAccessPolicyService.buildPolicy(context.homePath);
      const filePath = workspaceFs.resolveToolPath(input.file_path, policy, 'write');
      const exists = await workspaceFs.exists(filePath);
      if (!exists) {
        return { content: `文件不存在: ${workspaceFs.toToolDisplayPath(filePath, context.homePath)}`, toolCallId: '', isError: true };
      }

      try {
        const stat = await workspaceFs.stat(filePath);
        if (stat.isDirectory()) {
          return {
            content: `路径是一个目录，无法编辑文件: ${input.file_path}\n如需编辑文件，请指定具体文件路径。`,
            toolCallId: '',
            isError: true,
          };
        }
      } catch {}

      const content = await workspaceFs.readFile(filePath);
      if (!content.includes(input.old_string)) {
        return { content: `未找到匹配的文本`, toolCallId: '', isError: true };
      }

      const count = content.split(input.old_string).length - 1;
      const newContent = content.replace(input.old_string, input.new_string);
      await workspaceFs.writeFile(filePath, newContent);

      return {
        content: `成功编辑文件 ${input.file_path} (${count} 处匹配已替换)`,
        toolCallId: '',
      };
    } catch (err: any) {
      return { content: `编辑文件失败: ${err.message}`, toolCallId: '', isError: true };
    }
  }

}
