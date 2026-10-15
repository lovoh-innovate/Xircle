// slices/taskApiSlice.js
import { apiSlice } from './apiSlice';

const TASKS_URL = '/tasks';

export const taskApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ═════════════════════════════════════════════════════════════
    // All urgent tasks
    //
    // Includes tasks across every project the user has access to —
    // permanent member, associate, or project manager (associate-PMs
    // included). Backend handles scope.
    // ═════════════════════════════════════════════════════════════
    getAllUrgentTasks: builder.query({
      query: () => ({
        url: `${TASKS_URL}/all-urgent`,
      }),
      providesTags: [{ type: 'Task', id: 'URGENT' }],
    }),

    // ═════════════════════════════════════════════════════════════
    // CRUD
    // ═════════════════════════════════════════════════════════════
    createTask: builder.mutation({
      query: (data) => {
        const isFormData = data instanceof FormData;
        return {
          url: TASKS_URL,
          method: 'POST',
          body: data,
          headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
        };
      },
      // Assigning an associate auto-adds them to project.associates
      // server-side, so invalidate both Task and Associate caches.
      invalidatesTags: ['Task', 'Project', 'PublicTask', 'Associate'],
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
      // Associates (non-PM) only see tasks assigned to them —
      // filtering is handled server-side.
      providesTags: (result) => {
        const tags = [{ type: 'Task', id: 'LIST' }];
        if (result?.tasks?.length) {
          tags.unshift(
            ...result.tasks.map((t) => ({ type: 'Task', id: t._id }))
          );
        }
        return tags;
      },
    }),

    getTaskById: builder.query({
      query: (taskId) => ({ url: `${TASKS_URL}/${taskId}` }),
      providesTags: (result, error, taskId) => [{ type: 'Task', id: taskId }],
    }),

    updateTask: builder.mutation({
      query: ({ taskId, data }) => {
        const isFormData = data instanceof FormData;
        return {
          url: `${TASKS_URL}/${taskId}`,
          method: 'PUT',
          body: data,
          headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
        };
      },
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'PublicTask',
        'Associate',
      ],
    }),

    deleteTask: builder.mutation({
      query: (taskId) => ({ url: `${TASKS_URL}/${taskId}`, method: 'DELETE' }),
      invalidatesTags: ['Task', 'Project', 'PublicTask'],
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

    // ── Assign / Reassign whole task ──────────────────────────────
    // Permission: workspace owner, admin, or PM (associate-PMs included)
    // Server auto-adds new assignees to project.associates/teamMembers.
    assignTask: builder.mutation({
      query: ({ taskId, assigneeIds }) => ({
        url: `${TASKS_URL}/${taskId}/assign`,
        method: 'PATCH',
        body: { assigneeIds },
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
        'PublicTask',
        'Associate',
      ],
    }),

    // ═════════════════════════════════════════════════════════════
    // SUB-TASKS
    //
    // Subtask assignee must be one of the task's assignees. This is
    // validated server-side.
    //
    // Permissions:
    //   - Managers (owner/admin/PM incl. associate-PM): full control
    //   - Associate editor: can act on subtasks of tasks assigned to
    //     them (if allowAssigneeEditSubtasks is on)
    //   - Associate viewer: read-only
    // ═════════════════════════════════════════════════════════════

    addSubTask: builder.mutation({
      query: ({ taskId, data }) => {
        const isFormData = data instanceof FormData;
        return {
          url: `${TASKS_URL}/${taskId}/subtasks`,
          method: 'POST',
          body: data,
          headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
        };
      },
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
        'PublicTask',
      ],
    }),

    updateSubTask: builder.mutation({
      query: ({ taskId, subTaskIndex, data }) => {
        const isFormData = data instanceof FormData;
        return {
          url: `${TASKS_URL}/${taskId}/subtasks/${subTaskIndex}`,
          method: 'PUT',
          body: data,
          headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
        };
      },
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
        'PublicTask',
      ],
    }),

    // Assign a single subtask to one of the task's assignees
    assignSubTask: builder.mutation({
      query: ({ taskId, subTaskIndex, assigneeId }) => ({
        url: `${TASKS_URL}/${taskId}/subtasks/${subTaskIndex}/assign`,
        method: 'PATCH',
        body: { assigneeId },
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'PublicTask',
      ],
    }),

    // Bulk assign many subtasks in one request
    // body: { assignments: [{ index, assigneeId }, ...] }
    bulkAssignSubTasks: builder.mutation({
      query: ({ taskId, assignments }) => ({
        url: `${TASKS_URL}/${taskId}/subtasks/bulk-assign`,
        method: 'POST',
        body: { assignments },
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'PublicTask',
      ],
    }),

    // ── Mark subtask done ─────────────────────────────────────────
    // Called by the assignee (subtask or task level) OR a manager.
    // If a manager calls it, the subtask is confirmed immediately.
    markSubTaskDone: builder.mutation({
      query: ({ taskId, subTaskIndex, data }) => {
        const isFormData = data instanceof FormData;
        return {
          url: `${TASKS_URL}/${taskId}/subtasks/${subTaskIndex}/done`,
          method: 'PATCH',
          body: data,
          headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
        };
      },
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
        'PublicTask',
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
        'PublicTask',
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
        'PublicTask',
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
        'PublicTask',
      ],
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

    // ═════════════════════════════════════════════════════════════
    // MAIN TASK COMPLETION
    //
    // markTaskCompleted:
    //   - Manager → confirmed_completed (instant)
    //   - Assignee (permanent OR associate editor) → completed
    //     (awaiting manager confirmation)
    //
    // confirmTaskCompletion / rejectTask: managers only
    // (associate-PMs count as managers; associate editors do not)
    // ═════════════════════════════════════════════════════════════

    markTaskCompleted: builder.mutation({
      query: ({ taskId, data }) => {
        const isFormData = data instanceof FormData;
        return {
          url: `${TASKS_URL}/${taskId}/complete`,
          method: 'PATCH',
          body: data,
          headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
        };
      },
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'Task',
        'Project',
        'PublicTask',
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
        'PublicTask',
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
        'PublicTask',
      ],
    }),

    // ═════════════════════════════════════════════════════════════
    // REMINDERS
    // ═════════════════════════════════════════════════════════════
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

    // ═════════════════════════════════════════════════════════════
    // COMMENTS & FEEDBACK
    //
    // Associates (editors) can comment ONLY on tasks assigned to them.
    // Associate-PMs can comment on any task (manager-equivalent).
    // Enforced server-side via resolveTaskAccess.canComment.
    // ═════════════════════════════════════════════════════════════
    addComment: builder.mutation({
      query: ({ taskId, comment, mentions, attachments }) => ({
        url: `${TASKS_URL}/${taskId}/comments`,
        method: 'POST',
        body: { comment, mentions, attachments },
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: 'Task', id: taskId },
        'PublicTask',
      ],
    }),

    getMyTasks: builder.query({
      query: ({ status, priority, workspaceId, projectId } = {}) => ({
        url: `${TASKS_URL}/my-tasks`,
        params: { status, priority, workspaceId, projectId },
      }),
      // This includes tasks assigned to the caller — works the same
      // for permanent members and associates. Backend filters to
      // what the caller is actually assigned.
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

    // ═════════════════════════════════════════════════════════════
    // FOLDERS
    //
    // Folder read-only lists accept any active workspace member —
    // permanent OR associate. Server validates.
    // ═════════════════════════════════════════════════════════════
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

    // ═════════════════════════════════════════════════════════════
    // REORDER
    // ═════════════════════════════════════════════════════════════
    reorderTasks: builder.mutation({
      query: ({ projectId, orderedTaskIds }) => ({
        url: `${TASKS_URL}/project/${projectId}/reorder`,
        method: 'PATCH',
        body: { orderedTaskIds },
      }),
      invalidatesTags: ['Task', 'Project'],
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

  // ─── Subtasks ───
  useAddSubTaskMutation,
  useUpdateSubTaskMutation,
  useAssignSubTaskMutation,
  useBulkAssignSubTasksMutation,
  useMarkSubTaskDoneMutation,
  useConfirmSubTaskMutation,
  useRejectSubTaskMutation,
  useDeleteSubTaskMutation,
  useReorderSubTasksMutation,

  // ─── Task completion ───
  useMarkTaskCompletedMutation,
  useConfirmTaskCompletionMutation,
  useRejectTaskMutation,

  // ─── Reminders ───
  useTriggerTaskRemindersMutation,
  useSendManualReminderMutation,

  // ─── Comments / feedback ───
  useAddCommentMutation,
  useGetMyTasksQuery,
  useGetTaskFeedbackQuery,

  // ─── Folders ───
  useGetProjectFoldersQuery,
  useCreateFolderMutation,
  useUpdateFolderMutation,
  useDeleteFolderMutation,
  useAddFolderReadOnlyMutation,
  useRemoveFolderReadOnlyMutation,

  // ─── Reorder ───
  useReorderTasksMutation,
} = taskApiSlice;