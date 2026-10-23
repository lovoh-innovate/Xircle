// src/slices/callApiSlice.js
import { apiSlice } from './apiSlice';

const CALLS_URL = '/calls';

export const callApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ─────────────────────────────────────────────────────────
    // Call initiation
    // ─────────────────────────────────────────────────────────

    // Workspace call (voice / video) to one or more workspace members
    initiateCall: builder.mutation({
      query: (data) => ({
        url: `${CALLS_URL}/initiate`,
        method: 'POST',
        body: data, // { workspaceId, type, participantIds }
      }),
      invalidatesTags: ['Call', 'CallLog', 'OngoingCall'],
    }),

    // 1-on-1 direct call outside a workspace (by username)
    initiateDirectCall: builder.mutation({
      query: (data) => ({
        url: `${CALLS_URL}/direct`,
        method: 'POST',
        body: data, // { username, type }
      }),
      invalidatesTags: ['Call', 'CallLog', 'OngoingCall'],
    }),

    // Create a shareable meeting link (optional workspace)
    createMeeting: builder.mutation({
      query: (data) => ({
        url: `${CALLS_URL}/meeting`,
        method: 'POST',
        body: data, // { workspaceId?, type, participantIds? }
      }),
      invalidatesTags: ['Call', 'CallLog', 'OngoingCall'],
    }),

    // ─────────────────────────────────────────────────────────
    // Scheduling
    // ─────────────────────────────────────────────────────────

    scheduleCall: builder.mutation({
      query: (data) => ({
        url: `${CALLS_URL}/schedule`,
        method: 'POST',
        body: data, // { workspaceId, type, participantIds, scheduledAt }
      }),
      invalidatesTags: ['Call', 'ScheduledCall'],
    }),

    cancelScheduledCall: builder.mutation({
      query: (callId) => ({
        url: `${CALLS_URL}/${callId}/cancel`,
        method: 'PUT',
      }),
      invalidatesTags: ['Call', 'ScheduledCall', 'CallLog'],
    }),

    // ─────────────────────────────────────────────────────────
    // Join / leave / reject / end
    // ─────────────────────────────────────────────────────────

    // Join by callId (works for ringing / ongoing / late joins)
    joinCall: builder.mutation({
      query: (callId) => ({
        url: `${CALLS_URL}/${callId}/join`,
        method: 'PUT',
      }),
      invalidatesTags: ['Call', 'CallLog', 'OngoingCall'],
    }),

    // Join by meeting code (logged-in user clicking a shared link)
    joinByMeetingCode: builder.mutation({
      query: (code) => ({
        url: `${CALLS_URL}/by-code/${code}/join`,
        method: 'GET',
      }),
      invalidatesTags: ['Call', 'CallLog', 'OngoingCall'],
    }),

    rejectCall: builder.mutation({
      query: (callId) => ({
        url: `${CALLS_URL}/${callId}/reject`,
        method: 'PUT',
      }),
      invalidatesTags: ['Call', 'CallLog'],
    }),

    // Leave a call WITHOUT ending it for everyone (group calls)
    leaveCall: builder.mutation({
      query: (callId) => ({
        url: `${CALLS_URL}/${callId}/leave`,
        method: 'PUT',
      }),
      invalidatesTags: ['Call', 'CallLog', 'OngoingCall'],
    }),

    // Force-end the call for everyone (host / last participant)
    endCall: builder.mutation({
      query: (callId) => ({
        url: `${CALLS_URL}/${callId}/end`,
        method: 'PUT',
      }),
      invalidatesTags: ['Call', 'CallLog', 'OngoingCall'],
    }),

    // ─────────────────────────────────────────────────────────
    // Invitations
    // ─────────────────────────────────────────────────────────

    inviteToCall: builder.mutation({
      query: ({ callId, inviteUserIds }) => ({
        url: `${CALLS_URL}/${callId}/invite`,
        method: 'POST',
        body: { inviteUserIds },
      }),
      invalidatesTags: ['Call', 'OngoingCall'],
    }),

    inviteByUsername: builder.mutation({
      query: ({ callId, usernames }) => ({
        url: `${CALLS_URL}/${callId}/invite-username`,
        method: 'POST',
        body: { usernames }, // array of @usernames (without '@')
      }),
      invalidatesTags: ['Call', 'OngoingCall'],
    }),

    // ─────────────────────────────────────────────────────────
    // LiveKit token (for an accepted participant)
    // Returns { success, token, url, roomId, callId, type }
    // ─────────────────────────────────────────────────────────
    getCallToken: builder.mutation({
      query: (callId) => ({
        url: `${CALLS_URL}/${callId}/token`,
        method: 'POST',
      }),
      invalidatesTags: ['Call'],
    }),

    // ─────────────────────────────────────────────────────────
    // Read / list endpoints
    // ─────────────────────────────────────────────────────────

    getScheduledCalls: builder.query({
      query: (workspaceId) => ({
        url: `${CALLS_URL}/scheduled`,
        params: workspaceId ? { workspaceId } : {},
      }),
      providesTags: (result, error, workspaceId) => [
        { type: 'ScheduledCall', id: workspaceId || 'ALL' },
      ],
    }),

    // Full call logs (workspace OR personal):
    //   - with workspaceId:   all workspace calls
    //   - without:            calls the current user is in
    // Params: { workspaceId?, status?, limit? }
    //   status can be 'ongoing' | 'ended' | 'missed' | 'ringing'
    getCallLogs: builder.query({
      query: ({ workspaceId, status, limit } = {}) => ({
        url: `${CALLS_URL}/logs`,
        params: {
          ...(workspaceId ? { workspaceId } : {}),
          ...(status ? { status } : {}),
          ...(limit ? { limit } : {}),
        },
      }),
      providesTags: (result, error, arg) => [
        { type: 'CallLog', id: arg?.workspaceId || 'ME' },
      ],
    }),

    // Back-compat: old route, kept as alias for getCallLogs
    getCallHistory: builder.query({
      query: (workspaceId) => ({
        url: `${CALLS_URL}/history`,
        params: workspaceId ? { workspaceId } : {},
      }),
      providesTags: (result, error, workspaceId) => [
        { type: 'CallLog', id: workspaceId || 'ME' },
      ],
    }),

    // Quick "join now" panel — ringing + ongoing calls only
    getOngoingCalls: builder.query({
      query: (workspaceId) => ({
        url: `${CALLS_URL}/ongoing`,
        params: workspaceId ? { workspaceId } : {},
      }),
      providesTags: (result, error, workspaceId) => [
        { type: 'OngoingCall', id: workspaceId || 'ME' },
      ],
    }),

    // Single call by ID (deep-link support, refreshers)
    getCallById: builder.query({
      query: (callId) => ({
        url: `${CALLS_URL}/${callId}`,
      }),
      providesTags: (result, error, callId) => [{ type: 'Call', id: callId }],
    }),
  }),
});

export const {
  // Mutations — calls
  useInitiateCallMutation,
  useInitiateDirectCallMutation,
  useCreateMeetingMutation,
  useScheduleCallMutation,
  useCancelScheduledCallMutation,
  useJoinCallMutation,
  useJoinByMeetingCodeMutation,
  useRejectCallMutation,
  useLeaveCallMutation,
  useEndCallMutation,
  useInviteToCallMutation,
  useInviteByUsernameMutation,
  useGetCallTokenMutation,

  // Queries
  useGetScheduledCallsQuery,
  useGetCallLogsQuery,
  useGetCallHistoryQuery,
  useGetOngoingCallsQuery,
  useGetCallByIdQuery,
} = callApiSlice;