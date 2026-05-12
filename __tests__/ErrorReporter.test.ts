describe('ErrorReporter', () => {
  const originalDev = (globalThis as any).__DEV__;
  const originalErrorUtils = (globalThis as any).ErrorUtils;

  afterEach(() => {
    (globalThis as any).__DEV__ = originalDev;
    (globalThis as any).ErrorUtils = originalErrorUtils;
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('delegates global errors to the original handler in production', () => {
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

    expect(originalGlobalHandler).toHaveBeenCalledWith(error, true);
  });
});
