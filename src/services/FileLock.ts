export type LockStatus = 'ok' | 'wait' | 'modified';

interface FileLockEntry {
  agentId: number;
  agentName: string;
  contentHash: string;
}

export class FileLock {
  private locks = new Map<string, FileLockEntry>();
  private snapshots = new Map<string, string>();

  private hash(content: string): string {
    let h = 0;
    for (let i = 0; i < content.length; i++) {
      h = ((h << 5) - h + content.charCodeAt(i)) | 0;
    }
    return h.toString(36);
  }

  lock(filePath: string, agentId: number, agentName: string, currentContent: string): void {
    this.locks.set(filePath, {
      agentId,
      agentName,
      contentHash: this.hash(currentContent),
    });
    this.snapshots.set(filePath, this.hash(currentContent));
  }

  isLockedByOther(filePath: string, agentId: number): { locked: true; by: string } | { locked: false } {
    const lock = this.locks.get(filePath);
    if (lock && lock.agentId !== agentId) {
      return { locked: true, by: lock.agentName };
    }
    return { locked: false };
  }

  isLocked(filePath: string): boolean {
    return this.locks.has(filePath);
  }

  acquire(filePath: string, agentId: number, agentName: string, currentContent: string): LockStatus {
    const existing = this.locks.get(filePath);

    if (existing && existing.agentId !== agentId) {
      return 'wait';
    }

    if (existing?.agentId === agentId) {
      return 'ok';
    }

    const lastSnapshot = this.snapshots.get(filePath);
    const currentHash = this.hash(currentContent);
    if (lastSnapshot && lastSnapshot !== currentHash) {
      this.snapshots.set(filePath, currentHash);
      return 'modified';
    }

    this.lock(filePath, agentId, agentName, currentContent);
    return 'ok';
  }

  unlock(filePath: string, agentId: number): void {
    const existing = this.locks.get(filePath);
    if (existing?.agentId === agentId) {
      this.locks.delete(filePath);
    }
  }

  unlockAll(agentId: number): void {
    for (const [path, lock] of this.locks) {
      if (lock.agentId === agentId) {
        this.locks.delete(path);
      }
    }
  }
}

export const fileLock = new FileLock();
