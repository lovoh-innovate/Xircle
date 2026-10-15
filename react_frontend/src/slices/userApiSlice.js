// features/user/userApiSlice.js
import { apiSlice } from './apiSlice';

const USERS_URL = '/users';

export const userApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({

    // ═══════════════════════════════════════════════════════════════
    // AUTHENTICATION
    //
    // NOTE: register / verifyEmail / login / googleAuth all trigger
    // linkPendingAssociateInvites() on the server. This auto-links any
    // pending associate invitations matching the user's email — no
    // client-side cooperation needed. The user just signs up/logs in
    // normally and their project + tasks appear automatically.
    // ═══════════════════════════════════════════════════════════════

    googleAuth: builder.mutation({
      query: (data) => ({
        url: `${USERS_URL}/google`,
        method: 'POST',
        body: data, // { token: googleToken, mode: 'signup' | 'login' }
      }),
      invalidatesTags: ['User', 'Workspace'],
    }),

    register: builder.mutation({
      query: (data) => ({
        url: `${USERS_URL}/register`,
        method: 'POST',
        body: data, // { name, email, phone, password, acceptedTerms }
      }),
      invalidatesTags: ['User'],
    }),

    verifyEmail: builder.mutation({
      query: (data) => ({
        url: `${USERS_URL}/verify-email`,
        method: 'POST',
        body: data, // { email, otp }
      }),
      // This is the moment associate invites get linked. Invalidate
      // Workspace so the newly-added workspace shows up on the dashboard.
      invalidatesTags: ['User', 'Workspace'],
    }),

    resendOTP: builder.mutation({
      query: (data) => ({
        url: `${USERS_URL}/resend-otp`,
        method: 'POST',
        body: data, // { email }
      }),
    }),

    login: builder.mutation({
      query: (data) => ({
        url: `${USERS_URL}/login`,
        method: 'POST',
        body: data, // { email, password }
      }),
      // Login can also link pending associate invites, so invalidate
      // Workspace to refresh the dashboard with any newly-visible ones.
      invalidatesTags: ['User', 'Workspace'],
    }),

    forgotPassword: builder.mutation({
      query: (data) => ({
        url: `${USERS_URL}/forgot-password`,
        method: 'POST',
        body: data, // { email }
      }),
    }),

    resetPassword: builder.mutation({
      query: (data) => ({
        url: `${USERS_URL}/reset-password`,
        method: 'POST',
        body: data, // { email, otp, newPassword }
      }),
    }),

    changePassword: builder.mutation({
      query: (data) => ({
        url: `${USERS_URL}/change-password`,
        method: 'POST',
        body: data, // { currentPassword, newPassword }
      }),
      invalidatesTags: ['User'],
    }),

    logout: builder.mutation({
      query: () => ({
        url: `${USERS_URL}/logout`,
        method: 'POST',
      }),
      // Clear all cached data on logout so a different user doesn't
      // see the previous user's workspaces / projects / associates.
      invalidatesTags: ['User', 'Workspace', 'Project', 'Team', 'Associate'],
    }),

    // ═══════════════════════════════════════════════════════════════
    // PROFILE
    // ═══════════════════════════════════════════════════════════════

    updateProfile: builder.mutation({
      query: (data) => ({
        url: `${USERS_URL}/profile`,
        method: 'PUT',
        body: data, // FormData with 'name', 'phone', 'profile' (file)
      }),
      invalidatesTags: ['User'],
    }),

    // ═══════════════════════════════════════════════════════════════
    // USER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    getUsers: builder.query({
      query: () => ({
        url: USERS_URL,
      }),
      providesTags: ['User'],
    }),

    getUserById: builder.query({
      query: (id) => ({
        url: `${USERS_URL}/${id}`,
      }),
      providesTags: (result, error, id) => [{ type: 'User', id }],
    }),

  }),
});

export const {
  // Auth
  useGoogleAuthMutation,
  useRegisterMutation,
  useVerifyEmailMutation,
  useResendOTPMutation,
  useLoginMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useLogoutMutation,

  // Profile
  useUpdateProfileMutation,

  // User Management
  useGetUsersQuery,
  useGetUserByIdQuery,
} = userApiSlice;