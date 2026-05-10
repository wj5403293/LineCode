import { BaseTool, ToolContext } from '../BaseTool';
import { ToolResult } from '../../../types';

let serverInstance: any = null;
let serverPort = 0;
let serverRoot = '';

export class HttpServerTool extends BaseTool {
  readonly name = 'http_server';
  readonly description = '启动或停止本地 HTTP 文件服务器。可以指定端口和根目录。';
  readonly category = 'system' as const;
  readonly requiresConfirmation = false;
  readonly parameters = {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['start', 'stop'], description: '操作类型' },
      port: { type: 'number', description: '端口号（默认 8080）' },
      root: { type: 'string', description: '服务器根目录（相对路径或绝对路径）' },
    },
    required: ['action'],
  };

  async execute(input: { action: 'start' | 'stop'; port?: number; root?: string }, context: ToolContext): Promise<ToolResult> {
    if (input.action === 'stop') {
      return this.stopServer();
    }
    return this.startServer(input.port || 8080, input.root, context.homePath);
  }

  private async startServer(port: number, root: string | undefined, homePath: string): Promise<ToolResult> {
    try {
      if (serverInstance) {
        return { content: `服务器已在运行: http://localhost:${serverPort}`, toolCallId: '' };
      }

      const rootPath = root
        ? (root.startsWith('/') ? root : `${homePath}/${root}`)
        : homePath;

      const RNFS = require('react-native-fs');

      // 使用 Node.js http 模块（React Native 有 polyfill）
      const http = require('http');

      const server = http.createServer(async (req: any, res: any) => {
        try {
          let reqPath = decodeURIComponent(req.url || '/');
          if (reqPath === '/') reqPath = '/index.html';

          const filePath = rootPath + reqPath;
          const exists = await RNFS.exists(filePath);
          if (!exists) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
          }

          const stat = await RNFS.stat(filePath);
          if (stat.isDirectory()) {
            const files = await RNFS.readDir(filePath);
            const links = files.map((f: any) => {
              const sep = reqPath.endsWith('/') ? '' : '/';
              const icon = f.isDirectory() ? '📁' : '📄';
              return `<li>${icon} <a href="${reqPath}${sep}${f.name}">${f.name}${f.isDirectory() ? '/' : ''}</a></li>`;
            }).join('');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>LineCode Server</title></head><body><h2>📂 ${reqPath}</h2><ul>${links}</ul></body></html>`);
            return;
          }

          const content = await RNFS.readFile(filePath, 'utf8');
          const ext = filePath.includes('.') ? filePath.split('.').pop()?.toLowerCase() : '';
          const mimeTypes: Record<string, string> = {
            '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
            '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml', '.txt': 'text/plain', '.md': 'text/markdown',
          };
          res.writeHead(200, { 'Content-Type': mimeTypes['.' + ext] || 'application/octet-stream' });
          res.end(content);
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error: ' + err.message);
        }
      });

      await new Promise<void>((resolve, reject) => {
        server.listen(port, '0.0.0.0', () => {
          serverInstance = server;
          serverPort = port;
          serverRoot = rootPath;
          resolve();
        });
        server.on('error', reject);
      });

      return {
        content: `HTTP 服务器已启动\n端口: ${port}\n根目录: ${rootPath}\n访问: http://localhost:${port}`,
        toolCallId: '',
      };
    } catch (err: any) {
      return { content: `启动服务器失败: ${err.message}`, toolCallId: '', isError: true };
    }
  }

  private stopServer(): ToolResult {
    if (!serverInstance) {
      return { content: '服务器未在运行', toolCallId: '', isError: true };
    }
    serverInstance.close();
    const port = serverPort;
    serverInstance = null;
    serverPort = 0;
    return { content: `服务器已停止 (端口 ${port})`, toolCallId: '' };
  }
}

export function getServerInfo(): { port: number; root: string } | null {
  if (!serverInstance) return null;
  return { port: serverPort, root: serverRoot };
}
