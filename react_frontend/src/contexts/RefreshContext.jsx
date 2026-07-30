// contexts/RefreshContext.jsx
import React, { createContext, useContext, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { apiSlice } from '../slices/apiSlice'; // ✅ correct named import

const RefreshContext = createContext(null);

export const RefreshProvider = ({ children }) => {
  const dispatch = useDispatch();

  const refreshAll = useCallback(() => {
    // Invalidate all common tags using the apiSlice utility
    dispatch(apiSlice.util.invalidateTags([
      'Workspace',
      'Project',
      'Task',
      'Chat',
      'Member',
      'Message',
      'Team',
    ]));
  }, [dispatch]);

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