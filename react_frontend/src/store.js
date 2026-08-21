import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  createTransform,          // 👈 new import
  FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER,
} from 'redux-persist';
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

// ─── Transform: strip volatile queries before they hit localStorage ──
// Everything else in the api cache (tasks, projects, chats, etc.)
// still persists for instant offline-first load, WhatsApp-style.
// Only the app-update check is excluded, so it ALWAYS hits the
// network fresh on launch instead of trusting a stale disk cache.
const apiCacheTransform = createTransform(
  // called right before writing to storage
  (inboundState, key) => {
    if (key !== apiSlice.reducerPath) return inboundState;

    const newQueries = { ...inboundState.queries };
    Object.keys(newQueries).forEach((queryKey) => {
      if (
        queryKey.startsWith('checkAppUpdate') ||
        queryKey.startsWith('getAppVersion') ||
        queryKey.startsWith('getChatMessages')
      ) {
        delete newQueries[queryKey];
      }
    });

    return { ...inboundState, queries: newQueries };
  },
  // called on rehydration — no changes needed here
  (outboundState) => outboundState,
  { whitelist: [apiSlice.reducerPath] }
);

// ─── Persist configuration ──────────────────────────────────────────
const persistConfig = {
  key: 'root-v19',
  storage,
  whitelist: [
    'auth',
    apiSlice.reducerPath,
  ],
  transforms: [apiCacheTransform],   // 👈 wire it in
};

// ─── Combine reducers ──────────────────────────────────────────────
const rootReducer = combineReducers({
  auth: authReducer,
  [apiSlice.reducerPath]: apiSlice.reducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

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

export const persistor = persistStore(store);

export const resetStoreAction = () => ({ type: 'RESET' });

export const resetStore = async () => {
  await persistor.purge();
};

export const dispatch = store.dispatch;
export const getState = store.getState;

export default store;