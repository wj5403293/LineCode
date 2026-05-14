describe('ErrorReporter', () => {
  const originalDev = (globalThis as any).__DEV__;
  const originalErrorUtils = (globalThis as any).ErrorUtils;
  const originalUnhandledRejection = (globalThis as any).onunhandledrejection;

  afterEach(() => {
    (globalThis as any).__DEV__ = originalDev;
    (globalThis as any).ErrorUtils = originalErrorUtils;
    (globalThis as any).onunhandledrejection = originalUnhandledRejection;
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.clear();
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('captures global errors without delegating to the original crash handler', () => {
    const originalGlobalHandler = jest.fn();
    const setGlobalHandler = jest.fn();

    (globalThis as any).__DEV__ = false;
    (globalThis as any).ErrorUtils = {
      getGlobalHandler: jest.fn(() => originalGlobalHandler),
      setGlobalHandler,
    };

    jest.isolateModules(() => {
      const { errorReporter } = require('../src/services/ErrorReporter');
      errorReporter.install();
    });

    const installedHandler = setGlobalHandler.mock.calls[0][0];
    const error = new Error('fatal production error');
    installedHandler(error, true);

    expect(originalGlobalHandler).not.toHaveBeenCalled();
  });

  it('captures unhandled rejections without delegating to the previous handler', () => {
    const previousUnhandledRejection = jest.fn();
    (globalThis as any).onunhandledrejection = previousUnhandledRejection;

    jest.isolateModules(() => {
      const { errorReporter } = require('../src/services/ErrorReporter');
      const listener = jest.fn();
      errorReporter.subscribe(listener);
      errorReporter.install();

      const error = new Error('promise failure');
      (globalThis as any).onunhandledrejection({ reason: error });

      expect(previousUnhandledRejection).not.toHaveBeenCalled();
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        source: 'promise',
        message: 'promise failure',
      }));
    });
  });

  it('persists recent reports for post-crash inspection', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const { errorReporter } = require('../src/services/ErrorReporter');

    const report = errorReporter.report(new Error('stored error'), 'global');
    await new Promise<void>(resolve => setImmediate(() => resolve()));

    const json = await AsyncStorage.getItem('@linecode_error_reports');
    const reports = JSON.parse(json);
    expect(reports[0].id).toBe(report.id);
    expect(reports[0].message).toBe('stored error');
  });
});
