// features/workspace/workspaceApiSlice.js
import { apiSlice } from './apiSlice';

const WORKSPACES_URL = '/workspaces';

export const workspaceApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({

    // ─── CRUD Operations ────────────────────────────────────────────

    // Create a new workspace
    createWorkspace: builder.mutation({
      query: (data) => ({
        url: WORKSPACES_URL,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Workspace'],
    }),

    // Get all workspaces the user owns or has joined
    getMyWorkspaces: builder.query({
      query: () => ({
        url: `${WORKSPACES_URL}/my`,
      }),
      providesTags: ['Workspace'],
    }),

    // Get a single workspace by ID
    getWorkspace: builder.query({
      query: (id) => ({
        url: `${WORKSPACES_URL}/${id}`,
      }),
      providesTags: (result, error, id) => [{ type: 'Workspace', id }],
    }),

    // 🆕 Get workspace by invite code (public preview, no auth required)
    getWorkspaceByInviteCode: builder.query({
      query: (inviteCode) => ({
        url: `${WORKSPACES_URL}/by-code/${inviteCode}`,
      }),
      providesTags: ['Workspace'],
    }),

    // Update a workspace (owner only) – supports logo upload via FormData
    updateWorkspace: builder.mutation({
      query: ({ id, data }) => {
        // If data is FormData, don't set Content-Type header (let the browser set it)
        const isFormData = data instanceof FormData;
        
        return {
          url: `${WORKSPACES_URL}/${id}`,
          method: 'PUT',
          body: data,
          // Only set Content-Type if it's NOT FormData
          headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
        };
      },
      invalidatesTags: (result, error, { id }) => [{ type: 'Workspace', id }],
    }),

    // Delete a workspace (owner only)
    deleteWorkspace: builder.mutation({
      query: (id) => ({
        url: `${WORKSPACES_URL}/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Workspace'],
    }),

    // ─── Membership Actions ─────────────────────────────────────────

    // Leave a workspace (cannot be owner)
    leaveWorkspace: builder.mutation({
      query: (id) => ({
        url: `${WORKSPACES_URL}/${id}/leave`,
        method: 'POST',
      }),
      invalidatesTags: ['Workspace'],
    }),

    // Remove a member from a workspace (owner only)
    removeMember: builder.mutation({
      query: ({ workspaceId, memberId }) => ({
        url: `${WORKSPACES_URL}/${workspaceId}/members/${memberId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Workspace'],
    }),

    // ─── Invite Code ─────────────────────────────────────────────────

    // Regenerate invite code (owner only)
    regenerateInviteCode: builder.mutation({
      query: (id) => ({
        url: `${WORKSPACES_URL}/${id}/invite-code`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Workspace', id }],
    }),

    // ─── Member Role Management ─────────────────────────────────────

    // Update a member's role (owner only)
    updateMemberRole: builder.mutation({
      query: ({ workspaceId, memberId, role }) => ({
        url: `${WORKSPACES_URL}/${workspaceId}/members/${memberId}/role`,
        method: 'PATCH',
        body: { role }, // role: 'Admin' | 'Member'
      }),
      invalidatesTags: (result, error, { workspaceId }) => [
        { type: 'Workspace', id: workspaceId },
      ],
    }),

    // ─── Migration Utility ──────────────────────────────────────────

    // Run migration to update workspace members schema (admin/utility)
    migrateWorkspaces: builder.mutation({
      query: () => ({
        url: `${WORKSPACES_URL}/migrate`,
        method: 'POST',
      }),
      invalidatesTags: ['Workspace'],
    }),

  }),
});

export const {
  useCreateWorkspaceMutation,
  useGetMyWorkspacesQuery,
  useGetWorkspaceQuery,
  useGetWorkspaceByInviteCodeQuery, // 👈 NEW hook
  useUpdateWorkspaceMutation,
  useDeleteWorkspaceMutation,
  useLeaveWorkspaceMutation,
  useRemoveMemberMutation,
  useRegenerateInviteCodeMutation,
  useMigrateWorkspacesMutation,
  useUpdateMemberRoleMutation,
} = workspaceApiSlice;