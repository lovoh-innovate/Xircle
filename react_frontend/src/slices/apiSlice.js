// apiSlice.js
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
  endpoints: (builder) => ({}),
});