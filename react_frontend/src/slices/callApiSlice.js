// src/slices/callApiSlice.js
import { apiSlice } from './apiSlice';

const CALLS_URL = '/calls';

// ─────────────────────────────────────────────────────────────
// Small helpers — build FormData for the audio endpoints
// ─────────────────────────────────────────────────────────────
const toAudioFormData = (audio, filename = 'audio.webm') => {
  const form = new FormData();
  form.append('audio', audio, filename);
  return form;
};

export const callApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ─────────────────────────────────────────────────────────
    // Call initiation
    // ─────────────────────────────────────────────────────────

    initiateCall: builder.mutation({
      query: (data) => ({
        url: `${CALLS_URL}/initiate`,
        method: 'POST',
        body: data, // { workspaceId, type, participantIds }
      }),
      invalidatesTags: ['Call', 'CallLog', 'OngoingCall'],
    }),

    initiateDirectCall: builder.mutation({
      query: (data) => ({
        url: `${CALLS_URL}/direct`,
        method: 'POST',
        body: data, // { username, type }
      }),
      invalidatesTags: ['Call', 'CallLog', 'OngoingCall'],
    }),

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

    joinCall: builder.mutation({
      query: (callId) => ({
        url: `${CALLS_URL}/${callId}/join`,
        method: 'PUT',
      }),
      invalidatesTags: ['Call', 'CallLog', 'OngoingCall'],
    }),

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

    leaveCall: builder.mutation({
      query: (callId) => ({
        url: `${CALLS_URL}/${callId}/leave`,
        method: 'PUT',
      }),
      invalidatesTags: ['Call', 'CallLog', 'OngoingCall'],
    }),

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
        body: { usernames },
      }),
      invalidatesTags: ['Call', 'OngoingCall'],
    }),

    // ─────────────────────────────────────────────────────────
    // LiveKit token (for an accepted participant)
    // Returns {
    //   success, token, url, roomId, callId, type,
    //   isMeeting, isDirect, workspaceId, meetingCode, meetingLink,
    //   creatorId, startedAt, durationSec,
    //   dataSaver, ai, liveSummary, recentTranscript, recentMessages,
    //   raisedHands, participants, guests
    // }
    // Pass { callId, quality? } — quality forces low-bandwidth on this join.
    // ─────────────────────────────────────────────────────────
    getCallToken: builder.mutation({
      query: (arg) => {
        const callId = typeof arg === 'string' ? arg : arg?.callId;
        const quality = typeof arg === 'object' ? arg?.quality : undefined;
        return {
          url: `${CALLS_URL}/${callId}/token`,
          method: 'POST',
          params: quality ? { quality } : undefined,
        };
      },
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

    // Back-compat alias
    getCallHistory: builder.query({
      query: (workspaceId) => ({
        url: `${CALLS_URL}/history`,
        params: workspaceId ? { workspaceId } : {},
      }),
      providesTags: (result, error, workspaceId) => [
        { type: 'CallLog', id: workspaceId || 'ME' },
      ],
    }),

    getOngoingCalls: builder.query({
      query: (workspaceId) => ({
        url: `${CALLS_URL}/ongoing`,
        params: workspaceId ? { workspaceId } : {},
      }),
      providesTags: (result, error, workspaceId) => [
        { type: 'OngoingCall', id: workspaceId || 'ME' },
      ],
    }),

    getCallById: builder.query({
      query: (callId) => ({
        url: `${CALLS_URL}/${callId}`,
      }),
      providesTags: (result, error, callId) => [{ type: 'Call', id: callId }],
    }),

    // ═════════════════════════════════════════════════════════
    // Public meeting state (read-only, NO AUTH REQUIRED)
    // ═════════════════════════════════════════════════════════
    //
    // Backing endpoint: GET /calls/public/:code/state
    //
    // ⚠️ This endpoint is mounted BEFORE `router.use(protect)` on
    // the server, so no `Authorization` header is required. Because
    // RTK Query's baseQuery may or may not attach auth headers
    // depending on how your `baseQueryWithReauth` is implemented,
    // the safest caller is a **guest** using raw `fetch`
    // (see JoinCall.jsx) — that's exactly what the guest screen does.
    //
    // The hook below is primarily for logged-in users who want to
    // poll the same endpoint (e.g. a preview tile that isn't inside
    // the call). Guests don't need this hook; they use raw fetch.
    //
    // Response shape:
    // {
    //   success,
    //   ai: { enabled, transcriptCount, generatedNoteId, generatedNoteKind, summaryUpdatedAt },
    //   liveSummary: { text, keyPoints, actionItems, updatedAt } | null,
    //   recentTranscript: [{ speakerName, text, at }],
    //   recentMessages:  [{ sender, senderName, content, kind, createdAt }],
    //   raisedHands:     [{ userId, raisedAt }],
    //   durationSec: number
    // }
    // ─────────────────────────────────────────────────────────
    getPublicMeetingState: builder.query({
      query: (code) => ({
        url: `${CALLS_URL}/public/${encodeURIComponent(code)}/state`,
      }),
      // No automatic polling here — the caller decides the cadence
      // (see JoinCall.jsx: 15s interval).
      providesTags: (result, error, code) => [
        { type: 'Call', id: `public:${code}` },
      ],
    }),

    // ═════════════════════════════════════════════════════════
    // AI + LIVE NOTES
    // ═════════════════════════════════════════════════════════
    //
    // Real-time AI/meeting events (transcript updates, summary
    // refreshes, in-call chat, hands, reactions) are pushed over
    // socket.io — so most of these mutations deliberately do NOT
    // invalidate `Call` (that would cause a refetch storm).
    // Only start / stop / finalize / data-saver invalidate.
    // ═════════════════════════════════════════════════════════

    startCallAI: builder.mutation({
      query: ({ callId, noteDestination }) => ({
        url: `${CALLS_URL}/${callId}/ai/start`,
        method: 'POST',
        body: noteDestination ? { noteDestination } : {},
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'Call', id: arg?.callId },
      ],
    }),

    stopCallAI: builder.mutation({
      query: (callId) => ({
        url: `${CALLS_URL}/${callId}/ai/stop`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, callId) => [
        { type: 'Call', id: callId },
        ...(result?.created ? [{ type: 'CallLog' }] : []),
      ],
    }),

    finalizeCallNotes: builder.mutation({
      query: (callId) => ({
        url: `${CALLS_URL}/${callId}/ai/finalize`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, callId) => [
        { type: 'Call', id: callId },
        ...(result?.created ? [{ type: 'CallLog' }] : []),
      ],
    }),

    pushCallTranscript: builder.mutation({
      query: ({ callId, segments }) => ({
        url: `${CALLS_URL}/${callId}/transcript`,
        method: 'POST',
        body: { segments },
      }),
    }),

    pushCallAudioChunk: builder.mutation({
      query: ({ callId, audio, filename }) => ({
        url: `${CALLS_URL}/${callId}/transcript/audio`,
        method: 'POST',
        body: toAudioFormData(audio, filename || 'chunk.webm'),
      }),
    }),

    askCallAIText: builder.mutation({
      query: ({ callId, question, wantAudio = false }) => ({
        url: `${CALLS_URL}/${callId}/ai/ask`,
        method: 'POST',
        body: { question, wantAudio },
      }),
    }),

    askCallAIVoice: builder.mutation({
      query: ({ callId, audio, filename }) => ({
        url: `${CALLS_URL}/${callId}/ai/ask-voice`,
        method: 'POST',
        body: toAudioFormData(audio, filename || 'question.webm'),
      }),
    }),

    sendInCallMessage: builder.mutation({
      query: ({ callId, content }) => ({
        url: `${CALLS_URL}/${callId}/messages`,
        method: 'POST',
        body: { content },
      }),
    }),

    setRaisedHand: builder.mutation({
      query: ({ callId, raised }) => ({
        url: `${CALLS_URL}/${callId}/hand`,
        method: 'POST',
        body: { raised: !!raised },
      }),
    }),

    sendCallReaction: builder.mutation({
      query: ({ callId, emoji }) => ({
        url: `${CALLS_URL}/${callId}/reaction`,
        method: 'POST',
        body: { emoji },
      }),
    }),

    updateCallDataSaver: builder.mutation({
      query: ({ callId, ...patch }) => ({
        url: `${CALLS_URL}/${callId}/data-saver`,
        method: 'PATCH',
        body: patch,
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'Call', id: arg?.callId },
      ],
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

  // Mutations — AI + live notes
  useStartCallAIMutation,
  useStopCallAIMutation,
  useFinalizeCallNotesMutation,
  usePushCallTranscriptMutation,
  usePushCallAudioChunkMutation,
  useAskCallAITextMutation,
  useAskCallAIVoiceMutation,
  useSendInCallMessageMutation,
  useSetRaisedHandMutation,
  useSendCallReactionMutation,
  useUpdateCallDataSaverMutation,

  // Queries
  useGetScheduledCallsQuery,
  useGetCallLogsQuery,
  useGetCallHistoryQuery,
  useGetOngoingCallsQuery,
  useGetCallByIdQuery,

  // Query — public meeting state (no auth required server-side)
  useGetPublicMeetingStateQuery,
} = callApiSlice;