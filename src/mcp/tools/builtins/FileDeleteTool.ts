import { BaseTool, ToolContext } from '../BaseTool';
import { ToolResult } from '../../../types';
import { workspaceFs } from '../../../services/WorkspaceFileSystem';
import { toolAccessPolicyService } from '../../../services/ToolAccessPolicyService';

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

    const policy = await toolAccessPolicyService.buildPolicy(context.homePath);

    for (const path of input.paths) {
      try {
        const targetPath = workspaceFs.resolveToolPath(path, policy, 'delete');

        const exists = await workspaceFs.exists(targetPath);
        if (!exists) {
          errors.push(`路径不存在: ${path}`);
          continue;
        }

        await workspaceFs.unlink(targetPath);
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

    return {
      content: content || '没有删除任何文件',
      toolCallId: '',
      isError: errors.length > 0 && results.length === 0,
    };
  }

}
