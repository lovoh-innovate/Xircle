import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const baseQuery = fetchBaseQuery({
  baseUrl: `${import.meta.env.VITE_API_URL || ''}/api`,
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.userInfo?.token;

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  },
});

export const apiSlice = createApi({
  baseQuery,
  tagTypes: [
    'User',
    'Workspace',
    'Project',
    'Task',
    'Chat',
    'Message',
    'Typing',
    'UserSearch',
    'Team',
    'Membership',
    'PendingRequests',
  ],
  // ─── Offline‑first caching settings ──────────────────────────────
  refetchOnReconnect: true,    // automatically refetch when network comes back
  refetchOnMount: true,        // refetch when a component mounts (optional, but good for fresh data)
  keepUnusedDataFor: 60 * 60 * 24, // keep cached data in memory for 24 hours (86400 seconds)
  endpoints: (builder) => ({}),
});