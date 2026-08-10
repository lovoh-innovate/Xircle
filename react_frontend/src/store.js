import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import authReducer from './slices/authSlice.js';
import { apiSlice } from './slices/apiSlice.js';

// ─── Custom storage adapter (uses localStorage) ──────────────────────
const storage = {
  getItem: (key) => {
    try {
      const value = localStorage.getItem(key);
      return Promise.resolve(value);
    } catch (err) {
      return Promise.resolve(null);
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
      return Promise.resolve();
    } catch (err) {
      return Promise.resolve();
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
      return Promise.resolve();
    } catch (err) {
      return Promise.resolve();
    }
  },
};

// ─── Persist configuration ──────────────────────────────────────────
// Bump the key to drop any previous stale state (if needed).
const persistConfig = {
  key: 'root-v3',           // <-- bumped version; change as needed
  storage,
  // ✅ Persist both auth AND the API cache
  whitelist: [
    'auth',
    apiSlice.reducerPath,   // 👈 this stores all fetched data (tasks, projects, etc.)
  ],
};

// ─── Combine reducers ──────────────────────────────────────────────
const rootReducer = combineReducers({
  auth: authReducer,
  [apiSlice.reducerPath]: apiSlice.reducer,
});

// ─── Persisted reducer ─────────────────────────────────────────────
const persistedReducer = persistReducer(persistConfig, rootReducer);

// ─── Store creation ────────────────────────────────────────────────
const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(apiSlice.middleware),
  devTools: true,
});

// ─── Persistor ──────────────────────────────────────────────────────
export const persistor = persistStore(store);

// ─── Reset helpers ──────────────────────────────────────────────────
export const resetStoreAction = () => ({ type: 'RESET' });

export const resetStore = async () => {
  await persistor.purge();
  // Optionally clear all localStorage keys
  // localStorage.clear();
};

export const dispatch = store.dispatch;
export const getState = store.getState;

export default store;