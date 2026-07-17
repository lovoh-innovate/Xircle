// features/team/teamApiSlice.js
import { apiSlice } from './apiSlice';

const TEAM_URL = '/team';

export const teamApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({

    // ─── Join & Membership ─────────────────────────────────────────

    // Request to join a workspace using invite code
    requestToJoin: builder.mutation({
      query: (data) => ({
        url: `${TEAM_URL}/join`,
        method: 'POST',
        body: data, // { inviteCode }
      }),
      invalidatesTags: ['Team', 'Membership'],
    }),

    // Get current user's membership details in a workspace
    getMyMembership: builder.query({
      query: (workspaceId) => ({
        url: `${TEAM_URL}/${workspaceId}/me`,
      }),
      providesTags: ['Membership'],
    }),

    // ─── Pending Requests (Owner only) ─────────────────────────────

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

    // ─── Member Management (Owner only) ────────────────────────────

    // Remove an active member from workspace
    removeMember: builder.mutation({
      query: ({ workspaceId, memberId }) => ({
        url: `${TEAM_URL}/${workspaceId}/member/${memberId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Team', 'Membership'],
    }),

    // Update an active member's role or department
    updateMember: builder.mutation({
      query: ({ workspaceId, memberId, role, department }) => ({
        url: `${TEAM_URL}/${workspaceId}/member/${memberId}`,
        method: 'PUT',
        body: { role, department },
      }),
      invalidatesTags: ['Team', 'Membership'],
    }),

    // ─── View Members (shared: owner + active members) ─────────────

    // Get all active members of a workspace
    getMembers: builder.query({
      query: (workspaceId) => ({
        url: `${TEAM_URL}/${workspaceId}/members`,
      }),
      providesTags: ['Team'],
    }),

    // Get members filtered by department
    getMembersByDepartment: builder.query({
      query: ({ workspaceId, department }) => ({
        url: `${TEAM_URL}/${workspaceId}/department/${department}`,
      }),
      providesTags: ['Team'],
    }),

  }),
});

export const {
  useRequestToJoinMutation,
  useGetMyMembershipQuery,
  useGetPendingRequestsQuery,
  useApproveMemberMutation,
  useRejectMemberMutation,
  useRemoveMemberMutation,
  useUpdateMemberMutation,
  useGetMembersQuery,
  useGetMembersByDepartmentQuery,
} = teamApiSlice;