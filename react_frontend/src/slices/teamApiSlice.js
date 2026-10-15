// features/team/teamApiSlice.js
import { apiSlice } from './apiSlice';

const TEAM_URL = '/team';

export const teamApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({

    // ═══════════════════════════════════════════════════════════════
    // Join & Membership
    // ═══════════════════════════════════════════════════════════════

    // Request to join a workspace using invite code
    // (Permanent member flow — associates never use invite codes)
    requestToJoin: builder.mutation({
      query: (data) => ({
        url: `${TEAM_URL}/join`,
        method: 'POST',
        body: data, // { inviteCode }
      }),
      invalidatesTags: ['Team', 'Membership'],
    }),

    // Get current user's membership details in a workspace
    // Response includes `isAssociate` so the UI can render accordingly
    getMyMembership: builder.query({
      query: (workspaceId) => ({
        url: `${TEAM_URL}/${workspaceId}/me`,
      }),
      providesTags: ['Membership'],
    }),

    // ═══════════════════════════════════════════════════════════════
    // Pending Requests (Owner / Admin only)
    // ═══════════════════════════════════════════════════════════════

    // Get all pending join requests
    getPendingRequests: builder.query({
      query: (workspaceId) => ({
        url: `${TEAM_URL}/${workspaceId}/requests`,
      }),
      providesTags: ['PendingRequests'],
    }),

    // Approve a pending request (assign department & role)
    approveMember: builder.mutation({
      query: ({ workspaceId, memberId, department, role }) => ({
        url: `${TEAM_URL}/${workspaceId}/approve/${memberId}`,
        method: 'PUT',
        body: { department, role },
      }),
      invalidatesTags: ['PendingRequests', 'Team', 'Membership'],
    }),

    // Reject a pending request
    rejectMember: builder.mutation({
      query: ({ workspaceId, memberId }) => ({
        url: `${TEAM_URL}/${workspaceId}/reject/${memberId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['PendingRequests'],
    }),

    // ═══════════════════════════════════════════════════════════════
    // Member Management (Owner / Admin only)
    // ═══════════════════════════════════════════════════════════════

    // Remove an active member from workspace
    // Works for permanent members AND associates (server cleans up
    // project ties automatically if the target was an associate)
    removeMember: builder.mutation({
      query: ({ workspaceId, memberId }) => ({
        url: `${TEAM_URL}/${workspaceId}/member/${memberId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { workspaceId }) => [
        'Team',
        'Membership',
        { type: 'Associate', id: workspaceId },
      ],
    }),

    // Update an active member's role or department
    // Server refuses to set 'Admin' on an associate
    updateMember: builder.mutation({
      query: ({ workspaceId, memberId, role, department }) => ({
        url: `${TEAM_URL}/${workspaceId}/member/${memberId}`,
        method: 'PUT',
        body: { role, department },
      }),
      invalidatesTags: ['Team', 'Membership'],
    }),

    // ═══════════════════════════════════════════════════════════════
    // View Members (shared: owner + active members + associates)
    // ═══════════════════════════════════════════════════════════════

    // Get all active members of a workspace
    // Each member is tagged with `memberType` ('permanent' | 'associate')
    // and `isAssociate` so the UI can render them differently.
    getMembers: builder.query({
      query: (workspaceId) => ({
        url: `${TEAM_URL}/${workspaceId}/members`,
      }),
      providesTags: (result, error, workspaceId) => [
        'Team',
        { type: 'Team', id: workspaceId },
      ],
    }),

    // Get members filtered by department
    // (Associates excluded — they have no department)
    getMembersByDepartment: builder.query({
      query: ({ workspaceId, department }) => ({
        url: `${TEAM_URL}/${workspaceId}/department/${department}`,
      }),
      providesTags: ['Team'],
    }),

    // ═══════════════════════════════════════════════════════════════
    // ASSOCIATE MANAGEMENT (Owner / Admin only)
    //
    // Associates are workspace members with memberType: 'associate'.
    // They are normally added from a project — these endpoints manage
    // the workspace-level side (listing, expiry, removal, promotion).
    // ═══════════════════════════════════════════════════════════════

    // List all associates of a workspace + the projects each is on
    getAssociates: builder.query({
      query: (workspaceId) => ({
        url: `${TEAM_URL}/${workspaceId}/associates`,
      }),
      providesTags: (result, error, workspaceId) => [
        { type: 'Associate', id: workspaceId },
        { type: 'Associate', id: 'LIST' },
      ],
    }),

    // Update an associate's expiry window (workspace-level record)
    // Role changes happen per-project via projectApiSlice.
    // Body: { accessExpiresAt }  — set to null for indefinite access
    updateAssociate: builder.mutation({
      query: ({ workspaceId, memberId, accessExpiresAt }) => ({
        url: `${TEAM_URL}/${workspaceId}/associate/${memberId}`,
        method: 'PATCH',
        body: { accessExpiresAt },
      }),
      invalidatesTags: (result, error, { workspaceId }) => [
        { type: 'Associate', id: workspaceId },
        'Team',
      ],
    }),

    // Remove an associate from the workspace.
    // Also revokes every project.associates record for them in this
    // workspace + drops them from projectManagers/teamMembers.
    // Server blocks removal if they still have open tasks.
    removeAssociate: builder.mutation({
      query: ({ workspaceId, memberId }) => ({
        url: `${TEAM_URL}/${workspaceId}/associate/${memberId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { workspaceId }) => [
        { type: 'Associate', id: workspaceId },
        'Team',
        'Membership',
      ],
    }),

    // Promote an associate to a permanent workspace member.
    // After this they can be given Admin, appear in departments, clock in, etc.
    // Body: { role?, department? }  — defaults to 'Staff' / 'General'
    convertAssociateToMember: builder.mutation({
      query: ({ workspaceId, memberId, role = 'Staff', department = 'General' }) => ({
        url: `${TEAM_URL}/${workspaceId}/associate/${memberId}/promote`,
        method: 'PATCH',
        body: { role, department },
      }),
      invalidatesTags: (result, error, { workspaceId }) => [
        { type: 'Associate', id: workspaceId },
        'Team',
        'Membership',
      ],
    }),

  }),
});

export const {
  // ── Join & membership ──
  useRequestToJoinMutation,
  useGetMyMembershipQuery,

  // ── Pending requests ──
  useGetPendingRequestsQuery,
  useApproveMemberMutation,
  useRejectMemberMutation,

  // ── Member management ──
  useRemoveMemberMutation,
  useUpdateMemberMutation,

  // ── View members ──
  useGetMembersQuery,
  useGetMembersByDepartmentQuery,

  // ── Associates ──
  useGetAssociatesQuery,
  useUpdateAssociateMutation,
  useRemoveAssociateMutation,
  useConvertAssociateToMemberMutation,
} = teamApiSlice;