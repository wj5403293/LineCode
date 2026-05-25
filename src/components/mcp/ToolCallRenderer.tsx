import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { isReadTool, isWriteTool, isDeleteTool, isHttpTool, isShellTool } from '../../mcp/toolUtils';
import { useTheme } from '../../theme';
import ToolCallRead from './ToolCallRead';
import ToolCallWrite from './ToolCallWrite';
import ToolCallDelete from './ToolCallDelete';
import ToolCallHttpServer from './ToolCallHttpServer';
import ToolCallShell from './ToolCallShell';

interface ToolCallRendererProps {
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  toolCallId?: string;
  diffId?: string;
  reviewState?: 'accepted' | 'rejected';
  homePath?: string;
  streaming?: boolean;
  streamingOutput?: string;
  onReview?: (toolCallId: string, state: 'accepted' | 'rejected', diffId?: string) => void;
}

export const ToolCallRenderer = React.memo(function ToolCallRenderer({
  name,
  input,
  result,
  isError,
  toolCallId,
  diffId,
  reviewState,
  homePath,
  streaming,
  streamingOutput,
  onReview,
}: ToolCallRendererProps) {
  const { colors } = useTheme();

  if (isReadTool(name)) {
    return (
      <ToolCallRead
        name={name}
        input={input}
        result={result}
        isError={isError}
      />
    );
  }

  if (isWriteTool(name)) {
    return (
      <ToolCallWrite
        name={name}
        input={input}
        result={result}
        isError={isError}
        toolCallId={toolCallId || diffId || name}
        diffId={diffId}
        reviewState={reviewState}
        homePath={homePath || ''}
        streaming={streaming || false}
        onReview={onReview}
      />
    );
  }

  if (isDeleteTool(name)) {
    return (
      <ToolCallDelete
        input={input}
        result={result}
        isError={isError}
      />
    );
  }

  if (isHttpTool(name)) {
    return (
      <ToolCallHttpServer
        input={input}
        result={result}
        isError={isError}
      />
    );
  }

  if (isShellTool(name)) {
    return (
      <ToolCallShell
        input={input}
        result={result}
        isError={isError}
        streaming={streaming}
        streamingOutput={streamingOutput}
      />
    );
  }

  return (
    <View style={[styles.toolCallItem, { backgroundColor: colors.codeBg }]}>
      <Text style={[styles.toolName, { color: colors.textTertiary }]}>{name}</Text>
      {result && (
        <Text style={[styles.toolResult, { color: colors.textSecondary }, isError && { color: colors.danger }]} numberOfLines={3}>
          {result}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  toolCallItem: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  toolName: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  toolResult: {
    fontSize: 10,
    marginTop: 2,
  },
});
