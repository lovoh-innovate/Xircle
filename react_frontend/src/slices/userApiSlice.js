// features/user/userApiSlice.js
import { apiSlice } from './apiSlice';

const USERS_URL = '/users';

export const userApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({

    // ─── AUTHENTICATION ─────────────────────────────────────────────

    googleAuth: builder.mutation({
      query: (data) => ({
        url: `${USERS_URL}/google`,
        method: 'POST',
        body: data, // { token: googleToken, mode: 'signup' | 'login' }
      }),
      invalidatesTags: ['User'],
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
      invalidatesTags: ['User'],
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
      invalidatesTags: ['User'],
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
    }),

    // ─── PROFILE ─────────────────────────────────────────────────────

    updateProfile: builder.mutation({
      query: (data) => ({
        url: `${USERS_URL}/profile`,
        method: 'PUT',
        body: data, // FormData with 'name', 'phone', 'profile' (file)
      }),
      invalidatesTags: ['User'],
    }),

    // ─── USER MANAGEMENT ─────────────────────────────────────────────

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