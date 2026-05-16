import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';

interface ContainedScrollContextValue {
  lockOuterScroll: () => void;
  unlockOuterScroll: () => void;
}

const ContainedScrollContext = createContext<ContainedScrollContextValue>({
  lockOuterScroll: () => {},
  unlockOuterScroll: () => {},
});

interface ContainedScrollProviderProps {
  children: React.ReactNode;
  setOuterScrollEnabled: (enabled: boolean) => void;
}

export function ContainedScrollProvider({
  children,
  setOuterScrollEnabled,
}: ContainedScrollProviderProps) {
  const lockCountRef = useRef(0);

  const lockOuterScroll = useCallback(() => {
    lockCountRef.current += 1;
    if (lockCountRef.current === 1) {
      setOuterScrollEnabled(false);
    }
  }, [setOuterScrollEnabled]);

  const unlockOuterScroll = useCallback(() => {
    lockCountRef.current = Math.max(0, lockCountRef.current - 1);
    if (lockCountRef.current === 0) {
      setOuterScrollEnabled(true);
    }
  }, [setOuterScrollEnabled]);

  const value = useMemo(() => ({
    lockOuterScroll,
    unlockOuterScroll,
  }), [lockOuterScroll, unlockOuterScroll]);

  return (
    <ContainedScrollContext.Provider value={value}>
      {children}
    </ContainedScrollContext.Provider>
  );
}

export function useContainedScrollLock() {
  return useContext(ContainedScrollContext);
}
