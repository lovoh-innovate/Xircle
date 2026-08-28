// contexts/RefreshContext.jsx
import React, { createContext, useContext, useCallback } from 'react';
import { syncManager } from '../sync/syncManager';

const RefreshContext = createContext(null);

export const RefreshProvider = ({ children }) => {
  const refreshAll = useCallback(async () => {
    // 1. Fetch latest changes from server
    await syncManager.backgroundSync();
    // 2. Process any pending outgoing operations (outbox)
    await syncManager.processOutbox();
  }, []);

  return (
    <RefreshContext.Provider value={{ refreshAll }}>
      {children}
    </RefreshContext.Provider>
  );
};

export const useRefresh = () => {
  const ctx = useContext(RefreshContext);
  if (!ctx) throw new Error('useRefresh must be used within RefreshProvider');
  return ctx;
};