import { ToolCall, ToolResult, ContentBlock } from '../types';
import { ToolContext } from './tools';
import { createDefaultRegistry } from './tools';
import { createRuntimeRegistry, isExtensionToolName } from './tools/runtimeRegistry';
import { diffService } from '../services/DiffService';
import { permissionService } from '../services/PermissionService';
import { projectService } from '../services/ProjectService';
import { workspaceFs } from '../services/WorkspaceFileSystem';

export async function getHomePath(): Promise<string> {
  return projectService.getCurrentHomePath();
}

export interface ExecuteToolOptions {
  onProgress?: (update: Partial<ContentBlock>) => void;
  onConfirm?: (toolCall: ToolCall) => Promise<boolean>;
}

export async function executeTool(
  toolCall: ToolCall,
  options?: ExecuteToolOptions,
): Promise<ToolResult> {
  const registry = await createRuntimeRegistry();
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
    toolCallId: toolCall.id,
    onProgress: options?.onProgress,
    onConfirm: options?.onConfirm,
  };

  if (tool.category === 'write' && tool.name !== 'file_delete') {
    const filePath = String(input.file_path || '');
    const fullPath = workspaceFs.resolvePath(filePath, homePath);

    try {
      let oldContent = '';
      const exists = await workspaceFs.exists(fullPath);
      if (exists) {
        try {
          const stat = await workspaceFs.stat(fullPath);
          if (!stat.isDirectory()) {
            oldContent = await workspaceFs.readFile(fullPath);
          } else {
            return {
              toolCallId: toolCall.id,
              content: `路径是一个目录，无法写入文件: ${filePath}\n如需创建文件，请指定完整文件路径。`,
              isError: true,
            };
          }
        } catch {
          return {
            toolCallId: toolCall.id,
            content: `无法读取原文件: ${filePath}`,
            isError: true,
          };
        }
      }

      const result = await tool.execute(input, context);

      if (!result.isError) {
        let newContent = '';
        try {
          newContent = await workspaceFs.readFile(fullPath);
        } catch {
          newContent = String(input.content || '');
        }
        if (oldContent !== newContent) {
          const diff = await diffService.recordDiff(fullPath, oldContent, newContent, exists);
          result.diffId = diff.id;
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
  if (isExtensionToolName(toolCall.name)) return false;
  const registry = createDefaultRegistry();
  const tool = registry.get(toolCall.name);
  const result = tool?.requiresConfirmation ?? false;
  console.log('[LineCode] needsConfirmation check:', toolCall.name, '->', result, 'tool exists:', !!tool);
  return result;
}
