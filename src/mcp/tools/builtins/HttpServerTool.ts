import { NativeModules } from 'react-native';
import RNFS from 'react-native-fs';
import { BaseTool, ToolContext } from '../BaseTool';
import { ToolResult } from '../../../types';

const Server = NativeModules.SimpleHttpServer;

export class HttpServerTool extends BaseTool {
  readonly name = 'http_server';
  readonly description = '启动或停止本地 HTTP 文件服务器。可以指定端口和根目录。';
  readonly category = 'system' as const;
  readonly requiresConfirmation = false;
  readonly parameters = {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['start', 'stop'], description: '操作类型' },
      port: { type: 'number', description: '端口号（默认 0 自动分配空闲端口）' },
      root: { type: 'string', description: '服务器根目录（相对路径或绝对路径）' },
    },
    required: ['action'],
  };

  async execute(input: { action: 'start' | 'stop'; port?: number; root?: string }, context: ToolContext): Promise<ToolResult> {
    if (input.action === 'stop') {
      return this.stopServer();
    }
    return this.startServer(input.port || 0, input.root, context.homePath);
  }

  private async startServer(port: number, root: string | undefined, homePath: string): Promise<ToolResult> {
    try {
      if (!Server) {
        return { content: 'HTTP 服务器模块未就绪', toolCallId: '', isError: true };
      }

      const activePort: number = await Server.getPort();
      if (activePort > 0) {
        return { content: `服务器已在运行: http://localhost:${activePort}`, toolCallId: '' };
      }

      const rootPath = root
        ? (root.startsWith('/') ? root : `${homePath}/${root}`)
        : homePath;

      const dirExists = await RNFS.exists(rootPath);
      if (!dirExists) {
        return { content: `目录不存在: ${rootPath}`, toolCallId: '', isError: true };
      }

      const actualPort: number = await Server.start(port, rootPath);

      return {
        content: `HTTP 服务器已启动\n端口: ${actualPort}\n根目录: ${rootPath}\n访问: http://localhost:${actualPort}`,
        toolCallId: '',
      };
    } catch (err: any) {
      return { content: `启动服务器失败: ${err?.message || String(err)}`, toolCallId: '', isError: true };
    }
  }

  private async stopServer(): Promise<ToolResult> {
    try {
      if (!Server) {
        return { content: 'HTTP 服务器模块未就绪', toolCallId: '', isError: true };
      }

      const activePort: number = await Server.getPort();
      if (!activePort) {
        return { content: '服务器未在运行', toolCallId: '', isError: true };
      }

      await Server.stop();
      return { content: `服务器已停止 (端口 ${activePort})`, toolCallId: '' };
    } catch (err: any) {
      return { content: `停止服务器失败: ${err?.message || String(err)}`, toolCallId: '', isError: true };
    }
  }
}

export function getServerInfo(): { port: number; root: string } | null {
  // getServerInfo 改为异步获取，这里返回 null 表示需要调用异步方法
  return null;
}
