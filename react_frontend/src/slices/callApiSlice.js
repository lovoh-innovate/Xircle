// src/slices/callApiSlice.js
import { apiSlice } from './apiSlice';

const CALLS_URL = '/calls';

export const callApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Initiate an immediate call
    initiateCall: builder.mutation({
      query: (data) => ({
        url: `${CALLS_URL}/initiate`,
        method: 'POST',
        body: data, // { workspaceId, type, participantIds }
      }),
      invalidatesTags: ['Call'],
    }),

    // Schedule a future call
    scheduleCall: builder.mutation({
      query: (data) => ({
        url: `${CALLS_URL}/schedule`,
        method: 'POST',
        body: data, // { workspaceId, type, participantIds, scheduledAt }
      }),
      invalidatesTags: ['Call'],
    }),

    // Join a ringing or ongoing call
    joinCall: builder.mutation({
      query: (callId) => ({
        url: `${CALLS_URL}/${callId}/join`,
        method: 'PUT',
      }),
      invalidatesTags: ['Call'],
    }),

    // Reject an incoming call
    rejectCall: builder.mutation({
      query: (callId) => ({
        url: `${CALLS_URL}/${callId}/reject`,
        method: 'PUT',
      }),
      invalidatesTags: ['Call'],
    }),

    // End an active call
    endCall: builder.mutation({
      query: (callId) => ({
        url: `${CALLS_URL}/${callId}/end`,
        method: 'PUT',
      }),
      invalidatesTags: ['Call'],
    }),

    // Cancel a scheduled call
    cancelScheduledCall: builder.mutation({
      query: (callId) => ({
        url: `${CALLS_URL}/${callId}/cancel`,
        method: 'PUT',
      }),
      invalidatesTags: ['Call'],
    }),

    // ✅ NEW: Invite / re‑ring additional participants to an ongoing call
    inviteToCall: builder.mutation({
      query: ({ callId, inviteUserIds }) => ({
        url: `${CALLS_URL}/${callId}/invite`,
        method: 'POST',
        body: { inviteUserIds },
      }),
      invalidatesTags: ['Call'],
    }),

    // Get upcoming scheduled calls
    getScheduledCalls: builder.query({
      query: (workspaceId) => ({
        url: `${CALLS_URL}/scheduled`,
        params: { workspaceId },
      }),
      providesTags: ['Call'],
    }),

    // Get call history
    getCallHistory: builder.query({
      query: (workspaceId) => ({
        url: `${CALLS_URL}/history`,
        params: { workspaceId },
      }),
      providesTags: ['Call'],
    }),
  }),
});

export const {
  useInitiateCallMutation,
  useScheduleCallMutation,
  useJoinCallMutation,
  useRejectCallMutation,
  useEndCallMutation,
  useCancelScheduledCallMutation,
  useInviteToCallMutation,        // ← new export
  useGetScheduledCallsQuery,
  useGetCallHistoryQuery,
} = callApiSlice;