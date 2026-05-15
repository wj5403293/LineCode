import AsyncStorage from '@react-native-async-storage/async-storage';
import { Dimensions, NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';
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
type ReportOptions = {
  componentStack?: string;
  fatal?: boolean;
  notify?: boolean;
};
export interface CrashLogExport {
  path: string;
  fileName: string;
}

const STORAGE_KEY = '@linecode_error_reports';
const MAX_REPORTS = 20;
const CRASH_DIR = `${RNFS.DocumentDirectoryPath}/.linecode/crash`;
const LAST_CRASH_LOG_PATH = `${CRASH_DIR}/last-crash.log`;
const LAST_CRASH_JSON_PATH = `${CRASH_DIR}/last-crash.json`;
const LAST_NATIVE_CRASH_LOG_PATH = `${CRASH_DIR}/last-native-crash.log`;

class ErrorReporter {
  private listeners = new Set<Listener>();
  private originalConsoleError?: typeof console.error;
  private globalErrorHandler?: (error: Error, isFatal?: boolean) => void;
  private promiseRejectionHandler?: (event: any) => void;
  private promiseTrackerInstalled = false;
  private recentMessages = new Map<string, number>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  report(error: unknown, source: ErrorReport['source'], extra?: ReportOptions): ErrorReport {
    const report = this.createReportSafely(error, source, extra);
    this.persist(report).catch(() => {});
    if (extra?.notify !== false) {
      this.listeners.forEach(listener => {
        try {
          listener(report);
        } catch {
          // Error reporting must never become the source of another crash.
        }
      });
    }
    return report;
  }

  async getRecentReports(): Promise<ErrorReport[]> {
    const reports = await this.readRecentReports().catch(() => []);
    if (reports.length > 0) return reports;
    const fallback = await this.readLastCrashReport().catch(() => null);
    return fallback ? [fallback] : [];
  }

  async clearRecentReports(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    await Promise.all([
      this.unlinkIfExists(LAST_CRASH_LOG_PATH).catch(() => {}),
      this.unlinkIfExists(LAST_CRASH_JSON_PATH).catch(() => {}),
      this.unlinkIfExists(LAST_NATIVE_CRASH_LOG_PATH).catch(() => {}),
    ]);
  }

  async getLastCrashLogText(): Promise<string | null> {
    if (await RNFS.exists(LAST_CRASH_LOG_PATH)) {
      const text = await RNFS.readFile(LAST_CRASH_LOG_PATH, 'utf8');
      if (text.trim()) return text;
    }

    const recent = await this.readRecentReports().catch(() => []);
    if (recent[0]) return this.format(recent[0]);

    const fallback = await this.readLastCrashReport().catch(() => null);
    return fallback ? this.format(fallback) : null;
  }

  async exportLastCrashLog(): Promise<CrashLogExport> {
    const text = await this.getLastCrashLogText();
    if (!text) {
      throw new Error('暂无可导出的崩溃日志。');
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `linecode_last_crash_${stamp}.log`;
    const path = `${RNFS.DocumentDirectoryPath}/${fileName}`;
    await RNFS.writeFile(path, text, 'utf8');
    return { path, fileName };
  }

  install(): void {
    try {
      const errorUtils = (globalThis as any).ErrorUtils;
      if (!this.globalErrorHandler) {
        this.globalErrorHandler = (error: Error, isFatal?: boolean) => {
          this.report(error, 'global', { fatal: isFatal });
        };
      }
      if (errorUtils?.getGlobalHandler?.() !== this.globalErrorHandler) {
        errorUtils?.setGlobalHandler?.(this.globalErrorHandler);
      }
    } catch {
    }

    const globalAny = globalThis as any;
    if (!this.promiseRejectionHandler) {
      this.promiseRejectionHandler = (event: any) => {
        const reason = event?.reason ?? event;
        this.report(reason, 'promise');
      };
    }
    if (globalAny.onunhandledrejection !== this.promiseRejectionHandler) {
      globalAny.onunhandledrejection = this.promiseRejectionHandler;
    }

    try {
      const enablePromiseRejectionTracker = globalAny.HermesInternal?.enablePromiseRejectionTracker;
      if (!this.promiseTrackerInstalled && typeof enablePromiseRejectionTracker === 'function') {
        enablePromiseRejectionTracker({
          allRejections: true,
          onUnhandled: (_id: number, rejection: unknown) => {
            this.report(rejection, 'promise');
          },
        });
        this.promiseTrackerInstalled = true;
      }
    } catch {
    }

    try {
      this.installConsoleCapture();
    } catch {
    }
  }

  format(report: ErrorReport): string {
    const deviceInfo = Object.entries(report.device || {})
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
    extra?: ReportOptions,
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

  private createReportSafely(
    error: unknown,
    source: ErrorReport['source'],
    extra?: ReportOptions,
  ): ErrorReport {
    try {
      return this.createReport(error, source, extra);
    } catch (reporterError) {
      const err = this.normalizeError(error);
      const reporter = this.normalizeError(reporterError);
      return {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        source,
        message: err.message || 'Unknown error',
        name: err.name || 'Error',
        stack: [
          err.stack,
          `ErrorReporter failure: ${reporter.name || 'Error'}: ${reporter.message}`,
          reporter.stack,
        ].filter(Boolean).join('\n\n'),
        componentStack: extra?.componentStack,
        fatal: extra?.fatal,
        timestamp: Date.now(),
        device: {
          appName: APP_NAME,
          appVersion: APP_VERSION,
          platform: Platform.OS,
        },
      };
    }
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
      const report = this.createReportSafely(candidate, 'console', { fatal: false });
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
    await Promise.all([
      this.persistLastCrashLog(report).catch(() => {}),
      this.persistRecentReport(report).catch(() => {}),
    ]);
  }

  private async persistRecentReport(report: ErrorReport): Promise<void> {
    let reports: ErrorReport[] = [];
    try {
      reports = await this.readRecentReports();
    } catch {
    }
    reports.unshift(report);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reports.slice(0, MAX_REPORTS)));
  }

  private async persistLastCrashLog(report: ErrorReport): Promise<void> {
    await RNFS.mkdir(CRASH_DIR);
    await RNFS.writeFile(LAST_CRASH_LOG_PATH, this.format(report), 'utf8');
    await RNFS.writeFile(LAST_CRASH_JSON_PATH, JSON.stringify(report, null, 2), 'utf8');
  }

  private async readRecentReports(): Promise<ErrorReport[]> {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(value => this.isErrorReport(value))
      : [];
  }

  private async readLastCrashReport(): Promise<ErrorReport | null> {
    if (await RNFS.exists(LAST_CRASH_JSON_PATH)) {
      try {
        const parsed = JSON.parse(await RNFS.readFile(LAST_CRASH_JSON_PATH, 'utf8')) as unknown;
        if (this.isErrorReport(parsed)) return parsed;
      } catch {
      }
    }

    if (await RNFS.exists(LAST_CRASH_LOG_PATH)) {
      const text = await RNFS.readFile(LAST_CRASH_LOG_PATH, 'utf8');
      if (text.trim()) return this.createReportFromLog(text);
    }

    return null;
  }

  private async unlinkIfExists(path: string): Promise<void> {
    if (await RNFS.exists(path)) {
      await RNFS.unlink(path);
    }
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
        message: typeof value.message === 'string' ? value.message : this.safeStringify(error),
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

  private createReportFromLog(text: string): ErrorReport {
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    const errorIndex = lines.findIndex(line => line === 'Error');
    const message = lines[errorIndex + 1]
      || lines.find(line => /error|exception|fatal/i.test(line))
      || 'Native crash log';
    const timeLine = lines.find(line => line.startsWith('time:'));
    const parsedTime = timeLine ? Date.parse(timeLine.slice(5).trim()) : NaN;

    return {
      id: `crash_log_${Number.isFinite(parsedTime) ? parsedTime : Date.now()}`,
      source: 'global',
      message,
      name: 'CrashLog',
      stack: text,
      fatal: true,
      timestamp: Number.isFinite(parsedTime) ? parsedTime : Date.now(),
      device: this.getDeviceInfo(),
    };
  }

  private isErrorReport(value: unknown): value is ErrorReport {
    if (!value || typeof value !== 'object') return false;
    const report = value as Partial<ErrorReport>;
    return typeof report.id === 'string'
      && typeof report.message === 'string'
      && typeof report.timestamp === 'number'
      && ['react', 'global', 'promise', 'console'].includes(String(report.source));
  }

  private safeStringify(value: unknown): string {
    try {
      const json = JSON.stringify(value);
      return json === undefined ? String(value) : json;
    } catch {
      return Object.prototype.toString.call(value);
    }
  }
}

export const errorReporter = new ErrorReporter();
