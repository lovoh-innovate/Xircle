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
    'AppVersion',
    'PublicGroup',
    'JoinRequest',
    'Member',
    'Notification',
    'NotificationPreferences',
    'PersonalFolder',
    'PersonalTask',
    'Folder',
    'Call',
  ],
  refetchOnReconnect: true,
  refetchOnMountOrArgChange: 30,   // 👈 was `true`. Now: only refetch if cache older than 30s
  refetchOnFocus: true,            // 👈 new: silently refetch when app comes back to foreground
  keepUnusedDataFor: 604800, // 7 days
  endpoints: (builder) => ({}),
});