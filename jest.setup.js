/* eslint-env jest */

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GestureHandlerRootView: ({ children, ...props }) => React.createElement(View, props, children),
  };
});

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    NavigationContainer: ({ children }) => React.createElement(React.Fragment, null, children),
    createNavigationContainerRef: () => ({
      isReady: () => false,
      navigate: jest.fn(),
    }),
    useFocusEffect: jest.fn((callback) => callback()),
  };
});

jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }) => React.createElement(React.Fragment, null, children),
      Screen: ({ children }) => {
        if (typeof children === 'function') {
          return children({
            navigation: {
              navigate: jest.fn(),
              goBack: jest.fn(),
            },
            route: { params: {} },
          });
        }
        return children;
      },
    }),
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-markdown-display', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ children }) => React.createElement(Text, null, children);
});

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
  getString: jest.fn(() => Promise.resolve('')),
}));

jest.mock('react-native-fs', () => ({
  TemporaryDirectoryPath: '/tmp/lineai-test',
  CachesDirectoryPath: '/tmp/lineai-test',
  DocumentDirectoryPath: '/tmp/lineai-test',
  exists: jest.fn(() => Promise.resolve(false)),
  stat: jest.fn(() => Promise.resolve({ isDirectory: () => true, size: 0 })),
  mkdir: jest.fn(() => Promise.resolve()),
  readDir: jest.fn(() => Promise.resolve([])),
  readFile: jest.fn(() => Promise.resolve('')),
  read: jest.fn(() => Promise.resolve('')),
  hash: jest.fn(() => Promise.resolve('')),
  writeFile: jest.fn(() => Promise.resolve()),
  moveFile: jest.fn(() => Promise.resolve()),
  copyFile: jest.fn(() => Promise.resolve()),
  unlink: jest.fn(() => Promise.resolve()),
  downloadFile: jest.fn(() => ({ promise: Promise.resolve({ statusCode: 200, bytesWritten: 0, jobId: 1 }) })),
}));

jest.mock('react-native-saf-x', () => ({
  copyFile: jest.fn(() => Promise.resolve()),
  createDocument: jest.fn(() => Promise.resolve({ uri: 'content://test/doc', name: 'test.log' })),
  openDocument: jest.fn(() => Promise.resolve([])),
  openDocumentTree: jest.fn(() => Promise.resolve(null)),
  getPersistedUriPermissions: jest.fn(() => Promise.resolve([])),
}));

jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    WebView: (props) => React.createElement(View, props),
  };
});

jest.mock('react-native-zip-archive', () => ({
  zipWithPassword: jest.fn(() => Promise.resolve()),
  unzip: jest.fn(() => Promise.resolve()),
  unzipWithPassword: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-quick-sqlite', () => ({
  open: jest.fn(() => ({
    execute: jest.fn(() => ({ rows: { _array: [] } })),
    executeAsync: jest.fn(() => Promise.resolve({ rows: { _array: [] } })),
    close: jest.fn(),
  })),
}), { virtual: true });

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaProvider: ({ children }) => React.createElement(React.Fragment, null, children),
    SafeAreaView: ({ children }) => React.createElement(React.Fragment, null, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

const { NativeModules } = require('react-native');

NativeModules.StoragePermission = {
  isManageExternalStorageGranted: jest.fn(() => Promise.resolve(true)),
  openManageExternalStorageSettings: jest.fn(() => Promise.resolve(true)),
};

NativeModules.AppLifecycle = {
  exitApp: jest.fn(() => Promise.resolve(null)),
};
