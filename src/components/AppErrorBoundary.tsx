import React from 'react';
import { ErrorReport, errorReporter } from '../services/ErrorReporter';

interface Props {
  children: React.ReactNode;
  onError: (report: ErrorReport) => void;
}

export default class AppErrorBoundary extends React.Component<Props> {
  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const report = errorReporter.report(error, 'react', { componentStack: info.componentStack || undefined });
    this.props.onError(report);
  }

  render(): React.ReactNode {
    return this.props.children;
  }
}
