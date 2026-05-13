import { BaseTool, ToolContext } from '../BaseTool';
import { ToolResult, AgentInstance, ToolCall, ContentBlock, AgentToolCall } from '../../../types';
import { aiService, ChatMessage } from '../../../services/ai';
import { fileLock } from '../../../services/FileLock';
import { modelStorage } from '../../../services/storage';
import { settingsService } from '../../../services/settings';
import { createDefaultRegistry, ToolRegistry } from '../index';
import { agentToolManager } from '../../AgentToolManager';
import { workspaceFs } from '../../../services/WorkspaceFileSystem';

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
  private currentAgentRegistry: ToolRegistry | null = null;
  private currentAgentId: number = 0;
  private waitingForUnlock: { filePath: string; lockedBy: string } | null = null;
  private unlockWaitResolve: ((continue_: boolean) => void) | null = null;
  private currentHomePath: string = '';

  setListener(listener: (agents: AgentInstance[]) => void) {
    this.agentsListener = listener;
  }

  getAgents(): AgentInstance[] {
    return this.agents;
  }

  abort() {
    this.aborted = true;
    if (this.unlockWaitResolve) {
      this.unlockWaitResolve(false);
      this.unlockWaitResolve = null;
    }
    this.waitingForUnlock = null;
  }

  continueAfterUnlock() {
    if (this.unlockWaitResolve) {
      this.unlockWaitResolve(true);
      this.unlockWaitResolve = null;
    }
    this.waitingForUnlock = null;
  }

  getWaitingForUnlock() {
    return this.waitingForUnlock;
  }

  private notifyChange() {
    this.agentsListener?.([...this.agents]);
  }

  private injectFileLock(agentId: number, agentName: string, homePath: string): void {
    const fileWriteTool = this.currentAgentRegistry?.get('file_write');
    const fileEditTool = this.currentAgentRegistry?.get('file_edit');

    const wrapWithLock = (origExecute: Function) => {
      return async (input: Record<string, unknown>, ctx: ToolContext) => {
        const filePath = String(input.file_path || '');
        const fullPath = workspaceFs.resolvePath(filePath, homePath);

        let currentContent = '';
        try {
          const exists = await workspaceFs.exists(fullPath);
          if (exists) {
            try {
              const stat = await workspaceFs.stat(fullPath);
              if (stat.isDirectory()) {
                return {
                  content: `路径是一个目录，无法写入文件: ${filePath}`,
                  isError: true,
                  toolCallId: '',
                };
              }
              currentContent = await workspaceFs.readFile(fullPath);
            } catch (err: any) {
              return {
                content: `读取文件失败: ${err?.message || String(err)}`,
                isError: true,
                toolCallId: '',
              };
            }
          }
        } catch {
          // 文件不存在，用空字符串
        }

        const status = fileLock.acquire(fullPath, agentId, agentName, currentContent);

        if (status === 'ok') {
          try {
            return await origExecute(input, ctx);
          } finally {
            // 保持锁定，Agent 结束时统一释放
          }
        }

        if (status === 'modified') {
          return {
            content: `文件 ${filePath} 已被其他 Agent 修改，请重新读取文件后再操作。`,
            isError: true,
            toolCallId: '',
          };
        }

        // status === 'wait'，文件被其他 Agent 锁定
        const lockInfo = fileLock.isLockedByOther(fullPath, agentId);
        const lockedBy = lockInfo.locked ? lockInfo.by : '未知';
        
        this.waitingForUnlock = { filePath, lockedBy };
        
        const shouldContinue = await new Promise<boolean>(resolve => {
          this.unlockWaitResolve = resolve;
        });
        
        if (!shouldContinue || this.aborted) {
          return {
            content: '用户取消了等待',
            isError: true,
            toolCallId: '',
          };
        }

        // 重新读取文件内容
        try {
          const exists = await workspaceFs.exists(fullPath);
          if (exists) {
            try {
              const stat = await workspaceFs.stat(fullPath);
              if (stat.isDirectory()) {
                return {
                  content: `路径是一个目录，无法写入文件: ${filePath}`,
                  isError: true,
                  toolCallId: '',
                };
              }
              currentContent = await workspaceFs.readFile(fullPath);
            } catch (err: any) {
              return {
                content: `读取文件失败: ${err?.message || String(err)}`,
                isError: true,
                toolCallId: '',
              };
            }
          }
        } catch {
          // 文件不存在，用空字符串
        }

        // 再次尝试获取锁
        const retryStatus = fileLock.acquire(fullPath, agentId, agentName, currentContent);
        if (retryStatus === 'ok') {
          try {
            return await origExecute(input, ctx);
          } finally {
            // 保持锁定
          }
        }

        return {
          content: `无法获取文件锁: ${retryStatus}`,
          isError: true,
          toolCallId: '',
        };
      };
    };

    if (fileWriteTool) {
      (fileWriteTool as any).execute = wrapWithLock((fileWriteTool as any).execute.bind(fileWriteTool));
    }
    if (fileEditTool) {
      (fileEditTool as any).execute = wrapWithLock((fileEditTool as any).execute.bind(fileEditTool));
    }
  }

  private async executeToolCall(
    toolCall: ToolCall, 
    homePath: string, 
    onConfirm?: (toolCall: ToolCall) => Promise<boolean>
  ): Promise<ToolResult> {
    const registry = this.currentAgentRegistry || createDefaultRegistry();
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
    agentToolManager.setCurrent(this);
    this.notifyChange();

    this.currentAgentRegistry = createDefaultRegistry();
    this.currentAgentId = agent.id;
    
    if (type === 'sub-coding') {
      this.injectFileLock(agent.id, description, context.homePath);
    }

    const toolCallRecords: AgentToolCall[] = [];
    let thinkingContent = '';

    const progressUpdate = (update: Partial<ContentBlock>) => {
      const waitingInfo = this.waitingForUnlock;
      onProgress?.({
        agentType: type,
        agentStatus: waitingInfo ? 'waiting_unlock' : (update.agentStatus || 'running'),
        agentOutput: update.agentOutput,
        agentThinking: update.agentThinking ?? thinkingContent,
        agentToolCalls: update.agentToolCalls ?? [...toolCallRecords],
        waitingForUnlock: waitingInfo || undefined,
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

      const allTools = this.currentAgentRegistry!.getAll().filter(t =>
        t.name !== 'agent' && t.name !== 'shell_execute'
      );
      const tools = allTools.map(t => t.toJSON());
      const preserveReasoning = await settingsService.getPreserveReasoning();

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
      this.currentAgentRegistry = null;
      this.currentAgentId = 0;
      agentToolManager.setCurrent(null);
      this.notifyChange();
    }

    return {
      content: agent.output || '任务完成',
      isError: agent.status === 'error',
      toolCallId: '',
    };
  }
}
