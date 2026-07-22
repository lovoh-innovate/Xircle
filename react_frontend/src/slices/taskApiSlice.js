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
        body: data, // FormData or plain object
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
        body: data, // FormData or plain object
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

    // ─── Progress workflow ───
    // Accepts both FormData (with files) and plain object (no files)
    updateTaskProgress: builder.mutation({
      query: (payload) => {
        if (payload instanceof FormData) {
          return {
            url: `${TASKS_URL}/${payload.get('taskId')}/progress`,
            method: 'PATCH',
            body: payload,
          };
        }
        // Plain object
        return {
          url: `${TASKS_URL}/${payload.taskId}/progress`,
          method: 'PATCH',
          body: payload,
        };
      },
      invalidatesTags: (result, error, payload) => {
        const taskId = payload instanceof FormData ? payload.get('taskId') : payload.taskId;
        return [
          { type: 'Task', id: taskId },
          { type: 'Task', id: `${taskId}-feedback` },
          'Project',
        ];
      },
    }),

    // Owner/PM approves or rejects (plain JSON)
    reviewTaskProgress: builder.mutation({
      query: ({ taskId, approved, feedback, approvedProgress }) => ({
        url: `${TASKS_URL}/${taskId}/review`,
        method: 'PATCH',
        body: { approved, feedback, approvedProgress },
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        { type: 'Task', id: `${taskId}-feedback` },
        'Project',
      ],
    }),

    // Daily check-in (accepts FormData with files or plain object)
    submitDailyReport: builder.mutation({
      query: (payload) => {
        if (payload instanceof FormData) {
          return {
            url: `${TASKS_URL}/${payload.get('taskId')}/daily-report`,
            method: 'POST',
            body: payload,
          };
        }
        return {
          url: `${TASKS_URL}/${payload.taskId}/daily-report`,
          method: 'POST',
          body: payload,
        };
      },
      invalidatesTags: (result, error, payload) => {
        const taskId = payload instanceof FormData ? payload.get('taskId') : payload.taskId;
        return [
          { type: 'Task', id: taskId },
          { type: 'Task', id: `${taskId}-feedback` },
        ];
      },
    }),

    // ─── Management ───
    reassignTask: builder.mutation({
      query: ({ taskId, assigneeId, reason }) => ({
        url: `${TASKS_URL}/${taskId}/reassign`,
        method: 'PATCH',
        body: { assigneeId, reason },
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
      ],
    }),

    updateTaskStage: builder.mutation({
      query: ({ taskId, stageName, notes, actualHours }) => ({
        url: `${TASKS_URL}/${taskId}/stage`,
        method: 'PATCH',
        body: { stageName, notes, actualHours },
      }),
      invalidatesTags: (result, error, { taskId }) => [{ type: 'Task', id: taskId }],
    }),

    approveTaskCompletion: builder.mutation({
      query: ({ taskId, feedback, finalHours, finalLinks, finalAttachments }) => ({
        url: `${TASKS_URL}/${taskId}/approve`,
        method: 'PATCH',
        body: { feedback, finalHours, finalLinks, finalAttachments },
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Project',
      ],
    }),

    // ─── Comments & history ───
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
  useUpdateTaskProgressMutation,
  useReviewTaskProgressMutation,
  useSubmitDailyReportMutation,
  useReassignTaskMutation,
  useUpdateTaskStageMutation,
  useApproveTaskCompletionMutation,
  useAddCommentMutation,
  useGetMyTasksQuery,
  useGetTaskFeedbackQuery,
} = taskApiSlice;