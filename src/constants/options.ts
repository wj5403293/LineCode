import { OptionItem } from '../types';

export const PERMISSIONS: OptionItem[] = [
  { id: 'read', label: '只读', desc: '仅查看文件' },
  { id: 'write', label: '读写', desc: '可修改文件' },
  { id: 'full', label: '完全', desc: '包括执行命令' },
];

export const MORE_OPTIONS: OptionItem[] = [
  { id: 'settings', label: '设置' },
  { id: 'clear', label: '清空对话' },
];
