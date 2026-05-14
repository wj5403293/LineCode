import { workspaceFs } from '../../../services/WorkspaceFileSystem';

export function buildAgentWorkspacePrompt(homePath: string): string {
  if (!homePath) return '';

  const displayPath = workspaceFs.toDisplayPath(homePath);
  if (displayPath !== homePath) {
    return [
      '## 工作目录',
      `当前工作目录: ${displayPath}`,
      `SAF URI: ${homePath}`,
      '这是 Android SAF 外部目录。调用 file_read、glob、file_write、file_edit、file_delete 时优先传相对路径。',
      '不要把 /storage/... 展示路径当作普通 RNFS 路径；如果必须使用绝对路径，也只能使用当前工作目录内的路径。',
    ].join('\n');
  }

  return [
    '## 工作目录',
    `当前工作目录: ${displayPath}`,
    '所有本地文件工具默认相对此目录执行。',
  ].join('\n');
}
