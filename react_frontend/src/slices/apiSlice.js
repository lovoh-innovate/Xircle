import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { logout } from './authSlice';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${import.meta.env.VITE_API_URL || 'https://xircle.onrender.com'}/api`,
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

// ─── FIX: only log out on 401s that actually mean "this token is
// dead" — invalid, expired, or genuinely missing. protect's three
// failure messages (from authMiddleware.js) are:
//   "Not authorized, no user token"
//   "Not authorized, user token failed"   (jwt.verify threw)
//   "User not found"                       (token valid, user gone)
// A 401 from anything else (a route incorrectly gated, a
// misconfigured endpoint, a transient issue) should NOT nuke a real,
// valid session. This also surfaces — via the console.warn — exactly
// which endpoint/message is 401'ing when you hit Settings, instead of
// silently logging out with no trace.
const AUTH_INVALID_MESSAGES = [
  'Not authorized, no user token',
  'Not authorized, user token failed',
  'User not found',
];

const baseQueryWithReauth = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    const message = result.error.data?.message;
    if (!message || AUTH_INVALID_MESSAGES.includes(message)) {
      api.dispatch(logout());
    } else {
      console.warn('401 received but not treated as auth-invalid:', message, args);
    }
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