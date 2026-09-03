// slices/personalTaskApiSlice.js
import { apiSlice } from './apiSlice';

const PERSONAL_TASKS_URL = '/personal-tasks';

export const personalTaskApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Personal Folders ──────────────────────────────────────────
    getPersonalFolders: builder.query({
      query: () => ({
        url: `${PERSONAL_TASKS_URL}/folders`,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.folders.map((f) => ({ type: 'PersonalFolder', id: f._id })),
              { type: 'PersonalFolder', id: 'LIST' },
            ]
          : [{ type: 'PersonalFolder', id: 'LIST' }],
    }),

    createPersonalFolder: builder.mutation({
      query: (data) => ({
        url: `${PERSONAL_TASKS_URL}/folders`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['PersonalFolder'],
    }),

    updatePersonalFolder: builder.mutation({
      query: ({ folderId, data }) => ({
        url: `${PERSONAL_TASKS_URL}/folders/${folderId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { folderId }) => [
        { type: 'PersonalFolder', id: folderId },
        'PersonalFolder',
      ],
    }),

    deletePersonalFolder: builder.mutation({
      query: (folderId) => ({
        url: `${PERSONAL_TASKS_URL}/folders/${folderId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['PersonalFolder', 'PersonalTask'],
    }),

    // ─── Personal Tasks ────────────────────────────────────────────
    getPersonalTasks: builder.query({
  query: ({ folderId, status, priority, archived, trash, type } = {}) => ({
    url: PERSONAL_TASKS_URL,
    params: { folderId, status, priority, archived, trash, type },
  }),
  providesTags: (result) =>
    result
      ? [
          ...result.tasks.map((t) => ({
            type: 'PersonalTask',
            id: t._id,
          })),
          { type: 'PersonalTask', id: 'LIST' },
        ]
      : [{ type: 'PersonalTask', id: 'LIST' }],
}),

    createPersonalTask: builder.mutation({
      query: (data) => ({
        url: PERSONAL_TASKS_URL,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['PersonalTask'],
    }),

    updatePersonalTask: builder.mutation({
      query: ({ taskId, data }) => ({
        url: `${PERSONAL_TASKS_URL}/${taskId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'PersonalTask', id: taskId },
        'PersonalTask',
      ],
    }),

    archivePersonalTask: builder.mutation({
      query: (taskId) => ({
        url: `${PERSONAL_TASKS_URL}/${taskId}/archive`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, taskId) => [
        { type: 'PersonalTask', id: taskId },
        'PersonalTask',
      ],
    }),

    restorePersonalTask: builder.mutation({
      query: (taskId) => ({
        url: `${PERSONAL_TASKS_URL}/${taskId}/restore`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, taskId) => [
        { type: 'PersonalTask', id: taskId },
        'PersonalTask',
      ],
    }),

    deletePersonalTask: builder.mutation({
      query: (taskId) => ({
        url: `${PERSONAL_TASKS_URL}/${taskId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['PersonalTask'],
    }),

    permanentlyDeletePersonalTask: builder.mutation({
      query: (taskId) => ({
        url: `${PERSONAL_TASKS_URL}/${taskId}/permanent`,
        method: 'DELETE',
      }),
      invalidatesTags: ['PersonalTask'],
    }),

    reorderPersonalTasks: builder.mutation({
      query: ({ orderedTaskIds }) => ({
        url: `${PERSONAL_TASKS_URL}/reorder`,
        method: 'PATCH',
        body: { orderedTaskIds },
      }),
      invalidatesTags: ['PersonalTask'],
    }),

    // ─── Personal Sub‑tasks ────────────────────────────────────────
    addPersonalSubTask: builder.mutation({
      query: ({ taskId, data }) => ({
        url: `${PERSONAL_TASKS_URL}/${taskId}/subtasks`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'PersonalTask', id: taskId },
        'PersonalTask',
      ],
    }),

    updatePersonalSubTask: builder.mutation({
      query: ({ taskId, subTaskIndex, data }) => ({
        url: `${PERSONAL_TASKS_URL}/${taskId}/subtasks/${subTaskIndex}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'PersonalTask', id: taskId },
        'PersonalTask',
      ],
    }),

    togglePersonalSubTask: builder.mutation({
      query: ({ taskId, subTaskIndex, done }) => ({
        url: `${PERSONAL_TASKS_URL}/${taskId}/subtasks/${subTaskIndex}/toggle`,
        method: 'PATCH',
        body: { done },
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'PersonalTask', id: taskId },
        'PersonalTask',
      ],
    }),

    deletePersonalSubTask: builder.mutation({
      query: ({ taskId, subTaskIndex }) => ({
        url: `${PERSONAL_TASKS_URL}/${taskId}/subtasks/${subTaskIndex}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'PersonalTask', id: taskId },
        'PersonalTask',
      ],
    }),

    reorderPersonalSubTasks: builder.mutation({
      query: ({ taskId, orderedSubTaskIndices }) => ({
        url: `${PERSONAL_TASKS_URL}/${taskId}/subtasks/reorder`,
        method: 'PATCH',
        body: { orderedSubTaskIndices },
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'PersonalTask', id: taskId },
        'PersonalTask',
      ],
    }),

    // ─── Collaboration ─────────────────────────────────────────────
    addCollaborator: builder.mutation({
      query: ({ taskId, email, role }) => ({
        url: `${PERSONAL_TASKS_URL}/${taskId}/collaborators`,
        method: 'POST',
        body: { email, role },
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'PersonalTask', id: taskId },
        'PersonalTask',
        'PendingInvitation',
      ],
    }),

    getPendingInvitations: builder.query({
      query: () => ({
        url: `${PERSONAL_TASKS_URL}/collaborators/pending`,
      }),
      providesTags: ['PendingInvitation'],
    }),

    acceptInvitationWithToken: builder.mutation({
      query: ({ token }) => ({
        url: `${PERSONAL_TASKS_URL}/collaborators/accept-token`,
        method: 'POST',
        body: { token },
      }),
      invalidatesTags: ['PendingInvitation', 'PersonalTask'],
    }),
  }),
});

export const {
  useGetPersonalFoldersQuery,
  useCreatePersonalFolderMutation,
  useUpdatePersonalFolderMutation,
  useDeletePersonalFolderMutation,
  useGetPersonalTasksQuery,
  useCreatePersonalTaskMutation,
  useUpdatePersonalTaskMutation,
  useArchivePersonalTaskMutation,
  useRestorePersonalTaskMutation,
  useDeletePersonalTaskMutation,
  usePermanentlyDeletePersonalTaskMutation,
  useReorderPersonalTasksMutation,
  useAddPersonalSubTaskMutation,
  useUpdatePersonalSubTaskMutation,
  useTogglePersonalSubTaskMutation,
  useDeletePersonalSubTaskMutation,
  useReorderPersonalSubTasksMutation,
  // Collaboration hooks
  useAddCollaboratorMutation,
  useGetPendingInvitationsQuery,
  useAcceptInvitationWithTokenMutation,
} = personalTaskApiSlice;