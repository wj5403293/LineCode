import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { spacing, fontSizes, radius } from '../constants/theme';
import { ErrorReport, errorReporter } from '../services/ErrorReporter';
import type { ThemeColors } from '../theme/themes';
import { useTheme } from '../theme';

interface Props {
  children: React.ReactNode;
  label: string;
  resetKey?: string | number | boolean | null;
}

interface InnerProps extends Props {
  colors: ThemeColors;
}

interface State {
  error: Error | null;
  report: ErrorReport | null;
}

class RenderErrorBoundaryInner extends React.Component<InnerProps, State> {
  state: State = {
    error: null,
    report: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      error,
      report: null,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const report = errorReporter.report(error, 'react', {
      componentStack: info.componentStack || undefined,
      fatal: false,
      notify: false,
    });
    this.setState({ error, report });
  }

  componentDidUpdate(prevProps: InnerProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, report: null });
    }
  }

  render(): React.ReactNode {
    const { colors, children, label } = this.props;
    const { error, report } = this.state;

    if (!error && !report) return children;

    return (
      <View style={[styles.container, { backgroundColor: colors.dangerMuted, borderColor: colors.dangerMuted2 }]}>
        <AlertCircle size={16} color={colors.danger} />
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: colors.text }]}>{label}渲染失败</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={3}>
            {report?.name || error?.name || 'Error'}: {report?.message || error?.message || '未知错误'}
          </Text>
        </View>
      </View>
    );
  }
}

export default function RenderErrorBoundary(props: Props) {
  const { colors } = useTheme();
  return <RenderErrorBoundaryInner {...props} colors={colors} />;
}

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.xs,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  message: {
    fontSize: fontSizes.xs,
    lineHeight: 17,
    marginTop: 3,
  },
});
