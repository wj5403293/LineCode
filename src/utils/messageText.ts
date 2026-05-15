import { InputAttachment } from '../types';

const ATTACHMENT_MARKER = '\n\n附加文件位置:\n';
const ATTACHMENT_ONLY_PREFIX = '附加文件位置:\n';
const ATTACHMENT_ONLY_TEXT = '已附加文件';

export function stripLegacyAttachmentBlock(content: string): string {
  const markerIndex = content.indexOf(ATTACHMENT_MARKER);
  if (markerIndex !== -1) return content.slice(0, markerIndex).trim();
  return content.startsWith(ATTACHMENT_ONLY_PREFIX) ? '' : content;
}

export function getVisibleUserMessageText(content: string, attachments?: InputAttachment[]): string {
  const sanitizedContent = stripLegacyAttachmentBlock(content);
  const fallbackContent = content.startsWith(ATTACHMENT_ONLY_PREFIX) ? ATTACHMENT_ONLY_TEXT : '';
  const displayContent = sanitizedContent || fallbackContent;
  return displayContent === ATTACHMENT_ONLY_TEXT && attachments?.length ? '' : displayContent;
}

export function getUserMessageCopyText(content: string, attachments?: InputAttachment[]): string {
  return getVisibleUserMessageText(content, attachments) || stripLegacyAttachmentBlock(content) || content;
}

export function getUserMessageRecallText(content: string): string {
  const recalled = stripLegacyAttachmentBlock(content);
  return recalled === ATTACHMENT_ONLY_TEXT ? '' : recalled;
}
