import { requestStartupExternalStoragePermission } from '../App';

jest.mock('../src/services/AndroidExternalStorage', () => ({
  androidExternalStorage: {
    ensureManageExternalStorageGranted: jest.fn(() => Promise.resolve()),
  },
}));

import { androidExternalStorage } from '../src/services/AndroidExternalStorage';

describe('startup external storage permission request', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests external storage permission synchronously when app starts', () => {
    requestStartupExternalStoragePermission();

    expect(androidExternalStorage.ensureManageExternalStorageGranted).toHaveBeenCalledTimes(1);
  });
});
