// store.js
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice.js";
import { apiSlice } from "./slices/apiSlice.js";

const store = configureStore({
    reducer: {
        auth: authReducer,
        [apiSlice.reducerPath]: apiSlice.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(apiSlice.middleware),
    devTools: true,
});

export const resetStoreAction = () => ({ type: 'RESET' });

// ✅ Export dispatch for use outside React (e.g., push service)
export const dispatch = store.dispatch;
export const getState = store.getState;

export default store;