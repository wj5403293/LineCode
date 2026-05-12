import { Message } from '../types';
import { ChatMessage } from './ai';

const CHARS_PER_TOKEN = 4;

export const COMPACT_TRIGGER_RATIO = 0.8;

const NO_TOOLS_PREAMBLE = `CRITICAL: Respond with TEXT ONLY. Do NOT call any tools.

- Do NOT use Read, Bash, Grep, Glob, Edit, Write, or ANY other tool.
- You already have all the context you need in the conversation above.
- Tool calls will be rejected and will waste your only turn.
- Your entire response must be plain text: an <analysis> block followed by a <summary> block.
`;

export const COMPACT_PROMPT = `${NO_TOOLS_PREAMBLE}
Your task is to create a detailed summary of the conversation so far, paying close attention to the user's explicit requests and the assistant's previous actions.

This summary should be thorough in capturing technical details, code patterns, architectural decisions, tool calls, file paths, errors, fixes, user feedback, and pending tasks that are essential for continuing development work without losing context.

Before providing your final summary, wrap your analysis in <analysis> tags. Then provide the final summary inside <summary> tags.

Your summary must include:

1. Primary Request and Intent
2. Key Technical Concepts
3. Files and Code Sections
4. Errors and Fixes
5. Problem Solving
6. All User Messages
7. Pending Tasks
8. Current Work
9. Optional Next Step

REMINDER: Do NOT call any tools. Respond with plain text only: an <analysis> block followed by a <summary> block.`;

export function estimateMessageTokens(messages: Pick<Message, 'content' | 'reasoningContent' | 'toolCalls' | 'toolResults' | 'blocks'>[]): number {
  const chars = messages.reduce((total, message) => {
    let next = total + (message.content?.length || 0) + (message.reasoningContent?.length || 0);
    if (message.toolCalls) {
      next += JSON.stringify(message.toolCalls).length;
    }
    if (message.toolResults) {
      next += JSON.stringify(message.toolResults).length;
    }
    if (message.blocks) {
      next += JSON.stringify(message.blocks).length;
    }
    return next;
  }, 0);
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

export function shouldCompactContext(messages: Message[], contextTokens: number): boolean {
  if (messages.length < 4) return false;
  return estimateMessageTokens(messages) >= contextTokens * COMPACT_TRIGGER_RATIO;
}

export function formatCompactSummary(summary: string): string {
  let formatted = summary.replace(/<analysis>[\s\S]*?<\/analysis>/, '');
  const match = formatted.match(/<summary>([\s\S]*?)<\/summary>/);
  if (match) {
    formatted = `Summary:\n${match[1].trim()}`;
  }
  return formatted.replace(/\n\n+/g, '\n\n').trim();
}

export function createCompactSummaryContent(summary: string): string {
  const formatted = formatCompactSummary(summary);
  return `This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.

${formatted}

Continue the conversation from where it left off without asking the user any further questions. Resume directly.`;
}

export function toCompactTranscript(messages: ChatMessage[]): string {
  return messages.map((message, index) => {
    const parts = [`## ${index + 1}. ${message.role}`];
    if (message.content) {
      parts.push(message.content);
    }
    if (message.toolCalls?.length) {
      parts.push(`Tool calls:\n${JSON.stringify(message.toolCalls, null, 2)}`);
    }
    if (message.toolCallId) {
      parts.push(`Tool result for: ${message.toolCallId}`);
    }
    if (message.reasoningContent) {
      parts.push(`Reasoning:\n${message.reasoningContent}`);
    }
    return parts.join('\n\n');
  }).join('\n\n---\n\n');
}
