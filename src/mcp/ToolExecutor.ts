import RNFS from 'react-native-fs';
import { ToolCall, ToolResult } from '../types';
import { createDefaultRegistry, ToolContext } from './tools';
import { diffService } from '../services/DiffService';

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

export async function executeTool(toolCall: ToolCall): Promise<ToolResult> {
  const registry = createDefaultRegistry();
  const tool = registry.get(toolCall.name);

  if (!tool) {
    return {
      toolCallId: toolCall.id,
      content: `未知工具: ${toolCall.name}`,
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
  const context: ToolContext = { homePath };

  // 对写入操作，先备份旧内容用于 diff
  if (tool.category === 'write') {
    const filePath = String(input.file_path || '');
    const fullPath = filePath.startsWith('/') ? filePath : `${homePath}/${filePath}`;

    try {
      let oldContent = '';
      const exists = await RNFS.exists(fullPath);
      if (exists) {
        oldContent = await RNFS.readFile(fullPath, 'utf8');
      }

      const result = await tool.execute(input, context);

      // 记录 diff
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

  // 读取操作直接执行
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
  return tool?.requiresConfirmation ?? false;
}
