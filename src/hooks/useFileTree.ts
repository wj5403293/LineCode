import { useState, useCallback } from 'react';
import RNFS from 'react-native-fs';

export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeNode[];
  expanded?: boolean;
}

export function useFileTree(rootPath: string) {
  const [tree, setTree] = useState<FileTreeNode | null>(null);
  const [loading, setLoading] = useState(false);

  const loadTree = useCallback(async (dirPath?: string): Promise<FileTreeNode> => {
    const path = dirPath || rootPath;
    try {
      const items = await RNFS.readDir(path);
      const children: FileTreeNode[] = [];

      for (const item of items.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      })) {
        const node: FileTreeNode = {
          name: item.name,
          path: item.path,
          isDirectory: item.isDirectory(),
        };
        children.push(node);
      }

      const node: FileTreeNode = {
        name: path.split('/').pop() || 'home',
        path,
        isDirectory: true,
        children,
        expanded: !dirPath, // root is always expanded
      };

      if (!dirPath) setTree(node);
      return node;
    } catch {
      const empty: FileTreeNode = { name: 'home', path, isDirectory: true, children: [], expanded: true };
      if (!dirPath) setTree(empty);
      return empty;
    }
  }, [rootPath]);

  const expandNode = useCallback(async (path: string) => {
    if (!tree) return;

    const updateNode = async (node: FileTreeNode): Promise<FileTreeNode> => {
      if (node.path === path) {
        if (!node.children || node.children.length === 0) {
          const loaded = await loadTree(path);
          return { ...node, children: loaded.children, expanded: true };
        }
        return { ...node, expanded: !node.expanded };
      }
      if (node.children) {
        return { ...node, children: await Promise.all(node.children.map(updateNode)) };
      }
      return node;
    };

    setTree(await updateNode(tree));
  }, [tree, loadTree]);

  const createItem = useCallback(async (parentPath: string, name: string, isDirectory: boolean) => {
    const fullPath = `${parentPath}/${name}`;
    if (isDirectory) {
      await RNFS.mkdir(fullPath);
    } else {
      await RNFS.writeFile(fullPath, '', 'utf8');
    }
    await loadTree();
  }, [loadTree]);

  const deleteItem = useCallback(async (path: string) => {
    await RNFS.unlink(path);
    await loadTree();
  }, [loadTree]);

  const renameItem = useCallback(async (oldPath: string, newName: string) => {
    const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const newPath = `${parentDir}/${newName}`;
    await RNFS.moveFile(oldPath, newPath);
    await loadTree();
  }, [loadTree]);

  return { tree, loading, loadTree, expandNode, createItem, deleteItem, renameItem };
}
