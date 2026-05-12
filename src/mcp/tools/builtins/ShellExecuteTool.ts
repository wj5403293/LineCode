import { BaseTool, ToolContext } from '../BaseTool';
import { ToolResult } from '../../../types';
import { sshService } from '../../../services/SSHService';

export class ShellExecuteTool extends BaseTool {
  readonly name = 'shell_execute';
  readonly description = '通过 SSH 执行 shell 命令。用于 Termux 或远程主机，命令会在执行前请求用户确认。';
  readonly category = 'system' as const;
  readonly requiresConfirmation = true;
  readonly parameters = {
    type: 'object',
    properties: {
      command: { type: 'string', description: '要执行的 shell 命令' },
      cwd: { type: 'string', description: '可选工作目录，会通过 cd 后执行命令' },
      timeoutMs: { type: 'number', description: '可选超时时间，单位毫秒，默认 30000' },
    },
    required: ['command'],
  };

  async execute(input: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const inputCommand = String(input.command || '');
    const inputCwd = typeof input.cwd === 'string' ? input.cwd : '';
    if (!inputCommand.trim()) {
      return { toolCallId: '', content: '命令不能为空', isError: true };
    }

    const timeoutMs = Math.max(1000, Math.min(Number(input.timeoutMs || 30000), 300000));
    const command = inputCwd.trim()
      ? `cd ${this.shellQuote(inputCwd.trim())} && ${inputCommand}`
      : inputCommand;

    try {
      const output = await sshService.executeCommand(command, timeoutMs);
      return { toolCallId: '', content: output || '命令执行完成，无输出' };
    } catch (err: any) {
      return { toolCallId: '', content: `命令执行失败: ${err.message || String(err)}`, isError: true };
    }
  }

  private shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }
}
