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
  'AppVersion', // ✅ was missing — this is why upload/delete didn't reflect live
],
  // ─── Caching / freshness settings ───────────────────────────────
  refetchOnReconnect: true,          // refetch when network comes back
  refetchOnMountOrArgChange: true,   // ✅ correct option name (was `refetchOnMount` — a no-op typo)
  keepUnusedDataFor: 60,             // 60s is plenty; 86400 basically meant "never expire"
  endpoints: (builder) => ({}),
});