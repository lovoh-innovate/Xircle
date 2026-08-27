// src/store.js
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice.js';
import { apiSlice } from './slices/apiSlice.js';

// ─── Simplified store — no redux-persist ──────────────────────────────
// Dropped entirely rather than left with an empty whitelist. authSlice
// already reads/writes localStorage directly and synchronously in its
// own initialState — that IS the persistence layer for auth, and it
// has no async rehydration step, so there's nothing left for
// redux-persist to coordinate. Confirmed against a known-working
// reference app that uses this exact pattern with no persist layer at
// all. Removing it also removes PersistGate and the REHYDRATE action
// entirely — one less moving part that could theoretically race in
// the future, not just today.
export const store = configureStore({
  reducer: {
    auth: authReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
  devTools: true,
});

// ─── Reset helper — replaces persistor.purge() ────────────────────────
// Old resetStore() purged redux-persist's storage. Without persist,
// "reset everything" means: clear RTK Query's in-memory cache and let
// authSlice's own logout() (already correct) clear localStorage.
export const resetStore = () => {
  store.dispatch(apiSlice.util.resetApiState());
};

export const dispatch = store.dispatch;
export const getState = store.getState;

export default store;