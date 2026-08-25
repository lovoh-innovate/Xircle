import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { logout } from './authSlice';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${import.meta.env.VITE_API_URL || ''}/api`,
  credentials: 'omit', // ← was 'include'. We don't need cross-site cookies at all —
                        // auth is carried entirely by the Authorization header below,
                        // which is immune to Safari's cross-site cookie blocking.
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.userInfo?.token;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

const baseQueryWithReauth = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    // Token missing/expired/invalid — clear state so the user lands back on
    // a clean login screen instead of getting stuck on "unauthorized" forever.
    api.dispatch(logout());
  }

  return result;
};

export const apiSlice = createApi({
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'User', 'Workspace', 'Project', 'Task', 'Chat', 'Message', 'Typing',
    'UserSearch', 'Team', 'Membership', 'PendingRequests', 'AppVersion',
    'PublicGroup', 'JoinRequest', 'Member', 'Notification',
    'NotificationPreferences', 'PersonalFolder', 'PersonalTask', 'Folder', 'Call',
  ],
  refetchOnReconnect: true,
  refetchOnMountOrArgChange: 30,
  refetchOnFocus: true,
  keepUnusedDataFor: 604800,
  endpoints: (builder) => ({}),
});