import { BaseTool, ToolContext } from '../BaseTool';
import { ToolResult } from '../../../types';
import { WorkspaceFileItem, workspaceFs } from '../../../services/WorkspaceFileSystem';
import { toolAccessPolicyService } from '../../../services/ToolAccessPolicyService';

const LARGE_FILE_THRESHOLD_BYTES = 50 * 1024;
const DEFAULT_LIMIT = 2000;

export class FileReadTool extends BaseTool {
  readonly name = 'file_read';
  readonly description = '读取文件内容。返回带行号的文件内容；大文件请通过 start_line/end_line 分段读取。';
  readonly category = 'read' as const;
  readonly requiresConfirmation = false;
  readonly parameters = {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '文件的绝对或相对路径' },
      start_line: { type: 'number', description: '可选，起始行号（从 1 开始，包含该行）' },
      end_line: { type: 'number', description: '可选，结束行号（从 1 开始，包含该行）' },
      offset: { type: 'number', description: '兼容旧参数：起始行偏移 (从 0 开始)' },
      limit: { type: 'number', description: '兼容旧参数：最大读取行数 (默认: 2000)' },
    },
    required: ['file_path'],
  };

  async execute(
    input: { file_path: string; start_line?: number; end_line?: number; offset?: number; limit?: number },
    context: ToolContext,
  ): Promise<ToolResult> {
    try {
      const policy = await toolAccessPolicyService.buildPolicy(context.homePath);
      const filePath = workspaceFs.resolveToolPath(input.file_path, policy, 'read');
      const exists = await workspaceFs.exists(filePath);
      if (!exists) {
        return { content: `文件不存在: ${workspaceFs.toToolDisplayPath(filePath, context.homePath)}`, toolCallId: '', isError: true };
      }

      let stat;
      try {
        stat = await workspaceFs.stat(filePath);
        if (stat.isDirectory()) {
          const items = await workspaceFs.readDir(filePath);
          const list = await this.listDir(items);
          return {
            content: `目录 ${workspaceFs.toToolDisplayPath(filePath, context.homePath)}:\n${list || '(空目录)'}\n\n如需读取文件，请指定具体文件路径。`,
            toolCallId: '',
          };
        }
      } catch (err: any) {
        if (err?.message !== 'not directory') {
          throw err;
        }
      }

      const hasLineRange = Number.isFinite(input.start_line) || Number.isFinite(input.end_line);
      if (!hasLineRange && stat && stat.size > LARGE_FILE_THRESHOLD_BYTES) {
        return {
          content: [
            `文件 ${workspaceFs.toToolDisplayPath(filePath, context.homePath)} 大小为 ${stat.size} bytes，超过 50KB。`,
            '为避免一次性读取过大内容，请让 AI 使用 start_line 和 end_line 分段读取，例如：',
            `{"file_path":"${input.file_path}","start_line":1,"end_line":200}`,
          ].join('\n'),
          toolCallId: '',
          isError: true,
        };
      }

      const content = await workspaceFs.readFile(filePath);
      const lines = content.split('\n');
      const range = this.resolveRange(input, lines.length);
      const sliced = lines.slice(range.startIndex, range.endIndexExclusive);

      const numbered = sliced.map((line, i) => `${range.startIndex + i + 1}\t${line}`).join('\n');
      let result = numbered;
      if (range.startIndex > 0 || range.endIndexExclusive < lines.length) {
        result += `\n\n... (共 ${lines.length} 行，显示 ${range.startIndex + 1}-${range.endIndexExclusive})`;
      }

      return { content: result, toolCallId: '' };
    } catch (err: any) {
      return { content: `读取文件失败: ${err.message}`, toolCallId: '', isError: true };
    }
  }

  private resolveRange(
    input: { start_line?: number; end_line?: number; offset?: number; limit?: number },
    totalLines: number,
  ): { startIndex: number; endIndexExclusive: number } {
    if (Number.isFinite(input.start_line) || Number.isFinite(input.end_line)) {
      const startLine = Math.max(1, Math.floor(Number(input.start_line || 1)));
      const endLine = Math.min(
        totalLines,
        Math.max(startLine, Math.floor(Number(input.end_line || Math.min(totalLines, startLine + DEFAULT_LIMIT - 1)))),
      );
      return { startIndex: startLine - 1, endIndexExclusive: endLine };
    }

    const offset = Math.max(0, Math.floor(Number(input.offset || 0)));
    const limit = Math.max(1, Math.floor(Number(input.limit || DEFAULT_LIMIT)));
    return { startIndex: offset, endIndexExclusive: Math.min(totalLines, offset + limit) };
  }

  private async listDir(items: WorkspaceFileItem[], parentPath = ''): Promise<string> {
    let result = '';
    for (const item of items) {
      const relativePath = parentPath ? `${parentPath}/${item.name}` : item.name;
      if (item.isDirectory()) {
        result += `[DIR]  ${relativePath}/\n`;
        try {
          const subItems = await workspaceFs.readDir(item.path);
          result += await this.listDir(subItems, relativePath);
        } catch {}
      } else {
        result += `[FILE] ${relativePath}\n`;
      }
    }
    return result;
  }
}
