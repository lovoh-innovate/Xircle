// features/personalTask/personalTaskApiSlice.js
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
        body: data, // { name, color }
      }),
      invalidatesTags: ['PersonalFolder'],
    }),

    updatePersonalFolder: builder.mutation({
      query: ({ folderId, data }) => ({
        url: `${PERSONAL_TASKS_URL}/folders/${folderId}`,
        method: 'PUT',
        body: data, // { name, color }
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
      invalidatesTags: ['PersonalFolder', 'PersonalTask'], // tasks become unlinked
    }),

    // ─── Personal Tasks ────────────────────────────────────────────
    getPersonalTasks: builder.query({
      query: ({ folderId, status, priority, archived } = {}) => ({
        url: PERSONAL_TASKS_URL,
        params: { folderId, status, priority, archived },
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
        body: data, // { folderId, title, description, priority, dueDate, dailyReminderTime, subtasks, notes }
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
} = personalTaskApiSlice;