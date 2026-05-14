import {
  basename,
  joinWorkspacePath,
  parentPath,
  safUriToFileSystemPath,
  toDisplayPath,
} from '../src/services/WorkspaceFileSystem';

describe('WorkspaceFileSystem SAF paths', () => {
  it('converts primary tree URIs to Android storage paths', () => {
    expect(safUriToFileSystemPath('content://com.android.externalstorage.documents/tree/primary%3ADownload%2FLineCode')).toBe('/storage/emulated/0/Download/LineCode');
  });

  it('converts document URIs below a selected tree', () => {
    expect(
      safUriToFileSystemPath(
        'content://com.android.externalstorage.documents/tree/primary%3ADownload%2FLineCode/document/primary%3ADownload%2FLineCode%2Fsrc%2FApp.tsx',
      ),
    ).toBe('/storage/emulated/0/Download/LineCode/src/App.tsx');
  });

  it('converts denormalized SAF URIs returned by file listing', () => {
    expect(toDisplayPath('content://com.android.externalstorage.documents/tree/1707-3F0B:joplin/locks')).toBe('/storage/1707-3F0B/joplin/locks');
  });

  it('uses converted paths for basenames', () => {
    expect(basename('content://com.android.externalstorage.documents/tree/primary%3ADownload%2FLineCode')).toBe('LineCode');
  });

  it('resolves relative paths inside a SAF workspace', () => {
    expect(
      joinWorkspacePath(
        'content://com.android.externalstorage.documents/tree/primary%3ADownload%2FLineCode',
        'src/App.tsx',
      ),
    ).toBe('content://com.android.externalstorage.documents/tree/primary%3ADownload%2FLineCode/src/App.tsx');
  });

  it('maps displayed Android storage paths back into the SAF workspace', () => {
    expect(
      joinWorkspacePath(
        'content://com.android.externalstorage.documents/tree/primary%3ADownload%2FLineCode',
        '/storage/emulated/0/Download/LineCode/src/App.tsx',
      ),
    ).toBe('content://com.android.externalstorage.documents/tree/primary%3ADownload%2FLineCode/src/App.tsx');
  });

  it('leaves absolute paths outside the SAF workspace as file-system paths', () => {
    expect(
      joinWorkspacePath(
        'content://com.android.externalstorage.documents/tree/primary%3ADownload%2FLineCode',
        '/storage/emulated/0/Documents/Other/App.tsx',
      ),
    ).toBe('/storage/emulated/0/Documents/Other/App.tsx');
  });

  it('computes parent SAF paths without corrupting the URI authority', () => {
    expect(
      parentPath('content://com.android.externalstorage.documents/tree/primary%3ADownload%2FLineCode/src/App.tsx'),
    ).toBe('content://com.android.externalstorage.documents/tree/primary%3ADownload%2FLineCode%2Fsrc');
  });
});
