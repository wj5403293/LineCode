import { ToolCategory } from '../types';

export type PermissionMode = 'readonly' | 'auto' | 'confirm';

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

const READONLY_TOOLS = new Set([
  'file_read', 'glob',
]);

const DANGEROUS_TOOLS = new Set([
  'file_delete',
  'shell_execute',
]);

export class PermissionService {
  private mode: PermissionMode = 'auto';

  getMode(): PermissionMode {
    return this.mode;
  }

  setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  canExecuteTool(toolName: string, category: ToolCategory): PermissionResult {
    if (this.mode === 'readonly' && category !== 'read') {
      return {
        allowed: false,
        reason: `只读模式下不允许执行 ${toolName}。请在权限设置中切换到读写或确认模式。`,
      };
    }
    return { allowed: true };
  }

  needsConfirmation(toolName: string): boolean {
    if (this.mode === 'auto') return false;
    if (this.mode === 'readonly') return false;
    if (DANGEROUS_TOOLS.has(toolName)) return true;
    return false;
  }
}

export const permissionService = new PermissionService();
