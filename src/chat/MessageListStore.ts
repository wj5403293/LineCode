import { Message } from '../types';

export type MessageUpdater = Message[] | ((prev: Message[]) => Message[]);

export class MessageListStore {
  private messages: Message[];
  private visibleMessages: Message[];
  private visibleSource: Message[];
  private revision = 0;

  constructor(initialMessages: Message[] = []) {
    this.messages = initialMessages;
    this.visibleSource = initialMessages;
    this.visibleMessages = initialMessages.filter(message => !message.hidden);
  }

  getSnapshot(): Message[] {
    return this.messages;
  }

  getRevision(): number {
    return this.revision;
  }

  setMessages(nextMessages: Message[]): Message[] {
    if (nextMessages === this.messages) return this.messages;
    this.messages = nextMessages;
    this.revision += 1;
    return this.messages;
  }

  update(updater: MessageUpdater): Message[] {
    const nextMessages = typeof updater === 'function' ? updater(this.messages) : updater;
    return this.setMessages(nextMessages);
  }

  append(message: Message): Message[] {
    return this.setMessages([...this.messages, message]);
  }

  updateById(messageId: string, update: (message: Message) => Message): Message[] {
    let changed = false;
    const nextMessages = this.messages.map(message => {
      if (message.id !== messageId) return message;
      const nextMessage = update(message);
      if (nextMessage !== message) changed = true;
      return nextMessage;
    });
    return changed ? this.setMessages(nextMessages) : this.messages;
  }

  getVisibleMessages(): Message[] {
    if (this.visibleSource === this.messages) {
      return this.visibleMessages;
    }
    this.visibleSource = this.messages;
    this.visibleMessages = this.messages.filter(message => !message.hidden);
    return this.visibleMessages;
  }
}
