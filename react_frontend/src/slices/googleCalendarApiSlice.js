// slices/googleCalendarApiSlice.js
import { apiSlice } from './apiSlice';

const GOOGLE_CALENDAR_URL = '/google-calendar';

/**
 * Build the OAuth connect URL. The browser will navigate to this URL
 * directly (not via XHR), so the JWT must ride in the query string —
 * plain navigations don't carry Authorization headers.
 *
 * Usage:
 *   window.location.href = getGoogleCalendarConnectUrl(userInfo?.token);
 *
 * Notes:
 *   - When VITE_API_URL is empty (dev with a Vite proxy), we fall back
 *     to a relative path like `/api/google-calendar/connect?token=...`.
 *     The browser resolves relative URLs fine; we just can't use the
 *     `URL` constructor which demands an absolute base.
 */
export const getGoogleCalendarConnectUrl = (token) => {
  const rawBase = (import.meta?.env?.VITE_API_URL || '').replace(/\/$/, '');

  // Normalize to exactly one `/api` prefix, no trailing slash.
  let prefix;
  if (!rawBase) {
    prefix = '/api';
  } else if (rawBase.endsWith('/api')) {
    prefix = rawBase;
  } else {
    prefix = `${rawBase}/api`;
  }

  const qs = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${prefix}${GOOGLE_CALENDAR_URL}/connect${qs}`;
};

export const googleCalendarApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Connection status ─────────────────────────────────────────
    getGoogleCalendarStatus: builder.query({
      query: () => ({
        url: `${GOOGLE_CALENDAR_URL}/status`,
      }),
      providesTags: ['GoogleCalendar'],
      keepUnusedDataFor: 300,
    }),

    // ─── Disconnect ────────────────────────────────────────────────
    disconnectGoogleCalendar: builder.mutation({
      query: () => ({
        url: `${GOOGLE_CALENDAR_URL}/disconnect`,
        method: 'POST',
      }),
      invalidatesTags: ['GoogleCalendar'],
    }),
  }),
});

export const {
  useGetGoogleCalendarStatusQuery,
  useLazyGetGoogleCalendarStatusQuery,
  useDisconnectGoogleCalendarMutation,
} = googleCalendarApiSlice;