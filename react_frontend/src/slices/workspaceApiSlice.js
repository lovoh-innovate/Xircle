// features/workspace/workspaceApiSlice.js
import { apiSlice } from './apiSlice';

const WORKSPACES_URL = '/workspaces';

export const workspaceApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({

    // ═══════════════════════════════════════════════════════════════
    // CRUD Operations
    // ═══════════════════════════════════════════════════════════════

    // Create a new workspace
    createWorkspace: builder.mutation({
      query: (data) => ({
        url: WORKSPACES_URL,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Workspace'],
    }),

    // Get all workspaces the user has any relationship with.
    //
    // Response now has THREE buckets:
    //   myBusinesses        – workspaces the user owns
    //   joinedBusinesses    – workspaces the user is a PERMANENT member of
    //   associateBusinesses – workspaces where the user is only an associate
    //                         (limited access — non-expired only)
    //
    // Backend already filters out expired associate memberships from
    // associateBusinesses, so the frontend doesn't need to re-filter.
    getMyWorkspaces: builder.query({
      query: () => ({
        url: `${WORKSPACES_URL}/my`,
      }),
      providesTags: ['Workspace'],
    }),

    // Get a single workspace by ID.
    // Response includes `myMembership` with `isAssociate` so the UI can
    // render limited view for associates. Backend rejects expired associates.
    getWorkspace: builder.query({
      query: (id) => ({
        url: `${WORKSPACES_URL}/${id}`,
      }),
      providesTags: (result, error, id) => [{ type: 'Workspace', id }],
    }),

    // Get workspace by invite code (public preview, no auth required).
    // Invite codes are for permanent members only.
    getWorkspaceByInviteCode: builder.query({
      query: (inviteCode) => ({
        url: `${WORKSPACES_URL}/by-code/${inviteCode}`,
      }),
      providesTags: ['Workspace'],
    }),

    // Update a workspace (owner or admin) — supports logo upload via FormData
    updateWorkspace: builder.mutation({
      query: ({ id, data }) => {
        const isFormData = data instanceof FormData;
        return {
          url: `${WORKSPACES_URL}/${id}`,
          method: 'PUT',
          body: data,
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

    // ═══════════════════════════════════════════════════════════════
    // Membership Actions
    // ═══════════════════════════════════════════════════════════════

    // Leave a workspace (owner cannot leave).
    // Works for permanent members AND associates. When an associate
    // leaves, their project ties are revoked automatically server-side.
    leaveWorkspace: builder.mutation({
      query: (id) => ({
        url: `${WORKSPACES_URL}/${id}/leave`,
        method: 'POST',
      }),
      invalidatesTags: ['Workspace'],
    }),

    // Remove a member from a workspace (owner or admin).
    // Works for permanent members AND associates. Server cleans up
    // project ties if the removed member was an associate.
    removeMember: builder.mutation({
      query: ({ workspaceId, memberId }) => ({
        url: `${WORKSPACES_URL}/${workspaceId}/members/${memberId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { workspaceId }) => [
        'Workspace',
        { type: 'Associate', id: workspaceId },
      ],
    }),

    // ═══════════════════════════════════════════════════════════════
    // Invite Code
    // ═══════════════════════════════════════════════════════════════

    // Regenerate invite code (owner only)
    regenerateInviteCode: builder.mutation({
      query: (id) => ({
        url: `${WORKSPACES_URL}/${id}/invite-code`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Workspace', id }],
    }),

    // ═══════════════════════════════════════════════════════════════
    // Member Role Management
    // ═══════════════════════════════════════════════════════════════

    // Update a member's role (owner only).
    // Server refuses to promote an associate to 'Admin' — promote them
    // to permanent member first (see teamApiSlice.convertAssociateToMember).
    updateMemberRole: builder.mutation({
      query: ({ workspaceId, memberId, role }) => ({
        url: `${WORKSPACES_URL}/${workspaceId}/members/${memberId}/role`,
        method: 'PATCH',
        body: { role }, // 'Admin' | 'Member' | 'Staff'
      }),
      invalidatesTags: (result, error, { workspaceId }) => [
        { type: 'Workspace', id: workspaceId },
      ],
    }),

    // ═══════════════════════════════════════════════════════════════
    // ASSOCIATES (read-only listing at the workspace level)
    //
    // Returns all associates of the workspace with an `isExpired` flag.
    // Full management lives in teamApiSlice:
    //   useUpdateAssociateMutation
    //   useRemoveAssociateMutation
    //   useConvertAssociateToMemberMutation
    //
    // This hook exists so workspace pages can show associates without
    // routing through the team-scoped endpoints.
    // ═══════════════════════════════════════════════════════════════

    getWorkspaceAssociates: builder.query({
      query: (workspaceId) => ({
        url: `${WORKSPACES_URL}/${workspaceId}/associates`,
      }),
      providesTags: (result, error, workspaceId) => [
        { type: 'Associate', id: workspaceId },
        { type: 'Associate', id: 'LIST' },
      ],
    }),

    // ═══════════════════════════════════════════════════════════════
    // Migration Utility
    // ═══════════════════════════════════════════════════════════════

    // Runs schema migrations for workspace members.
    // Now also backfills memberType: 'permanent' on old records.
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
  // ── CRUD ──
  useCreateWorkspaceMutation,
  useGetMyWorkspacesQuery,
  useGetWorkspaceQuery,
  useGetWorkspaceByInviteCodeQuery,
  useUpdateWorkspaceMutation,
  useDeleteWorkspaceMutation,

  // ── Membership ──
  useLeaveWorkspaceMutation,
  useRemoveMemberMutation,
  useUpdateMemberRoleMutation,

  // ── Invite code ──
  useRegenerateInviteCodeMutation,

  // ── Associates ──
  useGetWorkspaceAssociatesQuery,

  // ── Utility ──
  useMigrateWorkspacesMutation,
} = workspaceApiSlice;