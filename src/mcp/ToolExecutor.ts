import RNFS from 'react-native-fs';
import { ToolCall, ToolResult, ContentBlock } from '../types';
import { createDefaultRegistry, ToolContext } from './tools';
import { diffService } from '../services/DiffService';
import { permissionService } from '../services/PermissionService';

const HOME_DIR = `${RNFS.DocumentDirectoryPath}/.linecode/home`;

async function ensureHomeDir(): Promise<void> {
  const exists = await RNFS.exists(HOME_DIR);
  if (!exists) {
    await RNFS.mkdir(HOME_DIR);
  }
}

export async function getHomePath(): Promise<string> {
  await ensureHomeDir();
  return HOME_DIR;
}

export interface ExecuteToolOptions {
  onProgress?: (update: Partial<ContentBlock>) => void;
  onConfirm?: (toolCall: ToolCall) => Promise<boolean>;
}

export async function executeTool(
  toolCall: ToolCall,
  options?: ExecuteToolOptions,
): Promise<ToolResult> {
  const registry = createDefaultRegistry();
  const tool = registry.get(toolCall.name);

  if (!tool) {
    return {
      toolCallId: toolCall.id,
      content: `未知工具: ${toolCall.name}`,
      isError: true,
    };
  }

  const permResult = permissionService.canExecuteTool(toolCall.name, tool.category);
  if (!permResult.allowed) {
    return {
      toolCallId: toolCall.id,
      content: permResult.reason || '权限不足',
      isError: true,
    };
  }

  let input: Record<string, unknown> = {};
  try {
    input = JSON.parse(toolCall.arguments);
  } catch {
    return {
      toolCallId: toolCall.id,
      content: `参数解析失败: ${toolCall.arguments}`,
      isError: true,
    };
  }

  const homePath = await getHomePath();
  const context: ToolContext = { 
    homePath, 
    onProgress: options?.onProgress,
    onConfirm: options?.onConfirm,
  };

  if (tool.category === 'write' && tool.name !== 'file_delete') {
    const filePath = String(input.file_path || '');
    const fullPath = filePath.startsWith('/') ? filePath : `${homePath}/${filePath}`;

    try {
      let oldContent = '';
      const exists = await RNFS.exists(fullPath);
      if (exists) {
        try {
          const items = await RNFS.readDir(fullPath);
          return {
            toolCallId: toolCall.id,
            content: `路径是一个目录，无法写入文件: ${filePath}\n如需创建文件，请指定完整文件路径。`,
            isError: true,
          };
        } catch {
          oldContent = await RNFS.readFile(fullPath, 'utf8');
        }
      }

      const result = await tool.execute(input, context);

      if (!result.isError) {
        const newContent = String(input.content || '');
        if (oldContent !== newContent) {
          await diffService.recordDiff(fullPath, oldContent, newContent);
        }
      }

      return { ...result, toolCallId: toolCall.id };
    } catch (err: any) {
      return {
        toolCallId: toolCall.id,
        content: `执行失败: ${err.message}`,
        isError: true,
      };
    }
  }

  try {
    const result = await tool.execute(input, context);
    return { ...result, toolCallId: toolCall.id };
  } catch (err: any) {
    return {
      toolCallId: toolCall.id,
      content: `执行失败: ${err.message}`,
      isError: true,
    };
  }
}

export function needsConfirmation(toolCall: ToolCall): boolean {
  const registry = createDefaultRegistry();
  const tool = registry.get(toolCall.name);
  const result = tool?.requiresConfirmation ?? false;
  console.log('[LineCode] needsConfirmation check:', toolCall.name, '->', result, 'tool exists:', !!tool);
  return result;
}
