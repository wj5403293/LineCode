import { basename, safUriToFileSystemPath, toDisplayPath } from '../src/services/WorkspaceFileSystem';

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
});
