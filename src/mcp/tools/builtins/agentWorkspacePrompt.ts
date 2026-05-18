import { workspaceFs } from '../../../services/WorkspaceFileSystem';

export function buildAgentWorkspacePrompt(homePath: string): string {
  if (!homePath) return '';

  const displayPath = workspaceFs.toDisplayPath(homePath);
  return [
    '## 工作目录',
    `当前工作目录: ${displayPath}`,
    '所有本地文件工具默认相对此目录执行。',
  ].join('\n');
}
