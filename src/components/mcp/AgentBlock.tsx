import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, ScrollView, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Clock, X } from 'lucide-react-native';
import { spacing, radius } from '../../constants/theme';
import { useTheme } from '../../theme';
import { createMdStyle } from '../message/markdownStyles';
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
  const { colors } = useTheme();
  const mdStyle = useMemo(() => createMdStyle(colors), [colors]);
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
    <View style={[styles.container, { backgroundColor: colors.accentMuted, borderColor: colors.accentMuted2 }]}>
      <AgentHeader
        name={name}
        agentType={agentType}
        status={status}
        expanded={expanded}
        onToggle={handleToggle}
      />

      {expanded && (
        <View style={[styles.content, { borderTopColor: colors.codeBorder }]}>
          <ScrollView style={styles.outputScroll} nestedScrollEnabled>
            <AgentThinking
              thinking={thinking}
              streaming={streaming}
              expanded={thinkingExpanded}
              onToggle={() => setThinkingExpanded(prev => !prev)}
            />

            {toolCalls && toolCalls.length > 0 && (
              <View style={styles.allToolsSection}>
                <Text style={[styles.toolsLabel, { color: colors.textTertiary }]}>工具调用</Text>
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
                <ActivityIndicator size="small" color={agentType === 'explore' ? colors.accent : colors.danger} />
                <Text style={[styles.streamingText, { color: colors.textTertiary }]}>正在执行任务...</Text>
              </View>
            ) : status === 'error' ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>执行失败</Text>
            ) : null}
          </ScrollView>
        </View>
      )}

      {hasFileChanges && (
        <View style={styles.fileChangesSection}>
          <View style={[styles.divider, { backgroundColor: colors.codeBorder }]} />
          <Text style={[styles.toolsLabel, { color: colors.textTertiary }]}>文件变更</Text>
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
          <View style={[styles.divider, { backgroundColor: colors.codeBorder }]} />
          <View style={[styles.waitingContent, { backgroundColor: colors.processingMuted }]}>
            <View style={styles.waitingHeader}>
              <Clock size={16} color={colors.processing} />
              <Text style={[styles.waitingTitle, { color: colors.processing }]}>等待文件解锁</Text>
            </View>
            <Text style={[styles.waitingFilePath, { color: colors.text }]} numberOfLines={1}>
              {waitingForUnlock.filePath}
            </Text>
            <Text style={[styles.waitingInfo, { color: colors.textSecondary }]}>
              正在被 Agent "{waitingForUnlock.lockedBy}" 锁定
            </Text>
            <View style={styles.waitingStatus}>
              <ActivityIndicator size="small" color={colors.processing} />
              <Text style={[styles.waitingTime, { color: colors.processing }]}>已等待 {formatTime(waitSeconds)}</Text>
            </View>
            <TouchableOpacity style={[styles.cancelButton, { backgroundColor: colors.codeBorder }]} onPress={onCancelWait} activeOpacity={0.7}>
              <X size={14} color={colors.textSecondary} />
              <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>取消等待</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.sm,
    marginVertical: 4,
    overflow: 'hidden',
    borderWidth: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
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
    fontSize: 12,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.sm,
  },
  fileChangesSection: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  allToolsSection: {
    marginBottom: spacing.sm,
  },
  toolsLabel: {
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
    fontSize: 14,
    fontWeight: '600',
  },
  waitingFilePath: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: spacing.xs,
  },
  waitingInfo: {
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
    fontSize: 13,
    fontWeight: '500',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  cancelButtonText: {
    fontSize: 13,
  },
});
