import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { androidExternalStorage } from '../src/services/AndroidExternalStorage';

describe('AndroidExternalStorage legacy runtime permissions', () => {
  const originalOS = Platform.OS;
  const originalVersion = Platform.Version;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    Object.defineProperty(Platform, 'Version', { value: 29, configurable: true });
    NativeModules.StoragePermission.isManageExternalStorageGranted.mockResolvedValue(false);
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
      [PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE]: PermissionsAndroid.RESULTS.GRANTED,
      [PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE]: PermissionsAndroid.RESULTS.GRANTED,
    } as any);
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    Object.defineProperty(Platform, 'Version', { value: originalVersion, configurable: true });
    jest.restoreAllMocks();
  });

  it('checks READ and WRITE runtime permissions on Android 10 instead of all-files access', async () => {
    await expect(androidExternalStorage.isManageExternalStorageGranted()).resolves.toBe(true);

    expect(PermissionsAndroid.check).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
    expect(PermissionsAndroid.check).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
    expect(NativeModules.StoragePermission.isManageExternalStorageGranted).not.toHaveBeenCalled();
  });

  it('requests READ and WRITE runtime permissions on Android 10 when opening external project access', async () => {
    (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);

    await expect(androidExternalStorage.ensureManageExternalStorageGranted()).resolves.toBeUndefined();

    expect(PermissionsAndroid.requestMultiple).toHaveBeenCalledWith([
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    ]);
    expect(NativeModules.StoragePermission.openManageExternalStorageSettings).not.toHaveBeenCalled();
  });

  it('uses legacy storage wording instead of all-files wording on Android 10 permission denial', async () => {
    (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
    (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
      [PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE]: PermissionsAndroid.RESULTS.DENIED,
      [PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE]: PermissionsAndroid.RESULTS.DENIED,
    });

    await expect(androidExternalStorage.ensureManageExternalStorageGranted())
      .rejects
      .toThrow('需要授予文件读写权限');
    expect(androidExternalStorage.getPermissionDeniedMessage()).toContain('缺少文件读写权限');
    expect(androidExternalStorage.getPermissionDeniedMessage()).not.toContain('管理所有文件');
  });
});
