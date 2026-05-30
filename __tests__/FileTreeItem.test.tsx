import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import FileTreeItem from '../src/components/FileTreeItem';
import { FileTreeNode } from '../src/hooks/useFileTree';

describe('FileTreeItem', () => {
  it('renders directory items when node names are missing', async () => {
    const node = {
      path: '/storage/emulated/0/Download/EmptyProject',
      isDirectory: true,
      expanded: true,
      children: [
        {
          path: '/storage/emulated/0/Download/EmptyProject/README.md',
          isDirectory: false,
        },
      ],
    } as FileTreeNode;

    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        <FileTreeItem
          node={node}
          depth={0}
          onExpand={jest.fn()}
          onSelect={jest.fn()}
          onDelete={jest.fn()}
          onRename={jest.fn()}
          onCreate={jest.fn()}
        />,
        { unstable_isConcurrent: false } as never,
      );
    });

    const labels = tree!.root.findAllByType(Text).map(item => item.props.children);

    expect(labels).toContain('EmptyProject');
    expect(labels).toContain('README.md');
  });
});
