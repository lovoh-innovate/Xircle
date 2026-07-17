// src/slices/messagingApiSlice.js
import { apiSlice } from './apiSlice';

const MESSAGING_URL = '/messages';

export const messagingApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({

    // ─── Create Group Chat ────────────────────────────────────────────────
    createGroupChat: builder.mutation({
      query: (data) => ({
        url: `${MESSAGING_URL}/group`,
        method: 'POST',
        body: data, // { workspaceId, name, avatar? }
      }),
      invalidatesTags: ['Chat', 'Message'],
    }),

    // ─── Create Direct Chat ──────────────────────────────────────────────
    createDirectChat: builder.mutation({
      query: (data) => ({
        url: `${MESSAGING_URL}/direct`,
        method: 'POST',
        body: data, // { workspaceId, targetUserId }
      }),
      invalidatesTags: ['Chat'],
    }),

    // ─── Get User Chats ──────────────────────────────────────────────────
    getUserChats: builder.query({
      query: (workspaceId) => ({
        url: `${MESSAGING_URL}/chats`,
        params: { workspaceId },
      }),
      providesTags: ['Chat'],
    }),

    // ─── Online Status ──────────────────────────────────────────────────
    updateOnlineStatus: builder.mutation({
      query: (data) => ({
        url: `${MESSAGING_URL}/online-status`,
        method: 'POST',
        body: data, // { workspaceId, isOnline }
      }),
    }),

    // ─── Get Chat Messages ──────────────────────────────────────────────
    getChatMessages: builder.query({
      query: ({ chatId, page = 1, limit = 50 }) => ({
        url: `${MESSAGING_URL}/${chatId}`,
        params: { page, limit },
      }),
      providesTags: (result, error, { chatId }) =>
        result
          ? [
              ...result.messages.map((msg) => ({ type: 'Message', id: msg._id })),
              { type: 'Message', id: 'LIST' },
              { type: 'Chat', id: chatId },
            ]
          : [{ type: 'Message', id: 'LIST' }, { type: 'Chat', id: chatId }],
    }),

    // ─── Send Message (supports both FormData and JSON) ─────────────────
    sendMessage: builder.mutation({
      query: ({ chatId, data }) => {
        // Detect if data is FormData (file upload) or plain object (text)
        const isFormData = data instanceof FormData;
        return {
          url: `${MESSAGING_URL}/${chatId}`,
          method: 'POST',
          body: data,
          // If it's FormData, let the browser set Content-Type; otherwise, set JSON
          headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
        };
      },
      invalidatesTags: (result, error, { chatId }) => [
        { type: 'Chat', id: chatId },
        'Message',
      ],
    }),

    // ─── Delete Message ──────────────────────────────────────────────────
    deleteMessage: builder.mutation({
      query: (messageId) => ({
        url: `${MESSAGING_URL}/${messageId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Message'],
    }),

    // ─── Typing Indicators ──────────────────────────────────────────────
    startTyping: builder.mutation({
      query: (chatId) => ({
        url: `${MESSAGING_URL}/${chatId}/typing`,
        method: 'POST',
      }),
    }),

    stopTyping: builder.mutation({
      query: (chatId) => ({
        url: `${MESSAGING_URL}/${chatId}/typing`,
        method: 'DELETE',
      }),
    }),

    getTypingUsers: builder.query({
      query: (chatId) => ({
        url: `${MESSAGING_URL}/${chatId}/typing`,
      }),
      providesTags: ['Typing'],
    }),

    // ─── Read Receipts ──────────────────────────────────────────────────
    markChatAsRead: builder.mutation({
      query: (chatId) => ({
        url: `${MESSAGING_URL}/${chatId}/read`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, chatId) => [{ type: 'Chat', id: chatId }],
    }),

    // ─── Participant Management ─────────────────────────────────────────
    addParticipant: builder.mutation({
      query: ({ chatId, userIds }) => ({
        url: `${MESSAGING_URL}/${chatId}/participants`,
        method: 'POST',
        body: { userIds },
      }),
      invalidatesTags: ['Chat'],
    }),

    removeParticipant: builder.mutation({
      query: ({ chatId, userId }) => ({
        url: `${MESSAGING_URL}/${chatId}/participants/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Chat'],
    }),

    // ─── User Search ────────────────────────────────────────────────────
    searchUsers: builder.query({
      query: ({ workspaceId, query }) => ({
        url: `${MESSAGING_URL}/search/users`,
        params: { workspaceId, query },
      }),
      providesTags: ['UserSearch'],
    }),

  }),
});

export const {
  useCreateGroupChatMutation,
  useCreateDirectChatMutation,
  useGetUserChatsQuery,
  useUpdateOnlineStatusMutation,
  useGetChatMessagesQuery,
  useSendMessageMutation,
  useDeleteMessageMutation,
  useStartTypingMutation,
  useStopTypingMutation,
  useGetTypingUsersQuery,
  useMarkChatAsReadMutation,
  useAddParticipantMutation,
  useRemoveParticipantMutation,
  useSearchUsersQuery,
} = messagingApiSlice;