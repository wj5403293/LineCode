import RNFS from 'react-native-fs';
import { BaseTool, ToolContext } from '../BaseTool';
import { ToolResult, AgentInstance, Model, ToolCall, ContentBlock, AgentToolCall } from '../../../types';
import { aiService, ChatMessage } from '../../../services/ai';
import { fileLock } from '../../../services/FileLock';
import { modelStorage } from '../../../services/storage';
import { settingsService } from '../../../services/settings';
import { createDefaultRegistry, ToolRegistry } from '../index';

type AgentType = 'explore' | 'sub-coding';

interface PipelineAgent {
  id: string;
  type: AgentType;
  description: string;
  prompt: string;
  depends_on?: string[];
}

interface AgentResult {
  id: string;
  status: 'done' | 'error';
  output: string;
  toolCalls: AgentToolCall[];
}

const AGENT_PROMPTS: Record<AgentType, string> = {
  explore: `你是一个代码探索 Agent。你的任务是快速定位和分析代码，回答用户的问题。
规则：
- 只读取代码，不做任何修改
- 使用 file_read、glob 工具搜索代码
- 给出简洁准确的回答
- 标注文件路径和行号
- 你必须始终使用中文进行思考和交流`,

  'sub-coding': `你是一个编程 Agent。你的任务是完成具体的编程任务。

重要规则：
- 你只负责自己被分配的任务区域，不要修改其他区域的文件
- 如果遇到错误，先判断是否是自己任务范围内的原因：
  - 如果是自己的代码问题，修复它
  - 如果不是自己任务范围导致的错误，不要修改，可能是其他 Agent 还在编写中
- 编写高质量、可维护的代码
- 完成后进行简单的验证
- 你必须始终使用中文进行思考和交流

文件操作规则：
- 只修改任务明确指定的文件
- 如果需要修改多个文件，确保它们都在你的任务范围内
- 如果文件被锁定或修改失败，等待后重试或报告问题`,
};

const AGENT_MAX_ITERATIONS = 20;

function topologicalSort(agents: PipelineAgent[]): string[][] {
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();
  const agentMap = new Map<string, PipelineAgent>();

  for (const agent of agents) {
    agentMap.set(agent.id, agent);
    inDegree.set(agent.id, 0);
    graph.set(agent.id, []);
  }

  for (const agent of agents) {
    if (agent.depends_on) {
      for (const dep of agent.depends_on) {
        if (graph.has(dep)) {
          graph.get(dep)!.push(agent.id);
          inDegree.set(agent.id, (inDegree.get(agent.id) || 0) + 1);
        }
      }
    }
  }

  const levels: string[][] = [];
  let currentLevel: string[] = [];

  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      currentLevel.push(id);
    }
  }

  while (currentLevel.length > 0) {
    levels.push([...currentLevel]);
    const nextLevel: string[] = [];

    for (const id of currentLevel) {
      const children = graph.get(id) || [];
      for (const child of children) {
        const newDegree = (inDegree.get(child) || 0) - 1;
        inDegree.set(child, newDegree);
        if (newDegree === 0) {
          nextLevel.push(child);
        }
      }
    }

    currentLevel = nextLevel;
  }

  return levels;
}

export class AgentPipelineTool extends BaseTool {
  readonly name = 'agent_pipeline';
  readonly description = '创建多个有依赖关系的 Agent 任务流水线。支持定义依赖关系，无依赖的 Agent 并行执行，有依赖的串行执行。';
  readonly category = 'system' as const;
  readonly requiresConfirmation = false;
  readonly parameters = {
    type: 'object',
    properties: {
      agents: {
        type: 'array',
        description: 'Agent 列表，每个 Agent 可定义 depends_on 指定依赖',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Agent 唯一标识' },
            type: { type: 'string', enum: ['explore', 'sub-coding'], description: 'Agent 类型' },
            description: { type: 'string', description: '简短任务描述' },
            prompt: { type: 'string', description: '详细任务描述' },
            depends_on: { 
              type: 'array', 
              items: { type: 'string' },
              description: '依赖的 Agent ID 列表，这些 Agent 完成后才会执行此 Agent'
            },
          },
          required: ['id', 'type', 'description', 'prompt'],
        },
      },
    },
    required: ['agents'],
  };

  private agents: AgentInstance[] = [];
  private nextAgentId = 1;
  private agentsListener: ((agents: AgentInstance[]) => void) | null = null;
  private runningCount = 0;
  private maxConcurrent = 5;
  private aborted = false;

  setListener(listener: (agents: AgentInstance[]) => void) {
    this.agentsListener = listener;
  }

  getAgents(): AgentInstance[] {
    return this.agents;
  }

  abort() {
    this.aborted = true;
  }

  private notifyChange() {
    this.agentsListener?.([...this.agents]);
  }

  private async executeSingleAgent(
    pipelineAgent: PipelineAgent,
    model: Model,
    homePath: string,
    previousResults: Map<string, AgentResult>,
    onProgress?: (update: Partial<ContentBlock>) => void,
  ): Promise<AgentResult> {
    const agentId = this.nextAgentId++;
    const agent: AgentInstance = {
      id: agentId,
      type: pipelineAgent.type,
      name: pipelineAgent.description,
      status: 'running',
      startTime: Date.now(),
      input: pipelineAgent.prompt,
      output: '',
      toolCalls: 0,
    };

    this.agents.push(agent);
    this.runningCount++;
    this.notifyChange();

    const toolCallRecords: AgentToolCall[] = [];
    let thinkingContent = '';

    const progressUpdate = (update: Partial<ContentBlock>) => {
      onProgress?.({
        agentType: pipelineAgent.type,
        agentStatus: update.agentStatus || 'running',
        agentOutput: update.agentOutput,
        agentThinking: update.agentThinking ?? thinkingContent,
        agentToolCalls: update.agentToolCalls ?? [...toolCallRecords],
      });
    };

    progressUpdate({ agentStatus: 'running', agentOutput: '' });

    let output = '';
    let toolCallCount = 0;

    const registry = createDefaultRegistry();
    const agentTools = registry.getAll().filter(t =>
      t.name !== 'agent' && t.name !== 'agent_pipeline' && t.name !== 'shell_execute'
    );
    const tools = agentTools.map(t => t.toJSON());
    const preserveReasoning = await settingsService.getPreserveReasoning();

    let contextPrompt = '';
    if (pipelineAgent.depends_on && pipelineAgent.depends_on.length > 0) {
      const depOutputs: string[] = [];
      for (const depId of pipelineAgent.depends_on) {
        const depResult = previousResults.get(depId);
        if (depResult) {
          depOutputs.push(`\n### Agent "${depId}" 的输出:\n${depResult.output}`);
        }
      }
      if (depOutputs.length > 0) {
        contextPrompt = `\n\n## 上游 Agent 的输出结果\n以下是依赖的 Agent 已完成的工作，请基于这些结果继续：${depOutputs.join('\n')}\n\n请基于以上结果继续你的任务。`;
      }
    }

    const systemPrompt = AGENT_PROMPTS[pipelineAgent.type] + 
      `\n\n你的 Agent ID 是 #${agentId} (${pipelineAgent.id})，任务: ${pipelineAgent.description}` +
      contextPrompt;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: pipelineAgent.prompt },
    ];

    try {
      for (let iteration = 0; iteration < AGENT_MAX_ITERATIONS; iteration++) {
        if (this.aborted) {
          agent.status = 'error';
          agent.output = '用户终止了任务';
          break;
        }

        const result = await aiService.sendMessage(
          model,
          messages,
          {
            onBlocks: (blocks) => {
              const textBlocks = blocks.filter(b => b.type === 'text');
              const thinkingBlocks = blocks.filter(b => b.type === 'thinking');
              
              output = textBlocks.map(b => b.content).join('');
              const newThinking = thinkingBlocks.map(b => b.content).join('');
              if (newThinking) {
                thinkingContent = newThinking;
              }
              
              agent.output = output;
              this.notifyChange();
              progressUpdate({ 
                agentStatus: 'running', 
                agentOutput: output,
                agentThinking: thinkingContent,
              });
            },
          },
          'medium',
          tools,
          undefined,
          preserveReasoning,
        );

        if (result.reasoningContent) {
          thinkingContent = result.reasoningContent;
        }

        if (!result.toolCalls || result.toolCalls.length === 0) {
          output = result.text || output;
          agent.status = 'done';
          agent.output = output;
          break;
        }

        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: result.text,
          toolCalls: result.toolCalls,
          reasoningContent: result.reasoningContent,
          reasoningDetails: result.reasoningDetails,
        };
        messages.push(assistantMsg);

        for (const tc of result.toolCalls) {
          if (this.aborted) break;

          toolCallCount++;
          agent.toolCalls = toolCallCount;
          this.notifyChange();

          let tcInput: Record<string, unknown> = {};
          try {
            tcInput = JSON.parse(tc.arguments);
          } catch {}

          const tool = registry.get(tc.name);
          if (!tool) {
            toolCallRecords.push({
              name: tc.name,
              input: tcInput,
              result: `未知工具: ${tc.name}`,
              isError: true,
            });
            messages.push({
              role: 'tool',
              content: `未知工具: ${tc.name}`,
              toolCallId: tc.id,
              toolName: tc.name,
            });
            continue;
          }

          const context: ToolContext = { homePath };
          let toolResult: ToolResult;

          try {
            const executeResult = await tool.execute(tcInput, context);
            toolResult = { ...executeResult, toolCallId: tc.id };
          } catch (err: any) {
            toolResult = {
              toolCallId: tc.id,
              content: `执行失败: ${err.message}`,
              isError: true,
            };
          }

          toolCallRecords.push({
            name: tc.name,
            input: tcInput,
            result: toolResult.content,
            isError: toolResult.isError,
          });

          progressUpdate({ agentToolCalls: [...toolCallRecords] });

          messages.push({
            role: 'tool',
            content: toolResult.content,
            toolCallId: tc.id,
            toolName: tc.name,
          });
        }
      }

      if (!agent.status || agent.status === 'running') {
        agent.status = 'done';
        agent.output = output || '任务完成';
      }
      
      agent.endTime = Date.now();
      progressUpdate({ 
        agentStatus: agent.status, 
        agentOutput: agent.output,
        agentThinking: thinkingContent,
        agentToolCalls: toolCallRecords,
      });
    } catch (err: any) {
      agent.status = 'error';
      agent.endTime = Date.now();
      agent.output = `错误: ${err.message}`;
      progressUpdate({ 
        agentStatus: 'error', 
        agentOutput: agent.output,
        agentThinking: thinkingContent,
        agentToolCalls: toolCallRecords,
      });
    } finally {
      this.runningCount--;
      fileLock.unlockAll(agentId);
      this.notifyChange();
    }

    return {
      id: pipelineAgent.id,
      status: agent.status === 'done' ? 'done' : 'error',
      output: agent.output,
      toolCalls: toolCallRecords,
    };
  }

  async execute(input: { agents: PipelineAgent[] }, context: ToolContext): Promise<ToolResult> {
    const { agents: pipelineAgents } = input;
    const onProgress = context.onProgress;

    if (!pipelineAgents || pipelineAgents.length === 0) {
      return {
        content: 'Agent 列表不能为空',
        isError: true,
        toolCallId: '',
      };
    }

    const [models, selectedId] = await Promise.all([
      modelStorage.getModels(),
      modelStorage.getSelectedModelId(),
    ]);

    const model = models.find(m => m.id === selectedId);
    if (!model) {
      return {
        content: '未找到可用模型，请先在设置中添加模型。',
        isError: true,
        toolCallId: '',
      };
    }

    this.agents = [];
    this.nextAgentId = 1;
    this.aborted = false;

    const levels = topologicalSort(pipelineAgents);
    const results = new Map<string, AgentResult>();
    const agentMap = new Map<string, PipelineAgent>();
    
    for (const agent of pipelineAgents) {
      agentMap.set(agent.id, agent);
    }

    const summary: string[] = [];

    try {
      for (let levelIndex = 0; levelIndex < levels.length; levelIndex++) {
        const level = levels[levelIndex];
        
        if (this.aborted) break;

        const levelPromises = level.map(async (agentId) => {
          const pipelineAgent = agentMap.get(agentId);
          if (!pipelineAgent) return null;
          
          return this.executeSingleAgent(
            pipelineAgent,
            model,
            context.homePath,
            results,
            onProgress,
          );
        });

        const levelResults = await Promise.all(levelPromises);
        
        for (const result of levelResults) {
          if (result) {
            results.set(result.id, result);
            const statusIcon = result.status === 'done' ? '✓' : '✗';
            summary.push(`${statusIcon} ${result.id}: ${result.output.slice(0, 100)}...`);
          }
        }
      }
    } catch (err: any) {
      return {
        content: `流水线执行失败: ${err.message}`,
        isError: true,
        toolCallId: '',
      };
    }

    const successCount = Array.from(results.values()).filter(r => r.status === 'done').length;
    const totalCount = results.size;

    return {
      content: `Agent 流水线完成 (${successCount}/${totalCount})\n\n${summary.join('\n')}`,
      isError: successCount < totalCount,
      toolCallId: '',
    };
  }
}
