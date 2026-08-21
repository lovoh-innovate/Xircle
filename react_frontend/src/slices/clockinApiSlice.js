// slices/clockInApiSlice.js
import { apiSlice } from './apiSlice';

const CLOCKIN_URL = '/clockin';

export const clockInApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({

    // ─── Settings ──────────────────────────────────────────────────────

    getClockInSettings: builder.query({
      query: (workspaceId) => ({
        url: `${CLOCKIN_URL}/${workspaceId}/clockin-settings`,
      }),
      providesTags: (result, error, workspaceId) => [
        { type: 'ClockInSettings', id: workspaceId },
      ],
    }),

    setClockInSettings: builder.mutation({
      query: ({ workspaceId, clockInTime, closingTime, clockInEnabled }) => ({
        url: `${CLOCKIN_URL}/${workspaceId}/clockin-settings`,
        method: 'PUT',
        body: { clockInTime, closingTime, clockInEnabled },
      }),
      invalidatesTags: (result, error, { workspaceId }) => [
        { type: 'ClockInSettings', id: workspaceId },
      ],
    }),

    // ─── Clock‑in / out ──────────────────────────────────────────────

    clockIn: builder.mutation({
      query: (workspaceId) => ({
        url: `${CLOCKIN_URL}/${workspaceId}/clockin`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, workspaceId) => [
        { type: 'ClockIn', id: workspaceId },
        { type: 'ClockInHistory', id: workspaceId },
        { type: 'ClockInLeaderboard', id: workspaceId },
      ],
    }),

    clockOut: builder.mutation({
      query: (workspaceId) => ({
        url: `${CLOCKIN_URL}/${workspaceId}/clockout`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, workspaceId) => [
        { type: 'ClockIn', id: workspaceId },
        { type: 'ClockInHistory', id: workspaceId },
        { type: 'ClockInLeaderboard', id: workspaceId },
      ],
    }),

    // ─── History ──────────────────────────────────────────────────────

    getUserClockInHistory: builder.query({
      query: ({ workspaceId, page = 1, limit = 20 }) => ({
        url: `${CLOCKIN_URL}/${workspaceId}/clockin/history`,
        params: { page, limit },
      }),
      providesTags: (result, error, { workspaceId }) => [
        { type: 'ClockInHistory', id: workspaceId },
      ],
    }),

    // ─── Admin/owner: all clock‑ins for workspace ──────────────────

    getWorkspaceClockIns: builder.query({
      query: ({ workspaceId, date, page = 1, limit = 30 }) => ({
        url: `${CLOCKIN_URL}/${workspaceId}/clockins`,
        params: { date, page, limit },
      }),
      providesTags: (result, error, { workspaceId }) => [
        { type: 'WorkspaceClockIns', id: workspaceId },
      ],
    }),

    // ─── Leaderboard ─────────────────────────────────────────────────

    getClockInLeaderboard: builder.query({
      query: ({ workspaceId, period = 'month' }) => ({
        url: `${CLOCKIN_URL}/${workspaceId}/leaderboard`,
        params: { period },
      }),
      providesTags: (result, error, { workspaceId }) => [
        { type: 'ClockInLeaderboard', id: workspaceId },
      ],
    }),

    // ─── Monthly leaderboard report (trigger manually) ─────────────

    triggerMonthlyLeaderboard: builder.mutation({
      query: (workspaceId) => ({
        url: `${CLOCKIN_URL}/${workspaceId}/leaderboard/monthly`,
        method: 'POST',
      }),
    }),

  }),
});

export const {
  useGetClockInSettingsQuery,
  useSetClockInSettingsMutation,
  useClockInMutation,
  useClockOutMutation,
  useGetUserClockInHistoryQuery,
  useGetWorkspaceClockInsQuery,
  useGetClockInLeaderboardQuery,
  useTriggerMonthlyLeaderboardMutation,
} = clockInApiSlice;