// slices/taskApiSlice.js
import { apiSlice } from './apiSlice';

const TASKS_URL = '/tasks';

export const taskApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ─── All urgent tasks (project only) ──────────────────────────
    getAllUrgentTasks: builder.query({
      query: () => ({
        url: `${TASKS_URL}/all-urgent`,
      }),
      providesTags: [{ type: 'Task', id: 'URGENT' }],
    }),

    // ─── CRUD ──────────────────────────────────────────────────────
    createTask: builder.mutation({
      query: (data) => ({
        url: TASKS_URL,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Task', 'Project'],
    }),

    getProjectTasks: builder.query({
      query: ({
        projectId,
        status,
        priority,
        assigneeId,
        taskType,
        folderId,
        archived,
      }) => ({
        url: `${TASKS_URL}/project/${projectId}`,
        params: { status, priority, assigneeId, taskType, folderId, archived },
      }),
      providesTags: (result) =>
        result
          ? [
              ...(result.tasks || []).map((t) => ({ type: 'Task', id: t._id })),
              { type: 'Task', id: 'LIST' },
            ]
          : [{ type: 'Task', id: 'LIST' }],
    }),

    getTaskById: builder.query({
      query: (taskId) => ({ url: `${TASKS_URL}/${taskId}` }),
      providesTags: (result, error, taskId) => [{ type: 'Task', id: taskId }],
    }),

    updateTask: builder.mutation({
      query: ({ taskId, data }) => ({
        url: `${TASKS_URL}/${taskId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
      ],
    }),

    deleteTask: builder.mutation({
      query: (taskId) => ({ url: `${TASKS_URL}/${taskId}`, method: 'DELETE' }),
      invalidatesTags: ['Task', 'Project'],
    }),

    permanentlyDeleteTask: builder.mutation({
      query: (taskId) => ({
        url: `${TASKS_URL}/${taskId}/permanent`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Task', 'Project'],
    }),

    archiveTask: builder.mutation({
      query: (taskId) => ({
        url: `${TASKS_URL}/${taskId}/archive`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, taskId) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
      ],
    }),

    restoreTask: builder.mutation({
      query: (taskId) => ({
        url: `${TASKS_URL}/${taskId}/restore`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, taskId) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
      ],
    }),

    copyTask: builder.mutation({
      query: ({ taskId, targetFolderId }) => ({
        url: `${TASKS_URL}/${taskId}/copy`,
        method: 'POST',
        body: { targetFolderId },
      }),
      invalidatesTags: ['Task', 'Project'],
    }),

    moveTask: builder.mutation({
      query: ({ taskId, targetFolderId }) => ({
        url: `${TASKS_URL}/${taskId}/move`,
        method: 'PATCH',
        body: { targetFolderId },
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
      ],
    }),

    assignTask: builder.mutation({
      query: ({ taskId, assigneeId }) => ({
        url: `${TASKS_URL}/${taskId}/assign`,
        method: 'PATCH',
        body: { assigneeId },
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
      ],
    }),

    // ─── Sub‑tasks (for project tasks) ────────────────────────────
    addSubTask: builder.mutation({
      query: ({ taskId, data }) => ({
        url: `${TASKS_URL}/${taskId}/subtasks`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
      ],
    }),

    updateSubTask: builder.mutation({
      query: ({ taskId, subTaskIndex, data }) => ({
        url: `${TASKS_URL}/${taskId}/subtasks/${subTaskIndex}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
      ],
    }),

    markSubTaskDone: builder.mutation({
      query: ({ taskId, subTaskIndex, data }) => ({
        url: `${TASKS_URL}/${taskId}/subtasks/${subTaskIndex}/done`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
      ],
    }),

    confirmSubTask: builder.mutation({
      query: ({ taskId, subTaskIndex, feedback }) => ({
        url: `${TASKS_URL}/${taskId}/subtasks/${subTaskIndex}/confirm`,
        method: 'PATCH',
        body: { feedback },
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
      ],
    }),

    rejectSubTask: builder.mutation({
      query: ({ taskId, subTaskIndex, reason }) => ({
        url: `${TASKS_URL}/${taskId}/subtasks/${subTaskIndex}/reject`,
        method: 'PATCH',
        body: { reason },
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
      ],
    }),

    deleteSubTask: builder.mutation({
      query: ({ taskId, subTaskIndex }) => ({
        url: `${TASKS_URL}/${taskId}/subtasks/${subTaskIndex}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
      ],
    }),

    // ─── Main task completion flow ────────────────────────────────
    markTaskCompleted: builder.mutation({
      query: ({ taskId, data }) => ({
        url: `${TASKS_URL}/${taskId}/complete`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
      ],
    }),

    confirmTaskCompletion: builder.mutation({
      query: ({ taskId, data }) => ({
        url: `${TASKS_URL}/${taskId}/confirm-completion`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
      ],
    }),

    rejectTask: builder.mutation({
      query: ({ taskId, reason }) => ({
        url: `${TASKS_URL}/${taskId}/reject`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
      ],
    }),

    // ─── Reminders ─────────────────────────────────────────────────
    triggerTaskReminders: builder.mutation({
      query: () => ({
        url: `${TASKS_URL}/reminders`,
        method: 'POST',
      }),
    }),

    sendManualReminder: builder.mutation({
      query: ({ taskId, message }) => ({
        url: `${TASKS_URL}/${taskId}/remind`,
        method: 'POST',
        body: { message },
      }),
    }),

    // ─── Comments & feedback history ──────────────────────────────
    addComment: builder.mutation({
      query: ({ taskId, comment, mentions, attachments }) => ({
        url: `${TASKS_URL}/${taskId}/comments`,
        method: 'POST',
        body: { comment, mentions, attachments },
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
      ],
    }),

    getMyTasks: builder.query({
      query: ({ status, priority, workspaceId, projectId } = {}) => ({
        url: `${TASKS_URL}/my-tasks`,
        params: { status, priority, workspaceId, projectId },
      }),
      providesTags: [{ type: 'Task', id: 'MY_TASKS' }],
    }),

    getTaskFeedback: builder.query({
      query: ({ taskId, type }) => ({
        url: `${TASKS_URL}/${taskId}/feedback`,
        params: { type },
      }),
      providesTags: (result, error, { taskId }) => [
        { type: 'Task', id: `${taskId}-feedback` },
      ],
    }),

    // ─── Folder management (project‑scoped) ──────────────────────
    getProjectFolders: builder.query({
      query: (projectId) => ({
        url: `${TASKS_URL}/project/${projectId}/folders`,
      }),
      providesTags: (result) =>
        result
          ? [
              ...(result.folders || []).map((f) => ({
                type: 'Folder',
                id: f._id,
              })),
              { type: 'Folder', id: 'LIST' },
            ]
          : [{ type: 'Folder', id: 'LIST' }],
    }),

    createFolder: builder.mutation({
      query: ({ projectId, name }) => ({
        url: `${TASKS_URL}/folders`,
        method: 'POST',
        body: { projectId, name },
      }),
      invalidatesTags: ['Folder'],
    }),

    updateFolder: builder.mutation({
      query: ({ folderId, name }) => ({
        url: `${TASKS_URL}/folders/${folderId}`,
        method: 'PUT',
        body: { name },
      }),
      invalidatesTags: (result, error, { folderId }) => [
        { type: 'Folder', id: folderId },
        'Folder',
      ],
    }),

    deleteFolder: builder.mutation({
      query: (folderId) => ({
        url: `${TASKS_URL}/folders/${folderId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Folder', 'Task'],
    }),

    addFolderReadOnly: builder.mutation({
      query: ({ folderId, users }) => ({
        url: `${TASKS_URL}/folders/${folderId}/read-only`,
        method: 'POST',
        body: { users },
      }),
      invalidatesTags: (result, error, { folderId }) => [
        { type: 'Folder', id: folderId },
        'Folder',
        'Task',
      ],
    }),

    removeFolderReadOnly: builder.mutation({
      query: ({ folderId, users }) => ({
        url: `${TASKS_URL}/folders/${folderId}/read-only`,
        method: 'DELETE',
        body: { users },
      }),
      invalidatesTags: (result, error, { folderId }) => [
        { type: 'Folder', id: folderId },
        'Folder',
        'Task',
      ],
    }),

    // ─── Task & Sub‑task reordering ────────────────────────────────
    reorderTasks: builder.mutation({
      query: ({ projectId, orderedTaskIds }) => ({
        url: `${TASKS_URL}/project/${projectId}/reorder`,
        method: 'PATCH',
        body: { orderedTaskIds },
      }),
      invalidatesTags: ['Task', 'Project'],
    }),

    reorderSubTasks: builder.mutation({
      query: ({ taskId, orderedSubTaskIndices }) => ({
        url: `${TASKS_URL}/${taskId}/subtasks/reorder`,
        method: 'PATCH',
        body: { orderedSubTaskIndices },
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
      ],
    }),
  }),
});

export const {
  useGetAllUrgentTasksQuery,
  useCreateTaskMutation,
  useGetProjectTasksQuery,
  useGetTaskByIdQuery,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  usePermanentlyDeleteTaskMutation,
  useArchiveTaskMutation,
  useRestoreTaskMutation,
  useCopyTaskMutation,
  useMoveTaskMutation,
  useAssignTaskMutation,
  useAddSubTaskMutation,
  useUpdateSubTaskMutation,
  useMarkSubTaskDoneMutation,
  useConfirmSubTaskMutation,
  useRejectSubTaskMutation,
  useDeleteSubTaskMutation,
  useMarkTaskCompletedMutation,
  useConfirmTaskCompletionMutation,
  useRejectTaskMutation,
  useTriggerTaskRemindersMutation,
  useSendManualReminderMutation,
  useAddCommentMutation,
  useGetMyTasksQuery,
  useGetTaskFeedbackQuery,
  useGetProjectFoldersQuery,
  useCreateFolderMutation,
  useUpdateFolderMutation,
  useDeleteFolderMutation,
  useAddFolderReadOnlyMutation,
  useRemoveFolderReadOnlyMutation,
  useReorderTasksMutation,
  useReorderSubTasksMutation,
} = taskApiSlice;