import { ContentBlock } from '../types';

const DEFAULT_FLUSH_INTERVAL_MS = 180;

type PendingUpdate =
  | { type: 'status'; status: string }
  | { type: 'blocks'; blocks: ContentBlock[] }
  | { type: 'tool'; toolCall: { id: string; name: string } };

export class StreamUpdateBuffer {
  private pending: PendingUpdate[] = [];
  private timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS,
    private readonly onFlush: (updates: PendingUpdate[]) => void,
  ) {}

  pushStatus(status: string) {
    this.pending = this.pending.filter(update => update.type !== 'status');
    this.pending.push({ type: 'status', status });
    this.schedule();
  }

  pushBlocks(blocks: ContentBlock[]) {
    this.pending = this.pending.filter(update => update.type !== 'blocks');
    this.pending.push({ type: 'blocks', blocks });
    this.schedule();
  }

  pushToolCall(toolCall: { id: string; name: string }) {
    if (this.pending.some(update => update.type === 'tool' && update.toolCall.id === toolCall.id)) {
      return;
    }
    this.pending.push({ type: 'tool', toolCall });
    this.schedule();
  }

  flush() {
    this.clearTimer();
    if (this.pending.length === 0) return;
    const updates = this.pending;
    this.pending = [];
    this.onFlush(updates);
  }

  cancel() {
    this.clearTimer();
    this.pending = [];
  }

  private schedule() {
    if (this.timeout) return;
    this.timeout = setTimeout(() => this.flush(), this.flushIntervalMs);
  }

  private clearTimer() {
    if (!this.timeout) return;
    clearTimeout(this.timeout);
    this.timeout = null;
  }
}

export type StreamBufferedUpdate = PendingUpdate;
