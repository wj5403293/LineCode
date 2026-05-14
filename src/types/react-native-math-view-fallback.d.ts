declare module 'react-native-math-view/src/fallback/SvgXml' {
  import type React from 'react';
  import type { StyleProp, TextStyle, ViewProps, ViewStyle } from 'react-native';

  export interface MathViewProps extends ViewProps {
    math: string;
    color?: string;
    resizeMode?: 'cover' | 'contain';
    config?: Record<string, unknown>;
    style?: StyleProp<ViewStyle & Pick<TextStyle, 'color'>>;
    renderError?: React.ComponentType<any> | React.ReactElement;
    onError?: (error: Error) => void;
    debug?: boolean;
  }

  const MathView: React.ComponentType<MathViewProps>;
  export default MathView;
}
