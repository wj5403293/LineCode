import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { storageAnalysisService } from '../src/services/StorageAnalysisService';

jest.mock('../src/services/ProjectService', () => ({
  projectService: {
    getCurrentHomePath: jest.fn(() => Promise.resolve('/tmp/lineai-test/home')),
    getLinecodeRoot: jest.fn(() => '/tmp/lineai-test/.linecode'),
  },
}));

jest.mock('../src/services/WorkspaceFileSystem', () => ({
  workspaceFs: {
    getDirStats: jest.fn(() => Promise.resolve({ bytes: 11, files: 1, directories: 0 })),
  },
}));

function setPlatform(os: string) {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => os,
  });
}

describe('StorageAnalysisService', () => {
  afterEach(() => {
    setPlatform('ios');
    delete NativeModules.DataArchive;
    jest.clearAllMocks();
    return AsyncStorage.clear();
  });

  it('uses native AsyncStorage size metadata on Android instead of reading values', async () => {
    setPlatform('android');
    NativeModules.DataArchive = {
      getAsyncStorageEntrySizes: jest.fn(() => Promise.resolve([
        { key: '@linecode_diffs', bytes: 7 },
        { key: '@lineai_conv_1', bytes: 13 },
        { key: '@lineai_model_settings', bytes: 5 },
        { key: 'external_key', bytes: 99 },
      ])),
    };

    const analysis = await storageAnalysisService.analyze();

    expect(NativeModules.DataArchive.getAsyncStorageEntrySizes).toHaveBeenCalled();
    expect(AsyncStorage.multiGet).not.toHaveBeenCalled();
    expect(analysis.categories.find(category => category.id === 'diffs')).toMatchObject({ bytes: 7, items: 1 });
    expect(analysis.categories.find(category => category.id === 'chats')).toMatchObject({ bytes: 13, items: 1 });
    expect(analysis.categories.find(category => category.id === 'config')).toMatchObject({ bytes: 5, items: 1 });
  });

  it('does not read values on Android when the native size API is unavailable', async () => {
    setPlatform('android');
    await AsyncStorage.setItem('@lineai_conv_1', 'large value');
    await AsyncStorage.setItem('@linecode_diffs', 'diff value');

    const analysis = await storageAnalysisService.analyze();

    expect(AsyncStorage.getAllKeys).toHaveBeenCalled();
    expect(AsyncStorage.multiGet).not.toHaveBeenCalled();
    expect(analysis.categories.find(category => category.id === 'chats')).toMatchObject({ bytes: 0, items: 1 });
    expect(analysis.categories.find(category => category.id === 'diffs')).toMatchObject({ bytes: 0, items: 1 });
  });
});
