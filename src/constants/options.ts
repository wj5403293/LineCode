import { OptionItem } from '../types';

export const PERMISSIONS: OptionItem[] = [
  { id: 'readonly', label: '只读', desc: '仅允许读取文件' },
  { id: 'auto', label: '自动', desc: '自动执行，删除需确认' },
  { id: 'confirm', label: '确认', desc: '危险操作需确认' },
];

export const MORE_OPTIONS: OptionItem[] = [
  { id: 'settings', label: '设置' },
  { id: 'clear', label: '清空对话' },
];
