// src/slices/notificationApiSlice.js
import { apiSlice } from './apiSlice';

const NOTIFICATIONS_URL = '/notifications';

export const notificationApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Preferences ──────────────────────────────────────────────
    getNotificationPreferences: builder.query({
      query: () => `${NOTIFICATIONS_URL}/preferences`,
      providesTags: ['NotificationPreferences'],
    }),
    updateEmailNotifications: builder.mutation({
      query: (data) => ({
        url: `${NOTIFICATIONS_URL}/preferences/email`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['NotificationPreferences'],
    }),
    updatePushNotifications: builder.mutation({
      query: (data) => ({
        url: `${NOTIFICATIONS_URL}/preferences/push`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['NotificationPreferences'],
    }),

    // ─── Device token registration ────────────────────────────────
    registerWebPush: builder.mutation({
      query: (data) => ({
        url: `${NOTIFICATIONS_URL}/register/web`,
        method: 'POST',
        body: data, // { subscription, deviceType }
      }),
    }),
    registerMobileToken: builder.mutation({
      query: (data) => ({
        url: `${NOTIFICATIONS_URL}/register/mobile`,
        method: 'POST',
        body: data, // { fcmToken, deviceType, platform, action? }
      }),
    }),

    // ─── Test endpoints ───────────────────────────────────────────
    sendTestPush: builder.mutation({
      query: () => ({
        url: `${NOTIFICATIONS_URL}/test/push`,
        method: 'POST',
      }),
    }),
    sendTestEmail: builder.mutation({
      query: () => ({
        url: `${NOTIFICATIONS_URL}/test/email`,
        method: 'POST',
      }),
    }),

    // ─── VAPID public key ─────────────────────────────────────────
    getVapidPublicKey: builder.query({
      query: () => `${NOTIFICATIONS_URL}/vapid-public-key`,
    }),

    // ─── In‑app notifications ─────────────────────────────────────
    getUserNotifications: builder.query({
      query: ({ page = 1, limit = 20, unreadOnly } = {}) => ({
        url: NOTIFICATIONS_URL,
        params: { page, limit, unreadOnly },
      }),
      providesTags: ['Notification'],
    }),
    markNotificationRead: builder.mutation({
      query: (id) => ({
        url: `${NOTIFICATIONS_URL}/${id}/read`,
        method: 'PUT',
      }),
      invalidatesTags: ['Notification'],
    }),
    markAllNotificationsRead: builder.mutation({
      query: () => ({
        url: `${NOTIFICATIONS_URL}/read-all`,
        method: 'PUT',
      }),
      invalidatesTags: ['Notification'],
    }),
  }),
});

export const {
  useGetNotificationPreferencesQuery,
  useUpdateEmailNotificationsMutation,
  useUpdatePushNotificationsMutation,
  useRegisterWebPushMutation,
  useRegisterMobileTokenMutation,
  useSendTestPushMutation,
  useSendTestEmailMutation,
  useGetVapidPublicKeyQuery,
  useGetUserNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationApiSlice;