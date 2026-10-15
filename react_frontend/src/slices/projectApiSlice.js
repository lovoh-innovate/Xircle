// features/project/projectApiSlice.js
import { apiSlice } from './apiSlice';

const PROJECTS_URL = '/projects';

export const projectApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ═══════════════════════════════════════════════════════════════
    // Project CRUD
    // ═══════════════════════════════════════════════════════════════

    createProject: builder.mutation({
      query: ({ workspaceId, data }) => {
        const isFormData = data instanceof FormData;
        let url = PROJECTS_URL;
        if (workspaceId) url += `?workspaceId=${workspaceId}`;
        return {
          url,
          method: 'POST',
          body: data,
          headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
        };
      },
      invalidatesTags: ['Project'],
    }),

    getWorkspaceProjects: builder.query({
      query: ({ workspaceId, status, priority, projectType, archived, trash }) => ({
        url: `${PROJECTS_URL}/workspace/${workspaceId}`,
        params: { status, priority, projectType, archived, trash },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.projects.map((p) => ({ type: 'Project', id: p._id })),
              { type: 'Project', id: 'LIST' },
            ]
          : [{ type: 'Project', id: 'LIST' }],
    }),

    // ═══════════════════════════════════════════════════════════════
    // UNIFIED PROJECT READ
    //
    // `identifier` accepts:
    //   • Mongo ObjectId       (workspace mode — members + associates)
    //   • public share token   (public read-only)
    //
    // Associates do NOT use a token. They hit the project ObjectId
    // like any other member — their role is resolved server-side from
    // workspace membership + project.associates.
    //
    // Server returns:
    //   { project, viewer, permissions, associate, isFullMember }
    // ═══════════════════════════════════════════════════════════════

    getProject: builder.query({
      query: (identifier) => ({
        url: `${PROJECTS_URL}/${identifier}`,
      }),
      providesTags: (result, error, identifier) => [
        { type: 'Project', id: identifier },
        // Keep the project's real _id as a secondary cache key so
        // mutations that invalidate by projectId also refresh this view.
        ...(result?.project?._id
          ? [{ type: 'Project', id: result.project._id }]
          : []),
        { type: 'PublicProject', id: identifier },
      ],
    }),

    // Unified task list for a project (workspace / public)
    getProjectTasksByProject: builder.query({
      query: (identifier) => ({
        url: `${PROJECTS_URL}/${identifier}/tasks`,
      }),
      providesTags: (result, error, identifier) =>
        result
          ? [
              ...(result.tasks || []).map((t) => ({ type: 'Task', id: t._id })),
              { type: 'PublicTask', id: identifier },
              { type: 'Task', id: `LIST:${identifier}` },
            ]
          : [{ type: 'PublicTask', id: identifier }],
    }),

    // Unified single task read
    getProjectTaskById: builder.query({
      query: ({ identifier, taskId }) => ({
        url: `${PROJECTS_URL}/${identifier}/tasks/${taskId}`,
      }),
      providesTags: (result, error, { identifier, taskId }) => [
        { type: 'Task', id: taskId },
        { type: 'PublicTask', id: `${identifier}:${taskId}` },
      ],
    }),

    updateProject: builder.mutation({
      query: ({ projectId, data }) => {
        const isFormData = data instanceof FormData;
        return {
          url: `${PROJECTS_URL}/${projectId}`,
          method: 'PUT',
          body: data,
          headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
        };
      },
      invalidatesTags: (result, error, { projectId }) => [
        { type: 'Project', id: projectId },
      ],
    }),

    // ─── Lifecycle ─────────────────────────────────────────────────

    deleteProject: builder.mutation({
      query: (projectId) => ({
        url: `${PROJECTS_URL}/${projectId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Project'],
    }),

    permanentlyDeleteProject: builder.mutation({
      query: (projectId) => ({
        url: `${PROJECTS_URL}/${projectId}/permanent`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Project'],
    }),

    restoreProject: builder.mutation({
      query: (projectId) => ({
        url: `${PROJECTS_URL}/${projectId}/restore`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, projectId) => [
        { type: 'Project', id: projectId },
        'Project',
      ],
    }),

    archiveProject: builder.mutation({
      query: (projectId) => ({
        url: `${PROJECTS_URL}/${projectId}/archive`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, projectId) => [
        { type: 'Project', id: projectId },
        'Project',
      ],
    }),

    unarchiveProject: builder.mutation({
      query: (projectId) => ({
        url: `${PROJECTS_URL}/${projectId}/unarchive`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, projectId) => [
        { type: 'Project', id: projectId },
        'Project',
      ],
    }),

    // ─── Managers ──────────────────────────────────────────────────

    manageProjectManagers: builder.mutation({
      query: ({ projectId, action, managerId }) => ({
        url: `${PROJECTS_URL}/${projectId}/managers`,
        method: 'PATCH',
        body: { action, managerId },
      }),
      invalidatesTags: (result, error, { projectId }) => [
        { type: 'Project', id: projectId },
        { type: 'Associate', id: projectId },
      ],
    }),

    // ─── Team members ──────────────────────────────────────────────

    addTeamMember: builder.mutation({
      query: ({ projectId, userId, role = 'member' }) => ({
        url: `${PROJECTS_URL}/${projectId}/team`,
        method: 'POST',
        body: { userId, role },
      }),
      invalidatesTags: (result, error, { projectId }) => [
        { type: 'Project', id: projectId },
      ],
    }),

    removeTeamMember: builder.mutation({
      query: ({ projectId, memberId }) => ({
        url: `${PROJECTS_URL}/${projectId}/team/${memberId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { projectId }) => [
        { type: 'Project', id: projectId },
      ],
    }),

    getProjectTeamWithTasks: builder.query({
      query: (projectId) => ({
        url: `${PROJECTS_URL}/${projectId}/team`,
      }),
      providesTags: (result, error, projectId) => [
        { type: 'Project', id: projectId },
      ],
    }),

    // ─── DM & stats ────────────────────────────────────────────────

    getTeamMemberDM: builder.query({
      query: ({ projectId, userId }) => ({
        url: `${PROJECTS_URL}/${projectId}/dm/${userId}`,
      }),
      providesTags: ['Chat'],
    }),

    getProjectStats: builder.query({
      query: (projectId) => ({
        url: `${PROJECTS_URL}/${projectId}/stats`,
      }),
      providesTags: (result, error, projectId) => [
        { type: 'Project', id: projectId },
      ],
    }),

    confirmProjectCompletion: builder.mutation({
      query: (projectId) => ({
        url: `${PROJECTS_URL}/${projectId}/confirm-completion`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, projectId) => [
        { type: 'Project', id: projectId },
        'Project',
      ],
    }),

    // ═══════════════════════════════════════════════════════════════
    // ASSOCIATE MANAGEMENT
    //
    // Associates are workspace-level limited collaborators added
    // directly from a project. They don't use invite tokens — adding
    // them emails a project link (if they have no account) or links
    // them immediately (if they do).
    //
    // Role can be: 'viewer' | 'editor' | 'projectManager'
    //   - 'projectManager' also adds them to the projectManagers array
    //     and gives them full PM powers on this project.
    //
    // `accessExpiresAt` is optional — omit for indefinite access.
    // ═══════════════════════════════════════════════════════════════

    getMyAssociateProjects: builder.query({
      query: () => ({
        url: `${PROJECTS_URL}/associating`,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.projects.map((p) => ({ type: 'Project', id: p._id })),
              { type: 'AssociateProject', id: 'LIST' },
            ]
          : [{ type: 'AssociateProject', id: 'LIST' }],
    }),

    getProjectAssociates: builder.query({
      query: (projectId) => ({
        url: `${PROJECTS_URL}/${projectId}/associates`,
      }),
      providesTags: (result, error, projectId) => [
        { type: 'Associate', id: projectId },
      ],
    }),

    addProjectAssociate: builder.mutation({
      query: ({ projectId, email, name = '', role = 'editor', accessExpiresAt = null }) => ({
        url: `${PROJECTS_URL}/${projectId}/associates`,
        method: 'POST',
        body: { email, name, role, accessExpiresAt },
      }),
      invalidatesTags: (result, error, { projectId }) => [
        { type: 'Associate', id: projectId },
        { type: 'Project', id: projectId },
      ],
    }),

    updateProjectAssociate: builder.mutation({
      query: ({ projectId, associateId, role, name, accessExpiresAt }) => {
        const body = {};
        if (role !== undefined) body.role = role;
        if (name !== undefined) body.name = name;
        if (accessExpiresAt !== undefined) body.accessExpiresAt = accessExpiresAt;
        return {
          url: `${PROJECTS_URL}/${projectId}/associates/${associateId}`,
          method: 'PATCH',
          body,
        };
      },
      invalidatesTags: (result, error, { projectId }) => [
        { type: 'Associate', id: projectId },
        { type: 'Project', id: projectId },
      ],
    }),

    removeProjectAssociate: builder.mutation({
      query: ({ projectId, associateId }) => ({
        url: `${PROJECTS_URL}/${projectId}/associates/${associateId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { projectId }) => [
        { type: 'Associate', id: projectId },
        { type: 'Project', id: projectId },
      ],
    }),

    // ═══════════════════════════════════════════════════════════════
    // Project-wide read-only share link (unchanged)
    // ═══════════════════════════════════════════════════════════════

    enableProjectShareLink: builder.mutation({
      query: (projectId) => ({
        url: `${PROJECTS_URL}/${projectId}/share-link`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, projectId) => [
        { type: 'Project', id: projectId },
      ],
    }),

    disableProjectShareLink: builder.mutation({
      query: (projectId) => ({
        url: `${PROJECTS_URL}/${projectId}/share-link`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, projectId) => [
        { type: 'Project', id: projectId },
      ],
    }),

    // ═══════════════════════════════════════════════════════════════
    // BACK-COMPAT ALIASES
    //
    // Old hook names still used by some components. Use the new
    // *Associate variants in new code. The aliases exist only so
    // existing call sites don't break during the migration.
    //
    // ⚠️ These will be removed in a follow-up release.
    // ═══════════════════════════════════════════════════════════════

    getProjectById: builder.query({
      query: (identifier) => ({
        url: `${PROJECTS_URL}/${identifier}`,
      }),
      providesTags: (result, error, identifier) => [
        { type: 'Project', id: identifier },
        ...(result?.project?._id ? [{ type: 'Project', id: result.project._id }] : []),
      ],
    }),

    getPublicProjectByToken: builder.query({
      query: (token) => ({
        url: `${PROJECTS_URL}/${token}`,
      }),
      providesTags: (result, error, token) => [
        { type: 'PublicProject', id: token },
      ],
    }),

    getPublicProjectTasks: builder.query({
      query: (token) => ({
        url: `${PROJECTS_URL}/${token}/tasks`,
      }),
      providesTags: (result, error, token) => [
        { type: 'PublicTask', id: token },
      ],
    }),

    getPublicTaskById: builder.query({
      query: ({ token, taskId }) => ({
        url: `${PROJECTS_URL}/${token}/tasks/${taskId}`,
      }),
      providesTags: (result, error, { token, taskId }) => [
        { type: 'PublicTask', id: `${token}:${taskId}` },
      ],
    }),

    // Old collaborator hooks → redirect to associate endpoints.
    // This keeps existing components working while you migrate them.
    getMyCollaboratedProjects: builder.query({
      query: () => ({
        url: `${PROJECTS_URL}/associating`,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.projects.map((p) => ({ type: 'Project', id: p._id })),
              { type: 'AssociateProject', id: 'LIST' },
            ]
          : [{ type: 'AssociateProject', id: 'LIST' }],
    }),

    getProjectCollaborators: builder.query({
      query: (projectId) => ({
        url: `${PROJECTS_URL}/${projectId}/associates`,
      }),
      providesTags: (result, error, projectId) => [
        { type: 'Associate', id: projectId },
      ],
    }),

    addProjectCollaborator: builder.mutation({
      query: ({ projectId, email, name = '', role = 'editor', accessExpiresAt = null }) => ({
        url: `${PROJECTS_URL}/${projectId}/associates`,
        method: 'POST',
        body: { email, name, role, accessExpiresAt },
      }),
      invalidatesTags: (result, error, { projectId }) => [
        { type: 'Associate', id: projectId },
        { type: 'Project', id: projectId },
      ],
    }),

    updateProjectCollaborator: builder.mutation({
      query: ({ projectId, collabId, associateId, role, name, accessExpiresAt }) => {
        const id = associateId || collabId;
        const body = {};
        if (role !== undefined) body.role = role;
        if (name !== undefined) body.name = name;
        if (accessExpiresAt !== undefined) body.accessExpiresAt = accessExpiresAt;
        return {
          url: `${PROJECTS_URL}/${projectId}/associates/${id}`,
          method: 'PATCH',
          body,
        };
      },
      invalidatesTags: (result, error, { projectId }) => [
        { type: 'Associate', id: projectId },
      ],
    }),

    removeProjectCollaborator: builder.mutation({
      query: ({ projectId, collabId, associateId }) => {
        const id = associateId || collabId;
        return {
          url: `${PROJECTS_URL}/${projectId}/associates/${id}`,
          method: 'DELETE',
        };
      },
      invalidatesTags: (result, error, { projectId }) => [
        { type: 'Associate', id: projectId },
        { type: 'Project', id: projectId },
      ],
    }),

    // No-op alias — the regenerate-token flow is gone. Kept so any
    // lingering import doesn't crash the build. Remove once the last
    // caller is deleted.
    regenerateProjectCollaboratorToken: builder.mutation({
      queryFn: async () => ({
        error: {
          status: 'CUSTOM_ERROR',
          error: 'Regenerate-token flow has been removed. Associates no longer use invite tokens.',
        },
      }),
    }),
  }),
});

export const {
  // ─── Project CRUD ───
  useCreateProjectMutation,
  useGetWorkspaceProjectsQuery,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  usePermanentlyDeleteProjectMutation,
  useRestoreProjectMutation,
  useArchiveProjectMutation,
  useUnarchiveProjectMutation,

  // ─── Unified reads (use these for new code) ───
  useGetProjectQuery,
  useGetProjectTasksByProjectQuery,
  useGetProjectTaskByIdQuery,

  // ─── Back-compat reads ───
  useGetProjectByIdQuery,
  useGetPublicProjectByTokenQuery,
  useGetPublicProjectTasksQuery,
  useGetPublicTaskByIdQuery,

  // ─── Managers / Team / DM / Stats ───
  useManageProjectManagersMutation,
  useAddTeamMemberMutation,
  useRemoveTeamMemberMutation,
  useGetProjectTeamWithTasksQuery,
  useGetTeamMemberDMQuery,
  useGetProjectStatsQuery,
  useConfirmProjectCompletionMutation,

  // ─── Associates (new names) ───
  useGetMyAssociateProjectsQuery,
  useGetProjectAssociatesQuery,
  useAddProjectAssociateMutation,
  useUpdateProjectAssociateMutation,
  useRemoveProjectAssociateMutation,

  // ─── Associate back-compat aliases ───
  // These will be removed in a follow-up release.
  useGetMyCollaboratedProjectsQuery,
  useGetProjectCollaboratorsQuery,
  useAddProjectCollaboratorMutation,
  useUpdateProjectCollaboratorMutation,
  useRemoveProjectCollaboratorMutation,
  useRegenerateProjectCollaboratorTokenMutation,

  // ─── Share link ───
  useEnableProjectShareLinkMutation,
  useDisableProjectShareLinkMutation,
} = projectApiSlice;