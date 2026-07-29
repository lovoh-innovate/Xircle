  // src/slices/messagingApiSlice.js
  import { apiSlice } from './apiSlice';

  const MESSAGING_URL = '/messages';

  export const messagingApiSlice = apiSlice.injectEndpoints({
    endpoints: (builder) => ({

      // ─── Workspace Chat Creation ──────────────────────────────────────
      createGroupChat: builder.mutation({
        query: (data) => ({
          url: `${MESSAGING_URL}/group`,
          method: 'POST',
          body: data, // { workspaceId, name, avatar? }
        }),
        invalidatesTags: ['Chat', 'Message'],
      }),

      createDirectChat: builder.mutation({
        query: (data) => ({
          url: `${MESSAGING_URL}/direct`,
          method: 'POST',
          body: data, // { workspaceId, targetUserId }
        }),
        invalidatesTags: ['Chat'],
      }),

      // ─── Public (Outside Workspace) Chats ─────────────────────────────
      createPublicDirectChat: builder.mutation({
        query: (data) => ({
          url: `${MESSAGING_URL}/public/direct`,
          method: 'POST',
          body: data, // { username }
        }),
        invalidatesTags: ['Chat'],
      }),

      createPublicGroupChat: builder.mutation({
        query: (data) => ({
          url: `${MESSAGING_URL}/public/group`,
          method: 'POST',
          body: data, // { name, description?, avatar?, isPublic? }
        }),
        invalidatesTags: ['Chat'],
      }),

      searchPublicGroups: builder.query({
        query: (query) => ({
          url: `${MESSAGING_URL}/public/groups/search`,
          params: { query },
        }),
        providesTags: ['PublicGroup'],
      }),

      requestJoinGroup: builder.mutation({
        query: (chatId) => ({
          url: `${MESSAGING_URL}/public/groups/${chatId}/join-request`,
          method: 'POST',
        }),
        invalidatesTags: (result, error, chatId) => [{ type: 'Chat', id: chatId }],
      }),

      handleJoinRequest: builder.mutation({
        query: ({ chatId, requestId, action }) => ({
          url: `${MESSAGING_URL}/public/groups/${chatId}/join-request/${requestId}`,
          method: 'POST',
          body: { action }, // 'accept' or 'reject'
        }),
        invalidatesTags: (result, error, { chatId }) => [{ type: 'Chat', id: chatId }],
      }),

      getJoinRequests: builder.query({
        query: (chatId) => ({
          url: `${MESSAGING_URL}/public/groups/${chatId}/join-requests`,
        }),
        providesTags: (result, error, chatId) => [{ type: 'JoinRequest', id: chatId }],
      }),

      // ─── Group Admin Management ────────────────────────────────────────
      makeGroupAdmin: builder.mutation({
        query: ({ chatId, userId }) => ({
          url: `${MESSAGING_URL}/${chatId}/make-admin`,
          method: 'POST',
          body: { userId },
        }),
        invalidatesTags: (result, error, { chatId }) => [{ type: 'Chat', id: chatId }],
      }),

      removeGroupAdmin: builder.mutation({
        query: ({ chatId, userId }) => ({
          url: `${MESSAGING_URL}/${chatId}/remove-admin`,
          method: 'POST',
          body: { userId },
        }),
        invalidatesTags: (result, error, { chatId }) => [{ type: 'Chat', id: chatId }],
      }),

      // ─── Group Deletion and Member Listing ────────────────────────────
      deleteGroupChat: builder.mutation({
        query: (chatId) => ({
          url: `${MESSAGING_URL}/group/${chatId}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['Chat', 'Message'],
      }),

      getGroupMembers: builder.query({
        query: (chatId) => ({
          url: `${MESSAGING_URL}/group/${chatId}/members`,
        }),
        providesTags: (result, error, chatId) => [{ type: 'Member', id: chatId }],
      }),

      // ─── Archiving and Exiting (Chat level) ────────────────────────────
      archiveChat: builder.mutation({
        query: (chatId) => ({
          url: `${MESSAGING_URL}/${chatId}/archive`,
          method: 'POST',
        }),
        invalidatesTags: (result, error, chatId) => [{ type: 'Chat', id: chatId }],
      }),

      unarchiveChat: builder.mutation({
        query: (chatId) => ({
          url: `${MESSAGING_URL}/${chatId}/unarchive`,
          method: 'POST',
        }),
        invalidatesTags: (result, error, chatId) => [{ type: 'Chat', id: chatId }],
      }),

      exitGroupChat: builder.mutation({
        query: (chatId) => ({
          url: `${MESSAGING_URL}/${chatId}/exit`,
          method: 'POST',
        }),
        invalidatesTags: (result, error, chatId) => [{ type: 'Chat', id: chatId }],
      }),

      // ─── Message Archive/Star ──────────────────────────────────────────
      archiveMessage: builder.mutation({
        query: (messageId) => ({
          url: `${MESSAGING_URL}/${messageId}/archive`,
          method: 'POST',
        }),
        invalidatesTags: (result, error, messageId) => [
          { type: 'Message', id: messageId },
          'Message',
        ],
      }),

      unarchiveMessage: builder.mutation({
        query: (messageId) => ({
          url: `${MESSAGING_URL}/${messageId}/unarchive`,
          method: 'POST',
        }),
        invalidatesTags: (result, error, messageId) => [
          { type: 'Message', id: messageId },
          'Message',
        ],
      }),

      starMessage: builder.mutation({
        query: (messageId) => ({
          url: `${MESSAGING_URL}/${messageId}/star`,
          method: 'POST',
        }),
        invalidatesTags: (result, error, messageId) => [
          { type: 'Message', id: messageId },
          'Message',
        ],
      }),

      unstarMessage: builder.mutation({
        query: (messageId) => ({
          url: `${MESSAGING_URL}/${messageId}/unstar`,
          method: 'POST',
        }),
        invalidatesTags: (result, error, messageId) => [
          { type: 'Message', id: messageId },
          'Message',
        ],
      }),

      // ─── Chat Messages ──────────────────────────────────────────────────
      getUserChats: builder.query({
        query: ({ workspaceId, archived } = {}) => ({
          url: `${MESSAGING_URL}/chats`,
          params: { workspaceId, archived },
        }),
        providesTags: ['Chat'],
      }),

      updateOnlineStatus: builder.mutation({
        query: (data) => ({
          url: `${MESSAGING_URL}/online-status`,
          method: 'POST',
          body: data, // { workspaceId, isOnline }
        }),
      }),

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

      sendMessage: builder.mutation({
        query: ({ chatId, data }) => {
          const isFormData = data instanceof FormData;
          return {
            url: `${MESSAGING_URL}/${chatId}`,
            method: 'POST',
            body: data,
            headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
          };
        },
        invalidatesTags: (result, error, { chatId }) => [
          { type: 'Chat', id: chatId },
          'Message',
        ],
      }),

      deleteMessage: builder.mutation({
        query: (messageId) => ({
          url: `${MESSAGING_URL}/${messageId}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['Message'],
      }),

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

      markChatAsRead: builder.mutation({
        query: (chatId) => ({
          url: `${MESSAGING_URL}/${chatId}/read`,
          method: 'POST',
        }),
        invalidatesTags: (result, error, chatId) => [{ type: 'Chat', id: chatId }],
      }),

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
    // Workspace chat creation
    useCreateGroupChatMutation,
    useCreateDirectChatMutation,

    // Public chat
    useCreatePublicDirectChatMutation,
    useCreatePublicGroupChatMutation,
    useSearchPublicGroupsQuery,
    useRequestJoinGroupMutation,
    useHandleJoinRequestMutation,
    useGetJoinRequestsQuery,

    // Group admin
    useMakeGroupAdminMutation,
    useRemoveGroupAdminMutation,

    // Group deletion & members
    useDeleteGroupChatMutation,
    useGetGroupMembersQuery,

    // Chat archiving & exiting
    useArchiveChatMutation,
    useUnarchiveChatMutation,
    useExitGroupChatMutation,

    // Message archive/star
    useArchiveMessageMutation,
    useUnarchiveMessageMutation,
    useStarMessageMutation,
    useUnstarMessageMutation,

    // Core chat & messages
    useGetUserChatsQuery,
    useLazyGetUserChatsQuery, // <-- added here
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