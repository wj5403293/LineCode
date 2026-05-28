import RNFS from 'react-native-fs';

export interface WorkspaceFileItem {
  name: string;
  path: string;
  size?: number;
  isDirectory: () => boolean;
}

export interface WorkspaceStat {
  isDirectory: () => boolean;
  size: number;
}

export interface DirectoryStats {
  bytes: number;
  files: number;
  directories: number;
}

function trimTrailingSlash(path: string): string {
  return path.replace(/\/+$/, '');
}

function trimLeadingSlash(path: string): string {
  return path.replace(/^\/+/, '');
}

function stripFileScheme(path: string): string {
  return path.startsWith('file://') ? path.slice('file://'.length) : path;
}

function isContentUri(path: string): boolean {
  return path.startsWith('content://');
}

function assertFileSystemPath(path: string, action: string): void {
  if (isContentUri(path)) {
    throw new Error(`${action}失败: content:// URI 不能作为工作区路径，请重新选择外部目录并授予“管理所有文件”权限。`);
  }
}

function dirname(path: string): string {
  const cleanPath = trimTrailingSlash(stripFileScheme(path));
  const index = cleanPath.lastIndexOf('/');
  return index > 0 ? cleanPath.slice(0, index) : '';
}

function relativePathUnderRoot(path: string, root: string): string | null {
  const normalizedPath = trimTrailingSlash(stripFileScheme(path));
  const normalizedRoot = trimTrailingSlash(stripFileScheme(root));
  if (normalizedPath === normalizedRoot) return '';
  return normalizedPath.startsWith(`${normalizedRoot}/`)
    ? normalizedPath.slice(normalizedRoot.length + 1)
    : null;
}

export function toDisplayPath(path: string): string {
  return stripFileScheme(path);
}

export function toShellPath(path: string): string | null {
  const cleanPath = stripFileScheme(path);
  return cleanPath.startsWith('/') ? cleanPath : null;
}

export function joinWorkspacePath(rootPath: string, childPath: string): string {
  const root = trimTrailingSlash(stripFileScheme(rootPath));
  if (!childPath) return root;

  const child = stripFileScheme(childPath);
  if (child.startsWith('/') || isContentUri(child)) return child;
  return `${root}/${trimLeadingSlash(child)}`;
}

export function relativeWorkspacePath(path: string, rootPath: string): string | null {
  return relativePathUnderRoot(path, rootPath);
}

export function toToolDisplayPath(path: string, rootPath?: string): string {
  if (rootPath) {
    const relativePath = relativeWorkspacePath(path, rootPath);
    if (relativePath === '') return '当前工作目录';
    if (relativePath !== null) return relativePath;
  }
  return toDisplayPath(path);
}

export function basename(path: string): string {
  const cleanPath = trimTrailingSlash(toDisplayPath(path));
  return cleanPath.split('/').filter(Boolean).pop() || cleanPath;
}

export function parentPath(path: string): string {
  return dirname(path);
}

async function ensureParentDir(filePath: string): Promise<void> {
  const parent = parentPath(filePath);
  if (!parent) return;
  await workspaceFs.mkdir(parent);
}

function normalizeWorkspaceError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

async function collectDirStats(path: string, depth: number, maxDepth: number): Promise<DirectoryStats> {
  if (depth > maxDepth) return { bytes: 0, files: 0, directories: 0 };

  const items = await workspaceFs.readDir(path);
  const stats: DirectoryStats = { bytes: 0, files: 0, directories: depth === 0 ? 1 : 0 };

  for (const item of items) {
    if (item.isDirectory()) {
      stats.directories += 1;
      const child = await collectDirStats(item.path, depth + 1, maxDepth);
      stats.bytes += child.bytes;
      stats.files += child.files;
      stats.directories += child.directories;
    } else {
      stats.files += 1;
      stats.bytes += item.size || 0;
    }
  }

  return stats;
}

export const workspaceFs = {
  toDisplayPath,
  toShellPath,
  relativePath: relativeWorkspacePath,
  toToolDisplayPath,
  basename,
  parentPath,

  resolvePath(path: string, rootPath: string): string {
    return joinWorkspacePath(rootPath, path);
  },

  async exists(path: string): Promise<boolean> {
    assertFileSystemPath(path, '检查路径');
    return RNFS.exists(stripFileScheme(path));
  },

  async readDir(path: string): Promise<WorkspaceFileItem[]> {
    const filePath = stripFileScheme(path);
    assertFileSystemPath(filePath, '读取目录');
    const items = await RNFS.readDir(filePath).catch(err => {
      throw normalizeWorkspaceError(err);
    });
    return items.map(item => ({
      name: item.name,
      path: item.path,
      size: item.size,
      isDirectory: () => item.isDirectory(),
    }));
  },

  async readFile(path: string): Promise<string> {
    const filePath = stripFileScheme(path);
    assertFileSystemPath(filePath, '读取文件');
    return RNFS.readFile(filePath, 'utf8').catch(err => {
      throw normalizeWorkspaceError(err);
    });
  },

  async writeFile(path: string, content: string): Promise<void> {
    const filePath = stripFileScheme(path);
    assertFileSystemPath(filePath, '写入文件');
    await ensureParentDir(filePath);
    await RNFS.writeFile(filePath, content, 'utf8').catch(err => {
      throw normalizeWorkspaceError(err);
    });
  },

  async writeFileChunked(path: string, content: string, chunkSize = 32 * 1024): Promise<void> {
    const filePath = stripFileScheme(path);
    assertFileSystemPath(filePath, '写入文件');
    await ensureParentDir(filePath);
    const firstChunk = content.slice(0, chunkSize);
    await RNFS.writeFile(filePath, firstChunk, 'utf8').catch(err => {
      throw normalizeWorkspaceError(err);
    });
    for (let offset = chunkSize; offset < content.length; offset += chunkSize) {
      const chunk = content.slice(offset, offset + chunkSize);
      await RNFS.appendFile(filePath, chunk, 'utf8').catch(err => {
        throw normalizeWorkspaceError(err);
      });
    }
  },

  async mkdir(path: string): Promise<void> {
    const filePath = stripFileScheme(path);
    assertFileSystemPath(filePath, '创建目录');
    await RNFS.mkdir(filePath, { NSURLIsExcludedFromBackupKey: true }).catch(err => {
      throw normalizeWorkspaceError(err);
    });
  },

  async unlink(path: string): Promise<void> {
    const filePath = stripFileScheme(path);
    assertFileSystemPath(filePath, '删除文件');
    await RNFS.unlink(filePath).catch(err => {
      throw normalizeWorkspaceError(err);
    });
  },

  async rename(path: string, newName: string): Promise<string> {
    const filePath = stripFileScheme(path);
    assertFileSystemPath(filePath, '重命名');
    const parent = dirname(filePath);
    const nextPath = `${parent}/${newName}`;
    await RNFS.moveFile(filePath, nextPath).catch(err => {
      throw normalizeWorkspaceError(err);
    });
    return nextPath;
  },

  async stat(path: string): Promise<WorkspaceStat> {
    const filePath = stripFileScheme(path);
    assertFileSystemPath(filePath, '读取文件状态');
    const stat = await RNFS.stat(filePath).catch(err => {
      throw normalizeWorkspaceError(err);
    });
    return {
      size: Number(stat.size || 0),
      isDirectory: () => stat.isDirectory(),
    };
  },

  async isDirectory(path: string): Promise<boolean> {
    const stat = await workspaceFs.stat(path);
    return stat.isDirectory();
  },

  async getDirStats(path: string, maxDepth = 24): Promise<DirectoryStats> {
    const exists = await workspaceFs.exists(path);
    if (!exists) return { bytes: 0, files: 0, directories: 0 };
    const stat = await workspaceFs.stat(path);
    if (!stat.isDirectory()) return { bytes: stat.size, files: 1, directories: 0 };
    return collectDirStats(path, 0, maxDepth);
  },
};
