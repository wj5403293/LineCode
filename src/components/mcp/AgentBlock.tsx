import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, ScrollView, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Clock, X } from 'lucide-react-native';
import { colors, spacing, radius } from '../../constants/theme';
import { mdStyle } from '../message/markdownStyles';
import { AgentToolCall } from '../../types';
import { AgentHeader } from './agent/AgentHeader';
import { AgentThinking } from './agent/AgentThinking';
import { ToolCallRenderer } from './ToolCallRenderer';
import { isWriteTool, isDeleteTool, isReadTool } from '../../mcp/toolUtils';

interface Props {
  name: string;
  agentType: 'explore' | 'sub-coding';
  status: 'running' | 'done' | 'error' | 'waiting_unlock';
  output?: string;
  thinking?: string;
  toolCalls?: AgentToolCall[];
  streaming?: boolean;
  homePath?: string;
  waitingForUnlock?: {
    filePath: string;
    lockedBy: string;
  };
  onContinueAfterUnlock?: () => void;
  onCancelWait?: () => void;
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
  waitingForUnlock,
  onContinueAfterUnlock,
  onCancelWait,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const waitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleToggle = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  useEffect(() => {
    if (status === 'waiting_unlock') {
      setWaitSeconds(0);
      waitTimerRef.current = setInterval(() => {
        setWaitSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (waitTimerRef.current) {
        clearInterval(waitTimerRef.current);
        waitTimerRef.current = null;
      }
      setWaitSeconds(0);
    }
    return () => {
      if (waitTimerRef.current) {
        clearInterval(waitTimerRef.current);
      }
    };
  }, [status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}秒`;
  };

  const fileChanges = toolCalls?.filter(tc => isWriteTool(tc.name) || isDeleteTool(tc.name)) || [];
  const hasFileChanges = fileChanges.length > 0;
  const isRunning = status === 'running' || streaming;
  const isWaitingUnlock = status === 'waiting_unlock';

  return (
    <View style={styles.container}>
      <AgentHeader
        name={name}
        agentType={agentType}
        status={status}
        expanded={expanded}
        onToggle={handleToggle}
      />

      {hasFileChanges && (
        <View style={styles.fileChangesSection}>
          <View style={styles.divider} />
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
      )}

      {isWaitingUnlock && waitingForUnlock && (
        <View style={styles.waitingSection}>
          <View style={styles.divider} />
          <View style={styles.waitingContent}>
            <View style={styles.waitingHeader}>
              <Clock size={16} color="#FF9800" />
              <Text style={styles.waitingTitle}>等待文件解锁</Text>
            </View>
            <Text style={styles.waitingFilePath} numberOfLines={1}>
              {waitingForUnlock.filePath}
            </Text>
            <Text style={styles.waitingInfo}>
              正在被 Agent "{waitingForUnlock.lockedBy}" 锁定
            </Text>
            <View style={styles.waitingStatus}>
              <ActivityIndicator size="small" color="#FF9800" />
              <Text style={styles.waitingTime}>已等待 {formatTime(waitSeconds)}</Text>
            </View>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancelWait} activeOpacity={0.7}>
              <X size={14} color={colors.textSecondary} />
              <Text style={styles.cancelButtonText}>取消等待</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {expanded && (
        <View style={styles.content}>
          <ScrollView style={styles.outputScroll} nestedScrollEnabled>
            <AgentThinking
              thinking={thinking}
              streaming={streaming}
              expanded={thinkingExpanded}
              onToggle={() => setThinkingExpanded(prev => !prev)}
            />

            {toolCalls && toolCalls.length > 0 && (
              <View style={styles.allToolsSection}>
                <Text style={styles.toolsLabel}>工具调用</Text>
                <View style={styles.toolsList}>
                  {toolCalls.map((tc, i) => (
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
            )}

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
  fileChangesSection: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  allToolsSection: {
    marginBottom: spacing.sm,
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
  waitingSection: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  waitingContent: {
    backgroundColor: 'rgba(255,152,0,0.1)',
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  waitingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  waitingTitle: {
    color: '#FF9800',
    fontSize: 14,
    fontWeight: '600',
  },
  waitingFilePath: {
    color: colors.text,
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: spacing.xs,
  },
  waitingInfo: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  waitingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  waitingTime: {
    color: '#FF9800',
    fontSize: 13,
    fontWeight: '500',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});
