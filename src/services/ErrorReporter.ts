import AsyncStorage from '@react-native-async-storage/async-storage';
import { Dimensions, NativeModules, Platform } from 'react-native';
import { APP_NAME, APP_VERSION } from '../constants/appInfo';

export interface ErrorReport {
  id: string;
  source: 'react' | 'global' | 'promise' | 'console';
  message: string;
  name?: string;
  stack?: string;
  componentStack?: string;
  fatal?: boolean;
  timestamp: number;
  device: Record<string, string | number | boolean | undefined>;
}

type Listener = (report: ErrorReport) => void;
const STORAGE_KEY = '@linecode_error_reports';
const MAX_REPORTS = 20;

class ErrorReporter {
  private listeners = new Set<Listener>();
  private installed = false;
  private originalGlobalHandler?: (error: Error, isFatal?: boolean) => void;
  private originalConsoleError?: typeof console.error;
  private recentMessages = new Map<string, number>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  report(error: unknown, source: ErrorReport['source'], extra?: { componentStack?: string; fatal?: boolean }): ErrorReport {
    const report = this.createReport(error, source, extra);
    this.persist(report).catch(() => {});
    this.listeners.forEach(listener => listener(report));
    return report;
  }

  async getRecentReports(): Promise<ErrorReport[]> {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) as ErrorReport[] : [];
  }

  async clearRecentReports(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  install(): void {
    if (this.installed) return;
    this.installed = true;

    const errorUtils = (globalThis as any).ErrorUtils;
    this.originalGlobalHandler = errorUtils?.getGlobalHandler?.();
    errorUtils?.setGlobalHandler?.((error: Error, isFatal?: boolean) => {
      this.report(error, 'global', { fatal: isFatal });
      this.originalGlobalHandler?.(error, isFatal);
    });

    const globalAny = globalThis as any;
    const previousUnhandledRejection = globalAny.onunhandledrejection;
    globalAny.onunhandledrejection = (event: any) => {
      const reason = event?.reason ?? event;
      this.report(reason, 'promise');
      previousUnhandledRejection?.(event);
    };

    globalAny.HermesInternal?.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (_id: number, rejection: unknown) => {
        this.report(rejection, 'promise');
      },
    });

    this.installConsoleCapture();
  }

  format(report: ErrorReport): string {
    const deviceInfo = Object.entries(report.device)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join('\n');

    return [
      `${APP_NAME} crash report`,
      `id: ${report.id}`,
      `time: ${new Date(report.timestamp).toISOString()}`,
      `source: ${report.source}`,
      `fatal: ${String(report.fatal ?? false)}`,
      '',
      'Device',
      deviceInfo,
      '',
      'Error',
      `${report.name || 'Error'}: ${report.message}`,
      report.stack || '',
      report.componentStack ? `\nComponent stack\n${report.componentStack}` : '',
    ].filter(Boolean).join('\n');
  }

  private createReport(
    error: unknown,
    source: ErrorReport['source'],
    extra?: { componentStack?: string; fatal?: boolean },
  ): ErrorReport {
    const err = this.normalizeError(error);
    return {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      source,
      message: err.message,
      name: err.name,
      stack: err.stack,
      componentStack: extra?.componentStack,
      fatal: extra?.fatal,
      timestamp: Date.now(),
      device: this.getDeviceInfo(),
    };
  }

  private installConsoleCapture(): void {
    if (this.originalConsoleError) return;
    if ((globalThis as any).__DEV__) return;
    this.originalConsoleError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      this.originalConsoleError?.(...args);
      if (args.some(arg => this.looksLikeFrameworkNoise(arg))) return;
      const candidate = args.find(arg => arg instanceof Error) ?? args.find(arg => typeof arg === 'object') ?? args.join(' ');
      const message = this.normalizeError(candidate).message;
      if (!message || this.isDuplicate(message)) return;
      const report = this.createReport(candidate, 'console', { fatal: false });
      this.persist(report).catch(() => {});
    };
  }

  private looksLikeFrameworkNoise(value: unknown): boolean {
    const text = typeof value === 'string' ? value : '';
    return text.includes('Warning:') || text.includes('Require cycle:');
  }

  private isDuplicate(message: string): boolean {
    const now = Date.now();
    const last = this.recentMessages.get(message) || 0;
    this.recentMessages.set(message, now);
    return now - last < 1500;
  }

  private async persist(report: ErrorReport): Promise<void> {
    const reports = await this.getRecentReports();
    reports.unshift(report);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reports.slice(0, MAX_REPORTS)));
  }

  private normalizeError(error: unknown): { name?: string; message: string; stack?: string } {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    if (typeof error === 'object' && error !== null) {
      const value = error as { name?: unknown; message?: unknown; stack?: unknown };
      return {
        name: typeof value.name === 'string' ? value.name : 'Error',
        message: typeof value.message === 'string' ? value.message : JSON.stringify(error),
        stack: typeof value.stack === 'string' ? value.stack : undefined,
      };
    }
    return {
      name: 'Error',
      message: String(error),
    };
  }

  private getDeviceInfo(): ErrorReport['device'] {
    const window = Dimensions.get('window');
    const constants = Platform.constants as Record<string, unknown>;
    return {
      appName: APP_NAME,
      appVersion: APP_VERSION,
      platform: Platform.OS,
      platformVersion: String(Platform.Version),
      isPad: constants.interfaceIdiom === 'pad',
      brand: String(constants.Brand || constants.brand || ''),
      model: String(constants.Model || constants.model || ''),
      manufacturer: String(constants.Manufacturer || constants.manufacturer || ''),
      uiMode: String(constants.uiMode || ''),
      screen: `${Math.round(window.width)}x${Math.round(window.height)} @${window.scale}`,
      hermes: !!(globalThis as any).HermesInternal,
      nativeModules: Object.keys(NativeModules).length,
    };
  }
}

export const errorReporter = new ErrorReporter();
