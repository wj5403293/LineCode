import RNFS from 'react-native-fs';
import {
  exists as safExists,
  listFiles as safListFiles,
  mkdir as safMkdir,
  readFile as safReadFile,
  rename as safRename,
  stat as safStat,
  unlink as safUnlink,
  writeFile as safWriteFile,
} from 'react-native-saf-x';

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

export function isSafPath(path: string): boolean {
  return path.startsWith('content://');
}

function trimTrailingSlash(path: string): string {
  return path.replace(/\/+$/, '');
}

function trimLeadingSlash(path: string): string {
  return path.replace(/^\/+/, '');
}

function dirname(path: string): string {
  const cleanPath = trimTrailingSlash(path);
  const index = cleanPath.lastIndexOf('/');
  return index > 0 ? cleanPath.slice(0, index) : '';
}

function safeDecodeUriPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    try {
      return decodeURI(value);
    } catch {
      return value;
    }
  }
}

function stripUriSuffix(value: string): string {
  return value.split(/[?#]/)[0];
}

function extractSafDocumentId(uri: string): string | null {
  const cleanUri = stripUriSuffix(uri);
  const documentMarker = '/document/';
  const documentIndex = cleanUri.indexOf(documentMarker);
  if (documentIndex >= 0) {
    return cleanUri.slice(documentIndex + documentMarker.length);
  }

  const treeMarker = '/tree/';
  const treeIndex = cleanUri.indexOf(treeMarker);
  if (treeIndex >= 0) {
    return cleanUri.slice(treeIndex + treeMarker.length);
  }

  return null;
}

function joinAbsolutePath(root: string, rest: string): string {
  const cleanRest = rest.replace(/^\/+/, '');
  return cleanRest ? `${root}/${cleanRest}` : root;
}

export function safUriToFileSystemPath(uri: string): string | null {
  if (!isSafPath(uri)) return null;

  const documentId = extractSafDocumentId(uri);
  if (!documentId) return null;

  const decodedDocumentId = safeDecodeUriPart(documentId).replace(/^\/+/, '');
  if (decodedDocumentId.startsWith('raw:')) {
    const rawPath = decodedDocumentId.slice('raw:'.length);
    return rawPath.startsWith('/') ? rawPath : null;
  }

  const separatorIndex = decodedDocumentId.indexOf(':');
  if (separatorIndex < 0) return null;

  const volume = decodedDocumentId.slice(0, separatorIndex);
  const rest = decodedDocumentId.slice(separatorIndex + 1);

  if (volume === 'primary') {
    return joinAbsolutePath('/storage/emulated/0', rest);
  }

  if (volume === 'home') {
    return joinAbsolutePath('/storage/emulated/0/Documents', rest);
  }

  if (/^[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}$/.test(volume)) {
    return joinAbsolutePath(`/storage/${volume}`, rest);
  }

  return null;
}

export function toDisplayPath(path: string): string {
  return safUriToFileSystemPath(path) || path;
}

export function toShellPath(path: string): string | null {
  if (isSafPath(path)) {
    return safUriToFileSystemPath(path);
  }
  return path.startsWith('/') ? path : null;
}

export function joinWorkspacePath(rootPath: string, childPath: string): string {
  if (!childPath) return rootPath;
  if (childPath.startsWith('/') || isSafPath(childPath)) return childPath;
  return `${trimTrailingSlash(rootPath)}/${trimLeadingSlash(childPath)}`;
}

export function basename(path: string): string {
  const cleanPath = trimTrailingSlash(toDisplayPath(path));
  return cleanPath.split('/').filter(Boolean).pop() || cleanPath;
}

async function isDirectoryPath(path: string): Promise<boolean> {
  if (isSafPath(path)) {
    const info = await safStat(path);
    return info.type === 'directory';
  }
  const stat = await RNFS.stat(path);
  return stat.isDirectory();
}

async function ensureParentDir(filePath: string): Promise<void> {
  const parent = dirname(filePath);
  if (!parent) return;
  await workspaceFs.mkdir(parent);
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
  isSafPath,
  safUriToFileSystemPath,
  toDisplayPath,
  toShellPath,

  resolvePath(path: string, rootPath: string): string {
    return joinWorkspacePath(rootPath, path);
  },

  async exists(path: string): Promise<boolean> {
    if (isSafPath(path)) return safExists(path);
    return RNFS.exists(path);
  },

  async readDir(path: string): Promise<WorkspaceFileItem[]> {
    if (isSafPath(path)) {
      const items = await safListFiles(path);
      return items.map(item => ({
        name: item.name,
        path: item.uri,
        size: item.size,
        isDirectory: () => item.type === 'directory',
      }));
    }

    const items = await RNFS.readDir(path);
    return items.map(item => ({
      name: item.name,
      path: item.path,
      size: item.size,
      isDirectory: () => item.isDirectory(),
    }));
  },

  async readFile(path: string): Promise<string> {
    if (isSafPath(path)) return safReadFile(path, { encoding: 'utf8' });
    return RNFS.readFile(path, 'utf8');
  },

  async writeFile(path: string, content: string): Promise<void> {
    await ensureParentDir(path);
    if (isSafPath(path)) {
      await safWriteFile(path, content, { encoding: 'utf8', mimeType: 'text/plain' });
      return;
    }
    await RNFS.writeFile(path, content, 'utf8');
  },

  async mkdir(path: string): Promise<void> {
    if (isSafPath(path)) {
      await safMkdir(path);
      return;
    }
    await RNFS.mkdir(path, { NSURLIsExcludedFromBackupKey: true });
  },

  async unlink(path: string): Promise<void> {
    if (isSafPath(path)) {
      await safUnlink(path);
      return;
    }
    await RNFS.unlink(path);
  },

  async rename(path: string, newName: string): Promise<string> {
    if (isSafPath(path)) {
      const renamed = await safRename(path, newName);
      return renamed.uri;
    }

    const parent = dirname(path);
    const nextPath = `${parent}/${newName}`;
    await RNFS.moveFile(path, nextPath);
    return nextPath;
  },

  async stat(path: string): Promise<WorkspaceStat> {
    if (isSafPath(path)) {
      const info = await safStat(path);
      return {
        size: info.size,
        isDirectory: () => info.type === 'directory',
      };
    }
    const stat = await RNFS.stat(path);
    return {
      size: Number(stat.size || 0),
      isDirectory: () => stat.isDirectory(),
    };
  },

  async isDirectory(path: string): Promise<boolean> {
    return isDirectoryPath(path);
  },

  async getDirStats(path: string, maxDepth = 24): Promise<DirectoryStats> {
    const exists = await workspaceFs.exists(path);
    if (!exists) return { bytes: 0, files: 0, directories: 0 };
    const stat = await workspaceFs.stat(path);
    if (!stat.isDirectory()) return { bytes: stat.size, files: 1, directories: 0 };
    return collectDirStats(path, 0, maxDepth);
  },
};
