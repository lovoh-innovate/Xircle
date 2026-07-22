// features/project/projectApiSlice.js
import { apiSlice } from "./apiSlice";

const PROJECTS_URL = "/projects";

export const projectApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Project CRUD ──────────────────────────────────────────────

  createProject: builder.mutation({
  query: ({ workspaceId, data }) => {
    const isFormData = data instanceof FormData;
    let url = PROJECTS_URL;
    if (workspaceId) {
      url += `?workspaceId=${workspaceId}`;
    }
    return {
      url,
      method: "POST",
      body: data,
      headers: isFormData ? undefined : { "Content-Type": "application/json" },
    };
  },
  invalidatesTags: ["Project"],
}),

    getWorkspaceProjects: builder.query({
      query: ({ workspaceId, status, priority, projectType, assigneeId }) => ({
        url: `${PROJECTS_URL}/workspace/${workspaceId}`,
        params: { status, priority, projectType, assigneeId },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.projects.map((p) => ({ type: "Project", id: p._id })),
              { type: "Project", id: "LIST" },
            ]
          : [{ type: "Project", id: "LIST" }],
    }),

    getProjectById: builder.query({
      query: (projectId) => ({
        url: `${PROJECTS_URL}/${projectId}`,
      }),
      providesTags: (result, error, projectId) => [
        { type: "Project", id: projectId },
      ],
    }),

    updateProject: builder.mutation({
      query: ({ projectId, data }) => {
        const isFormData = data instanceof FormData;
        return {
          url: `${PROJECTS_URL}/${projectId}`,
          method: "PUT",
          body: data,
          headers: isFormData
            ? undefined
            : { "Content-Type": "application/json" },
        };
      },
      invalidatesTags: (result, error, { projectId }) => [
        { type: "Project", id: projectId },
      ],
    }),

    deleteProject: builder.mutation({
      query: (projectId) => ({
        url: `${PROJECTS_URL}/${projectId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Project"],
    }),

    // ─── Project Managers Management ──────────────────────────────

    manageProjectManagers: builder.mutation({
      query: ({ projectId, action, managerId }) => ({
        url: `${PROJECTS_URL}/${projectId}/managers`,
        method: "PATCH",
        body: { action, managerId },
      }),
      invalidatesTags: (result, error, { projectId }) => [
        { type: "Project", id: projectId },
      ],
    }),

    // ─── Team Member Management ─────────────────────────────────────

    // Add a team member (sends userId in body)
    addTeamMember: builder.mutation({
      query: ({ projectId, userId, role = "member" }) => ({
        url: `${PROJECTS_URL}/${projectId}/team`,
        method: "POST",
        body: { userId, role },
      }),
      invalidatesTags: (result, error, { projectId }) => [
        { type: "Project", id: projectId },
      ],
    }),

    // Remove a team member – URL uses memberId
    removeTeamMember: builder.mutation({
      query: ({ projectId, memberId }) => ({
        url: `${PROJECTS_URL}/${projectId}/team/${memberId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { projectId }) => [
        { type: "Project", id: projectId },
      ],
    }),

    getProjectTeamWithTasks: builder.query({
      query: (projectId) => ({
        url: `${PROJECTS_URL}/${projectId}/team`,
      }),
      providesTags: (result, error, projectId) => [
        { type: "Project", id: projectId },
      ],
    }),

    // ─── Direct Message Link ────────────────────────────────────────

    getTeamMemberDM: builder.query({
      query: ({ projectId, userId }) => ({
        url: `${PROJECTS_URL}/${projectId}/dm/${userId}`,
      }),
      providesTags: ["Chat"],
    }),

    // ─── Project Statistics ────────────────────────────────────────

    getProjectStats: builder.query({
      query: (projectId) => ({
        url: `${PROJECTS_URL}/${projectId}/stats`,
      }),
      providesTags: (result, error, projectId) => [
        { type: "Project", id: projectId },
      ],
    }),

    confirmProjectCompletion: builder.mutation({
      query: (projectId) => ({
        url: `/projects/${projectId}/confirm-completion`,
        method: "PATCH",
      }),
      invalidatesTags: (result, error, projectId) => [
        { type: "Project", id: projectId },
        "Project",
      ],
    }),
  }),
});

export const {
  useCreateProjectMutation,
  useGetWorkspaceProjectsQuery,
  useGetProjectByIdQuery,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useManageProjectManagersMutation,
  useAddTeamMemberMutation,
  useRemoveTeamMemberMutation,
  useGetProjectTeamWithTasksQuery,
  useGetTeamMemberDMQuery,
  useGetProjectStatsQuery,
  useConfirmProjectCompletionMutation,
} = projectApiSlice;