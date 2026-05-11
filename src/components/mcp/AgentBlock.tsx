import React, { useState, useCallback } from 'react';
import { View, ScrollView, ActivityIndicator, StyleSheet, Text } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { colors, spacing, radius } from '../../constants/theme';
import { mdStyle } from '../message/markdownStyles';
import { AgentToolCall } from '../../types';
import { AgentHeader } from './agent/AgentHeader';
import { AgentThinking } from './agent/AgentThinking';
import { ToolCallRenderer } from './ToolCallRenderer';
import { isWriteTool, isDeleteTool } from '../../mcp/toolUtils';

interface Props {
  name: string;
  agentType: 'explore' | 'sub-coding';
  status: 'running' | 'done' | 'error';
  output?: string;
  thinking?: string;
  toolCalls?: AgentToolCall[];
  streaming?: boolean;
  homePath?: string;
}

export default React.memo(function AgentBlock({
  name,
  agentType,
  status,
  output,
  thinking,
  toolCalls,
  streaming,
  homePath,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  const fileChanges = toolCalls?.filter(tc => isWriteTool(tc.name) || isDeleteTool(tc.name)) || [];
  const hasFileChanges = fileChanges.length > 0;
  const isRunning = status === 'running' || streaming;

  return (
    <View style={styles.container}>
      <AgentHeader
        name={name}
        agentType={agentType}
        status={status}
        expanded={expanded}
        onToggle={handleToggle}
      />

      {expanded && (
        <View style={styles.content}>
          <ScrollView style={styles.outputScroll} nestedScrollEnabled>
            <AgentThinking
              thinking={thinking}
              streaming={streaming}
              expanded={thinkingExpanded}
              onToggle={() => setThinkingExpanded(prev => !prev)}
            />

            {output ? (
              <Markdown style={mdStyle}>{output}</Markdown>
            ) : isRunning ? (
              <View style={styles.streamingContainer}>
                <ActivityIndicator size="small" color={agentType === 'explore' ? colors.accent : '#F85149'} />
                <Text style={styles.streamingText}>正在执行任务...</Text>
              </View>
            ) : status === 'error' ? (
              <Text style={styles.errorText}>执行失败</Text>
            ) : null}

            {hasFileChanges && (
              <>
                <View style={styles.divider} />
                <View style={styles.toolsSection}>
                  <Text style={styles.toolsLabel}>文件变更</Text>
                  <View style={styles.toolsList}>
                    {fileChanges.map((tc, i) => (
                      <ToolCallRenderer
                        key={i}
                        name={tc.name}
                        input={tc.input}
                        result={tc.result}
                        isError={tc.isError}
                        homePath={homePath}
                        streaming={!tc.result}
                      />
                    ))}
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(48,209,88,0.04)',
    borderRadius: radius.sm,
    marginVertical: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(48,209,88,0.15)',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: spacing.sm,
    maxHeight: 400,
  },
  outputScroll: {
    flexGrow: 0,
  },
  streamingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  streamingText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontStyle: 'italic',
  },
  errorText: {
    color: '#F85149',
    fontSize: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: spacing.sm,
  },
  toolsSection: {
    marginBottom: spacing.sm,
  },
  toolsLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    marginBottom: spacing.xs,
  },
  toolsList: {
    gap: 4,
  },
});
