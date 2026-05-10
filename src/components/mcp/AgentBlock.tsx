import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Bot, ChevronRight, ChevronDown, CheckCircle, XCircle } from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';
import { colors, spacing, fontSizes, radius } from '../../constants/theme';
import { mdStyle } from '../message/markdownStyles';
import { thinkingMdStyle } from '../message/markdownStyles';
import { AgentToolCall } from '../../types';
import ToolCallRead from './ToolCallRead';
import ToolCallWrite from './ToolCallWrite';
import ToolCallDelete from './ToolCallDelete';
import ToolCallHttpServer from './ToolCallHttpServer';

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

const READ_TOOLS = new Set(['file_read', 'glob']);
const WRITE_TOOLS = new Set(['file_write', 'file_edit']);
const DELETE_TOOLS = new Set(['file_delete']);
const HTTP_TOOLS = new Set(['http_server']);

export default React.memo(function AgentBlock({ name, agentType, status, output, thinking, toolCalls, streaming, homePath }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(true);

  const handleToggle = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  const typeLabel = agentType === 'explore' ? '探索' : '编程';
  const typeColor = agentType === 'explore' ? colors.accent : '#F85149';

  const renderToolCall = (tc: AgentToolCall, index: number) => {
    if (READ_TOOLS.has(tc.name)) {
      return (
        <ToolCallRead
          key={index}
          name={tc.name}
          input={tc.input}
          result={tc.result}
          isError={tc.isError}
        />
      );
    }
    
    if (WRITE_TOOLS.has(tc.name)) {
      return (
        <ToolCallWrite
          key={index}
          name={tc.name}
          input={tc.input}
          result={tc.result}
          isError={tc.isError}
          homePath={homePath || ''}
          streaming={false}
        />
      );
    }
    
    if (DELETE_TOOLS.has(tc.name)) {
      return (
        <ToolCallDelete
          key={index}
          input={tc.input}
          result={tc.result}
          isError={tc.isError}
        />
      );
    }
    
    if (HTTP_TOOLS.has(tc.name)) {
      return (
        <ToolCallHttpServer
          key={index}
          input={tc.input}
          result={tc.result}
          isError={tc.isError}
        />
      );
    }

    return (
      <View key={index} style={styles.toolCallItem}>
        <Text style={styles.toolName}>{tc.name}</Text>
        {tc.result && (
          <Text style={[styles.toolResult, tc.isError && styles.toolResultError]} numberOfLines={3}>
            {tc.result}
          </Text>
        )}
      </View>
    );
  };

  const renderContent = () => {
    if (!output && streaming) {
      return (
        <View style={styles.streamingContainer}>
          <ActivityIndicator size="small" color={typeColor} />
          <Text style={styles.streamingText}>正在执行任务...</Text>
        </View>
      );
    }
    
    return (
      <>
        {thinking && (
          <TouchableOpacity 
            style={styles.thinkingHeader} 
            onPress={() => setThinkingExpanded(!thinkingExpanded)}
            activeOpacity={0.7}
          >
            <Text style={styles.thinkingIcon}>✦</Text>
            <Text style={styles.thinkingLabel}>
              {streaming ? '思考中...' : '思考完毕'}
            </Text>
            {thinkingExpanded
              ? <ChevronDown size={12} color={colors.textTertiary} />
              : <ChevronRight size={12} color={colors.textTertiary} />
            }
          </TouchableOpacity>
        )}
        
        {thinking && thinkingExpanded && (
          <ScrollView style={styles.thinkingContent} nestedScrollEnabled>
            <Markdown style={thinkingMdStyle}>{thinking}</Markdown>
          </ScrollView>
        )}

        {toolCalls && toolCalls.length > 0 && (
          <TouchableOpacity 
            style={styles.toolsHeader} 
            onPress={() => setToolsExpanded(!toolsExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.toolsHeaderLeft}>
              <Text style={styles.toolsLabel}>工具调用</Text>
              <Text style={styles.toolsCount}>{toolCalls.length}</Text>
            </View>
            {toolsExpanded
              ? <ChevronDown size={12} color={colors.textTertiary} />
              : <ChevronRight size={12} color={colors.textTertiary} />
            }
          </TouchableOpacity>
        )}
        
        {toolCalls && toolsExpanded && (
          <View style={styles.toolsList}>
            {toolCalls.map((tc, i) => renderToolCall(tc, i))}
          </View>
        )}

        {output ? (
          <Markdown style={mdStyle}>{output}</Markdown>
        ) : status === 'error' ? (
          <Text style={styles.errorText}>执行失败</Text>
        ) : (
          <Text style={styles.placeholderText}>任务完成</Text>
        )}
      </>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={handleToggle} activeOpacity={0.7}>
        <View style={styles.left}>
          <View style={[styles.iconBadge, { backgroundColor: `${typeColor}20` }]}>
            <Bot size={14} color={typeColor} />
          </View>
          <View style={styles.titleSection}>
            <Text style={styles.title} numberOfLines={1}>{name}</Text>
            <Text style={styles.subtitle}>{typeLabel} Agent</Text>
          </View>
        </View>
        <View style={styles.right}>
          {status === 'running' ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : status === 'done' ? (
            <CheckCircle size={14} color="#3FB950" />
          ) : (
            <XCircle size={14} color="#F85149" />
          )}
          {expanded
            ? <ChevronDown size={16} color={colors.textTertiary} />
            : <ChevronRight size={16} color={colors.textTertiary} />
          }
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <ScrollView style={styles.outputScroll} nestedScrollEnabled>
            {renderContent()}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleSection: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
    fontSize: fontSizes.xs,
    fontStyle: 'italic',
  },
  placeholderText: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    fontStyle: 'italic',
  },
  errorText: {
    color: '#F85149',
    fontSize: fontSizes.xs,
  },
  thinkingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  thinkingIcon: {
    color: colors.textTertiary,
    fontSize: 10,
  },
  thinkingLabel: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    flex: 1,
  },
  thinkingContent: {
    maxHeight: 150,
    marginBottom: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  toolsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  toolsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toolsLabel: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
  },
  toolsCount: {
    color: colors.accent,
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  toolsList: {
    marginBottom: spacing.sm,
  },
  toolCallItem: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  toolName: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    fontFamily: 'monospace',
  },
  toolResult: {
    color: colors.textTertiary,
    fontSize: 10,
    marginTop: 2,
  },
  toolResultError: {
    color: '#F85149',
  },
});
