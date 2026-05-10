import { useState, useCallback } from 'react';

export type DialogType = 'project' | 'permission' | 'more' | null;

export function useDialog() {
  const [dialog, setDialog] = useState<DialogType>(null);

  const openDialog = useCallback((type: DialogType) => setDialog(type), []);
  const closeDialog = useCallback(() => setDialog(null), []);

  return { dialog, openDialog, closeDialog };
}
