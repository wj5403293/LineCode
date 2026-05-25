import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { getPersistedUriPermissions, openDocumentTree } from 'react-native-saf-x';
import { projectService } from '../src/services/ProjectService';

describe('ProjectService external project picker', () => {
  const originalOS = Platform.OS;

  beforeEach(async () => {
    await AsyncStorage.clear();
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    (openDocumentTree as jest.Mock).mockResolvedValue({
      uri: 'content://com.android.externalstorage.documents/tree/primary%3ADownload%2FLineCode',
      name: 'LineCode',
      type: 'directory',
      lastModified: 0,
      mime: 'vnd.android.document/directory',
      size: 0,
    });
    (getPersistedUriPermissions as jest.Mock).mockResolvedValue([]);
    (RNFS.exists as jest.Mock).mockImplementation((path: string) => (
      Promise.resolve(path === '/storage/emulated/0/Download/LineCode' || path === '/storage/emulated/0/myfack')
    ));
    (RNFS.stat as jest.Mock).mockResolvedValue({
      isDirectory: () => true,
      size: 0,
    });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    jest.clearAllMocks();
  });

  it('requests persisted SAF tree permissions before converting the URI to a filesystem path', async () => {
    const project = await projectService.openExternalProject();

    expect(openDocumentTree).toHaveBeenCalledWith(true);
    expect(project?.path).toBe('/storage/emulated/0/Download/LineCode');
    expect(project?.source).toBe('external');
  });

  it('recovers the picked URI from persisted permissions when openDocumentTree rejects with Unsupported uri', async () => {
    const persistedUri = 'content://com.android.externalstorage.documents/tree/primary%3Amyfack';
    (getPersistedUriPermissions as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([persistedUri]);
    (openDocumentTree as jest.Mock).mockRejectedValueOnce(new Error(`Unsupported uri: ${persistedUri}`));

    const project = await projectService.openExternalProject();

    expect(project?.path).toBe('/storage/emulated/0/myfack');
    expect(project?.source).toBe('external');
  });

  it('falls back to extracting the URI from the error message when persisted list is unchanged', async () => {
    const errorUri = 'content://com.android.externalstorage.documents/tree/primary%3Amyfack';
    (getPersistedUriPermissions as jest.Mock).mockResolvedValue([]);
    (openDocumentTree as jest.Mock).mockRejectedValueOnce(new Error(`Unsupported uri: ${errorUri}`));

    const project = await projectService.openExternalProject();

    expect(project?.path).toBe('/storage/emulated/0/myfack');
  });
});
