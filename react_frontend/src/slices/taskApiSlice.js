// features/task/taskApiSlice.js
import { apiSlice } from './apiSlice';

const TASKS_URL = '/tasks';

export const taskApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ─── CRUD ───
    createTask: builder.mutation({
      query: (data) => ({
        url: TASKS_URL,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Task', 'Project'],
    }),

    getProjectTasks: builder.query({
      query: ({ projectId, status, priority, assigneeId, taskType }) => ({
        url: `${TASKS_URL}/project/${projectId}`,
        params: { status, priority, assigneeId, taskType },
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

    // ─── Assign task (PM/Owner only) ───
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

    // ─── Sub‑tasks ───
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

    // 👇 Reject sub‑task (PM/Owner only)
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

    // ─── Main task completion flow ───
    markTaskCompleted: builder.mutation({
      query: ({ taskId, notes }) => ({
        url: `${TASKS_URL}/${taskId}/complete`,
        method: 'PATCH',
        body: { notes },
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
      ],
    }),

    confirmTaskCompletion: builder.mutation({
      query: ({ taskId, feedback, finalHours, finalLinks, finalAttachments }) => ({
        url: `${TASKS_URL}/${taskId}/confirm-completion`,
        method: 'PATCH',
        body: { feedback, finalHours, finalLinks, finalAttachments },
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
      ],
    }),

    // ─── Reminders ───
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

    // ─── Comments & feedback history ───
    addComment: builder.mutation({
      query: ({ taskId, comment, mentions, attachments }) => ({
        url: `${TASKS_URL}/${taskId}/comments`,
        method: 'POST',
        body: { comment, mentions, attachments },
      }),
      invalidatesTags: (result, error, { taskId }) => [{ type: 'Task', id: taskId }],
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
  }),
});

export const {
  useCreateTaskMutation,
  useGetProjectTasksQuery,
  useGetTaskByIdQuery,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useAssignTaskMutation,
  useAddSubTaskMutation,
  useUpdateSubTaskMutation,
  useMarkSubTaskDoneMutation,
  useConfirmSubTaskMutation,
  useRejectSubTaskMutation, // 👈 new export
  useDeleteSubTaskMutation,
  useMarkTaskCompletedMutation,
  useConfirmTaskCompletionMutation,
  useTriggerTaskRemindersMutation,
  useSendManualReminderMutation,
  useAddCommentMutation,
  useGetMyTasksQuery,
  useGetTaskFeedbackQuery,
} = taskApiSlice;