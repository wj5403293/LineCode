import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AgentToolCall } from '../../types';
import { isReadTool, isWriteTool, isDeleteTool, isHttpTool } from '../../mcp/toolUtils';
import ToolCallRead from './ToolCallRead';
import ToolCallWrite from './ToolCallWrite';
import ToolCallDelete from './ToolCallDelete';
import ToolCallHttpServer from './ToolCallHttpServer';

interface ToolCallRendererProps {
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  homePath?: string;
  streaming?: boolean;
}

export function ToolCallRenderer({
  name,
  input,
  result,
  isError,
  homePath,
  streaming,
}: ToolCallRendererProps) {
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
        homePath={homePath || ''}
        streaming={streaming || false}
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

  return (
    <View style={styles.toolCallItem}>
      <Text style={styles.toolName}>{name}</Text>
      {result && (
        <Text style={[styles.toolResult, isError && styles.toolResultError]} numberOfLines={3}>
          {result}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toolCallItem: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  toolName: {
    color: '#9CA3AF',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  toolResult: {
    color: '#6B7280',
    fontSize: 10,
    marginTop: 2,
  },
  toolResultError: {
    color: '#F85149',
  },
});
