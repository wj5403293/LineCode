import { safTreeUriToFileSystemPath } from '../src/services/AndroidExternalStorage';
import {
  basename,
  createWorkspaceAccessPolicy,
  isPathAllowedByPolicy,
  joinWorkspacePath,
  parentPath,
  relativeWorkspacePath,
  resolveToolPath,
  toDisplayPath,
  toToolDisplayPath,
} from '../src/services/WorkspaceFileSystem';

describe('AndroidExternalStorage URI path conversion', () => {
  it('converts primary tree URIs to Android storage paths', () => {
    expect(
      safTreeUriToFileSystemPath('content://com.android.externalstorage.documents/tree/primary%3ADownload%2FLineCode'),
    ).toBe('/storage/emulated/0/Download/LineCode');
  });

  it('converts document URIs below a selected tree', () => {
    expect(
      safTreeUriToFileSystemPath(
        'content://com.android.externalstorage.documents/tree/primary%3ADownload%2FLineCode/document/primary%3ADownload%2FLineCode%2Fsrc%2FApp.tsx',
      ),
    ).toBe('/storage/emulated/0/Download/LineCode/src/App.tsx');
  });

  it('converts the Android downloads provider root', () => {
    expect(
      safTreeUriToFileSystemPath('content://com.android.providers.downloads.documents/tree/downloads'),
    ).toBe('/storage/emulated/0/Download');
  });

  it('rejects provider IDs that cannot be represented as file-system paths', () => {
    expect(
      safTreeUriToFileSystemPath('content://com.android.providers.downloads.documents/tree/msf%3A42'),
    ).toBeNull();
  });
});

describe('WorkspaceFileSystem local paths', () => {
  it('uses converted paths for basenames and display labels', () => {
    expect(basename('/storage/emulated/0/Download/LineCode')).toBe('LineCode');
    expect(toDisplayPath('file:///storage/emulated/0/Download/LineCode')).toBe('/storage/emulated/0/Download/LineCode');
  });

  it('resolves relative paths inside a normal workspace', () => {
    expect(
      joinWorkspacePath('/storage/emulated/0/Download/LineCode', 'src/App.tsx'),
    ).toBe('/storage/emulated/0/Download/LineCode/src/App.tsx');
  });

  it('keeps absolute child paths unchanged', () => {
    expect(
      joinWorkspacePath('/storage/emulated/0/Download/LineCode', '/storage/emulated/0/Documents/Other/App.tsx'),
    ).toBe('/storage/emulated/0/Documents/Other/App.tsx');
  });

  it('computes relative tool paths below the workspace root', () => {
    expect(
      relativeWorkspacePath(
        '/storage/emulated/0/Download/LineCode/src/App.tsx',
        '/storage/emulated/0/Download/LineCode',
      ),
    ).toBe('src/App.tsx');
    expect(
      toToolDisplayPath(
        '/storage/emulated/0/Download/LineCode',
        '/storage/emulated/0/Download/LineCode',
      ),
    ).toBe('当前工作目录');
  });

  it('computes parent file-system paths', () => {
    expect(parentPath('/storage/emulated/0/Download/LineCode/src/App.tsx')).toBe('/storage/emulated/0/Download/LineCode/src');
  });

  it('allows explicitly whitelisted app-private read roots', () => {
    const policy = createWorkspaceAccessPolicy({
      homePath: '/storage/emulated/0/Download/LineCode',
      extraReadRoots: ['/data/user/0/com.linecode/files/.linecode/skills'],
    });

    expect(
      isPathAllowedByPolicy(
        '/data/user/0/com.linecode/files/.linecode/skills/debugging/SKILL.md',
        policy,
        'read',
      ),
    ).toBe(true);
  });

  it('rejects arbitrary absolute paths outside the access policy', () => {
    const policy = createWorkspaceAccessPolicy({
      homePath: '/storage/emulated/0/Download/LineCode',
      extraReadRoots: ['/data/user/0/com.linecode/files/.linecode/skills'],
    });

    expect(isPathAllowedByPolicy('/data/user/0/com.other.app/files/token.txt', policy, 'read')).toBe(false);
    expect(() => resolveToolPath('/data/user/0/com.other.app/files/token.txt', policy, 'read')).toThrow('允许的读取范围');
  });

  it('keeps app-private roots read-only unless write roots are explicit', () => {
    const policy = createWorkspaceAccessPolicy({
      homePath: '/workspace/project',
      extraReadRoots: ['/app/private/.linecode/skills'],
    });

    expect(resolveToolPath('src/App.tsx', policy, 'write')).toBe('/workspace/project/src/App.tsx');
    expect(isPathAllowedByPolicy('/app/private/.linecode/skills/demo/SKILL.md', policy, 'write')).toBe(false);
  });
});
