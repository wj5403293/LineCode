import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, ScrollView, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Clock, FilePenLine, Wrench, X } from 'lucide-react-native';
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
  onCancelWait,
}: Props) {
  const { colors } = useTheme();
  const mdStyle = useMemo(() => createMdStyle(colors), [colors]);
  const [expanded, setExpanded] = useState(true);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [reviewStates, setReviewStates] = useState<Record<string, 'accepted' | 'rejected'>>({});
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

  const getToolKey = useCallback((tc: AgentToolCall, index: number) => (
    `${tc.diffId || `${tc.name}:${String(tc.input?.file_path || 'file')}`}:${index}`
  ), []);

  const handleToolReview = useCallback((key: string) => (
    (_toolCallId: string, state: 'accepted' | 'rejected') => {
      setReviewStates(prev => ({ ...prev, [key]: state }));
    }
  ), []);

  const visibleToolCalls = toolCalls || [];
  const fileChanges = toolCalls?.filter(tc => isWriteTool(tc.name) || isDeleteTool(tc.name)) || [];
  const readCount = toolCalls?.filter(tc => isReadTool(tc.name)).length || 0;
  const hasFileChanges = fileChanges.length > 0;
  const hasVisibleTools = visibleToolCalls.length > 0;
  const isRunning = status === 'running' || streaming;
  const hasDetails = !!thinking || hasVisibleTools || !!output || isRunning || status === 'error';
  const isWaitingUnlock = status === 'waiting_unlock';

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight }]}>
      <AgentHeader
        name={name}
        agentType={agentType}
        status={status}
        expanded={expanded}
        toolCount={toolCalls?.length || 0}
        fileChangeCount={fileChanges.length}
        onToggle={handleToggle}
      />

      {expanded && hasDetails && (
        <View style={[styles.content, { borderTopColor: colors.codeBorder }]}>
          <ScrollView style={styles.outputScroll} nestedScrollEnabled>
            <AgentThinking
              thinking={thinking}
              streaming={streaming}
              expanded={thinkingExpanded}
              onToggle={() => setThinkingExpanded(prev => !prev)}
            />

            {hasVisibleTools && (
              <View style={styles.toolsSection}>
                <View style={styles.sectionHeader}>
                  <Wrench size={12} color={colors.textTertiary} />
                  <Text style={[styles.toolsLabel, { color: colors.textTertiary }]}>
                    工具调用{readCount > 0 ? ` · ${readCount} 次读取` : ''}{fileChanges.length > 0 ? ` · ${fileChanges.length} 处变更` : ''}
                  </Text>
                </View>
                <View style={styles.toolsList}>
                  {visibleToolCalls.map((tc, i) => {
                    const toolKey = getToolKey(tc, i);
                    return (
                      <ToolCallRenderer
                        key={toolKey}
                        name={tc.name}
                        input={tc.input}
                        result={tc.result}
                        isError={tc.isError}
                        toolCallId={toolKey}
                        diffId={tc.diffId}
                        reviewState={reviewStates[toolKey]}
                        homePath={homePath}
                        streaming={!tc.result}
                        onReview={handleToolReview(toolKey)}
                      />
                    );
                  })}
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
        <View style={[styles.fileChangesSection, { borderTopColor: colors.codeBorder }]}>
          <View style={styles.sectionHeader}>
            <FilePenLine size={12} color={colors.textTertiary} />
            <Text style={[styles.toolsLabel, { color: colors.textTertiary }]}>文件变更</Text>
          </View>
          <View style={styles.toolsList}>
            {fileChanges.map((tc, i) => {
              const originalIndex = visibleToolCalls.indexOf(tc);
              const toolKey = getToolKey(tc, originalIndex >= 0 ? originalIndex : i);
              return (
                <ToolCallRenderer
                  key={toolKey}
                  name={tc.name}
                  input={tc.input}
                  result={tc.result}
                  isError={tc.isError}
                  toolCallId={toolKey}
                  diffId={tc.diffId}
                  reviewState={reviewStates[toolKey]}
                  homePath={homePath}
                  streaming={!tc.result}
                  onReview={handleToolReview(toolKey)}
                />
              );
            })}
          </View>
        </View>
      )}

      {isWaitingUnlock && waitingForUnlock && (
        <View style={[styles.waitingSection, { borderTopColor: colors.codeBorder }]}>
          <View style={[styles.waitingContent, { backgroundColor: colors.processingMuted, borderColor: colors.codeBorder }]}>
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
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    borderRadius: radius.sm,
    marginVertical: 4,
    overflow: 'hidden',
    borderWidth: 1,
  },
  content: {
    width: '100%',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    maxHeight: 400,
  },
  outputScroll: {
    width: '100%',
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
  fileChangesSection: {
    width: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toolsSection: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  toolsLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  toolsList: {
    width: '100%',
    gap: 4,
  },
  waitingSection: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  waitingContent: {
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
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
