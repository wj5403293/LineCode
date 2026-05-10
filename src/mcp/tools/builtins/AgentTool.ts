import { BaseTool, ToolContext } from '../BaseTool';
import { ToolResult, AgentInstance, Model, ToolCall, ContentBlock, AgentToolCall } from '../../../types';
import { aiService, ChatMessage } from '../../../services/ai';
import { fileLock } from '../../../services/FileLock';
import { modelStorage } from '../../../services/storage';
import { createDefaultRegistry } from '../index';

type AgentType = 'explore' | 'sub-coding';

const AGENT_PROMPTS: Record<AgentType, string> = {
  explore: `你是一个代码探索 Agent。你的任务是快速定位和分析代码，回答用户的问题。
规则：
- 只读取代码，不做任何修改
- 使用 file_read、glob 工具搜索代码
- 给出简洁准确的回答
- 标注文件路径和行号
- 你必须始终使用中文进行思考和交流`,

  'sub-coding': `你是一个编程 Agent。你的任务是完成具体的编程任务。
规则：
- 仔细分析需求，理解上下文
- 编写高质量、可维护的代码
- 完成后进行简单的验证
- 如果遇到问题，清晰地报告错误
- 只处理自己任务范围内的文件，不要修改与任务无关的文件
- 你必须始终使用中文进行思考和交流`,
};

const AGENT_MAX_ITERATIONS = 20;

export class AgentTool extends BaseTool {
  readonly name = 'agent';
  readonly description = '分派 Agent 处理任务。类型: explore(代码探索,只读), sub-coding(编程任务,可写)。';
  readonly category = 'system' as const;
  readonly requiresConfirmation = false;
  readonly parameters = {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['explore', 'sub-coding'], description: 'Agent 类型' },
      description: { type: 'string', description: '简短任务描述 (3-5 个词)' },
      prompt: { type: 'string', description: 'Agent 要执行的详细任务' },
    },
    required: ['type', 'description', 'prompt'],
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

  private async executeToolCall(
    toolCall: ToolCall, 
    homePath: string, 
    onConfirm?: (toolCall: ToolCall) => Promise<boolean>
  ): Promise<ToolResult> {
    const registry = createDefaultRegistry();
    const tool = registry.get(toolCall.name);

    if (!tool) {
      return {
        toolCallId: toolCall.id,
        content: `未知工具: ${toolCall.name}`,
        isError: true,
      };
    }

    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(toolCall.arguments);
    } catch {
      return {
        toolCallId: toolCall.id,
        content: `参数解析失败: ${toolCall.arguments}`,
        isError: true,
      };
    }

    if (toolCall.name === 'file_delete' && onConfirm) {
      const confirmed = await onConfirm(toolCall);
      if (!confirmed) {
        return {
          toolCallId: toolCall.id,
          content: '用户取消了删除操作',
          isError: false,
        };
      }
    }

    const context: ToolContext = { homePath };

    try {
      const result = await tool.execute(input, context);
      return { ...result, toolCallId: toolCall.id };
    } catch (err: any) {
      return {
        toolCallId: toolCall.id,
        content: `执行失败: ${err.message}`,
        isError: true,
      };
    }
  }

  async execute(input: { type: AgentType; description: string; prompt: string }, context: ToolContext): Promise<ToolResult> {
    const { type, description, prompt: agentPrompt } = input;
    const onProgress = context.onProgress;
    const onConfirm = context.onConfirm;

    if (this.runningCount >= this.maxConcurrent) {
      return {
        content: `并发 Agent 已达上限 (${this.maxConcurrent})，请等待其他 Agent 完成后再试。`,
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
        content: `未找到可用模型，请先在设置中添加模型。`,
        isError: true,
        toolCallId: '',
      };
    }

    const agent: AgentInstance = {
      id: this.nextAgentId++,
      type,
      name: description,
      status: 'running',
      startTime: Date.now(),
      input: agentPrompt,
      output: '',
      toolCalls: 0,
    };

    this.agents.push(agent);
    this.runningCount++;
    this.aborted = false;
    this.notifyChange();

    const toolCallRecords: AgentToolCall[] = [];
    let thinkingContent = '';

    const progressUpdate = (update: Partial<ContentBlock>) => {
      onProgress?.({
        agentType: type,
        agentStatus: update.agentStatus || 'running',
        agentOutput: update.agentOutput,
        agentThinking: update.agentThinking ?? thinkingContent,
        agentToolCalls: update.agentToolCalls ?? [...toolCallRecords],
      });
    };

    progressUpdate({ agentStatus: 'running', agentOutput: '' });

    let output = '';
    let toolCallCount = 0;

    try {
      const systemPrompt = AGENT_PROMPTS[type] + `\n\n你的 Agent ID 是 #${agent.id}，任务: ${description}`;
      
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: agentPrompt },
      ];

      const registry = createDefaultRegistry();
      const allTools = registry.getAll().filter(t => t.name !== 'agent');
      const tools = allTools.map(t => t.toJSON());

      for (let iteration = 0; iteration < AGENT_MAX_ITERATIONS; iteration++) {
        if (this.aborted) {
          agent.status = 'error';
          agent.output = '用户终止了任务';
          progressUpdate({ agentStatus: 'error', agentOutput: agent.output });
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
                thinkingContent += newThinking;
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

          const toolResult = await this.executeToolCall(tc, context.homePath, onConfirm);

          toolCallRecords.push({
            name: tc.name,
            input: tcInput,
            result: toolResult.content,
            isError: toolResult.isError,
          });

          progressUpdate({ agentToolCalls: [...toolCallRecords] });

          const toolMsg: ChatMessage = {
            role: 'tool',
            content: toolResult.content,
            toolCallId: tc.id,
            toolName: tc.name,
          };
          messages.push(toolMsg);
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
      fileLock.unlockAll(agent.id);
      this.notifyChange();
    }

    return {
      content: agent.output || '任务完成',
      isError: agent.status === 'error',
      toolCallId: '',
    };
  }
}
