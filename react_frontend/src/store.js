import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER,
} from 'redux-persist';
import authReducer from './slices/authSlice.js';
import { apiSlice } from './slices/apiSlice.js';

// ─── Custom storage adapter (uses localStorage) ──────────────────────
// Kept only so `persistor`/`PersistGate` (if wired up in main.jsx) keep
// working without breaking imports elsewhere — but see persistConfig
// below: whitelist is now empty, so this adapter has nothing to do.
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
// ⚠️ WHY THIS CHANGED — root cause of the "random unauthorized / users
// getting logged out" reports:
//
// `authSlice.js` already manages its OWN localStorage copy of the
// token: it reads `localStorage.getItem('userInfo')` synchronously in
// its initialState, and writes directly in setCredentials/logout. That
// makes it correct and race-free from the very first render — no
// rehydration wait needed.
//
// redux-persist was ALSO persisting the same `auth` slice separately,
// under its own key, on its own debounced async schedule. Two
// unsynchronized copies of the same data means: on reload, authSlice's
// synchronous read is correct, but the async REHYDRATE that follows a
// moment later can overwrite it with a STALE copy (e.g. if a
// login/logout happened right before reload and persist's debounced
// write hadn't flushed yet). That stale overwrite sets userInfo back
// to null for a real, logged-in user → any request made in that window
// gets a 401 → baseQueryWithReauth's `dispatch(logout())` then clears
// the REAL, correct token too. A rehydration race becomes a permanent
// logout. This is what your users were hitting.
//
// Fix: `auth` is no longer in the whitelist. authSlice is now the
// single source of truth for the token — synchronous, no race, no
// second copy to go stale.
//
// Also dropping `apiSlice.reducerPath`: persisting RTK Query's cache to
// localStorage doesn't give you real offline support (that needs
// SQLite/Capacitor storage), it just adds another layer that can go
// stale. RTK Query's normal in-memory cache (keepUnusedDataFor) still
// works exactly as before within a session — this only stops writing
// it to disk.
const persistConfig = {
  key: 'root-v42',
  storage,
  whitelist: [], // nothing persisted via redux-persist anymore
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