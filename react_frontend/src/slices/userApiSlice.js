// features/user/userApiSlice.js
import { apiSlice } from './apiSlice';

const USERS_URL = '/users';

export const userApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({

    // ─── AUTHENTICATION ─────────────────────────────────────────────

    // Google Auth (Signup/Login)
    googleAuth: builder.mutation({
      query: (data) => ({
        url: `${USERS_URL}/google`,
        method: 'POST',
        body: data, // { token: googleToken, mode: 'signup' | 'login' }
      }),
      invalidatesTags: ['User'],
    }),

    // Local Signup (email/password)
    register: builder.mutation({
      query: (data) => ({
        url: `${USERS_URL}/register`,
        method: 'POST',
        body: data, // { name, email, phone, password, acceptedTerms }
      }),
      invalidatesTags: ['User'],
    }),

    // Verify Email with OTP
    verifyEmail: builder.mutation({
      query: (data) => ({
        url: `${USERS_URL}/verify-email`,
        method: 'POST',
        body: data, // { email, otp }
      }),
      invalidatesTags: ['User'],
    }),

    // Resend OTP
    resendOTP: builder.mutation({
      query: (data) => ({
        url: `${USERS_URL}/resend-otp`,
        method: 'POST',
        body: data, // { email }
      }),
    }),

    // Local Login (email/password)
    login: builder.mutation({
      query: (data) => ({
        url: `${USERS_URL}/login`,
        method: 'POST',
        body: data, // { email, password }
      }),
      invalidatesTags: ['User'],
    }),

    // Forgot Password - Send OTP
    forgotPassword: builder.mutation({
      query: (data) => ({
        url: `${USERS_URL}/forgot-password`,
        method: 'POST',
        body: data, // { email }
      }),
    }),

    // Reset Password - Verify OTP & Set New Password
    resetPassword: builder.mutation({
      query: (data) => ({
        url: `${USERS_URL}/reset-password`,
        method: 'POST',
        body: data, // { email, otp, newPassword }
      }),
    }),

    // Change Password (authenticated user)
    changePassword: builder.mutation({
      query: (data) => ({
        url: `${USERS_URL}/change-password`,
        method: 'POST',
        body: data, // { currentPassword, newPassword }
      }),
      invalidatesTags: ['User'],
    }),

    // Logout
    logout: builder.mutation({
      query: () => ({
        url: `${USERS_URL}/logout`,
        method: 'POST',
      }),
    }),

    // ─── PROFILE ─────────────────────────────────────────────────────

    // Update Profile (name, phone, profile picture)
    updateProfile: builder.mutation({
      query: (data) => ({
        url: `${USERS_URL}/profile`,
        method: 'PUT',
        body: data, // FormData with 'name', 'phone', 'profile' (file)
      }),
      invalidatesTags: ['User'],
    }),

    // ─── USER MANAGEMENT ─────────────────────────────────────────────

    // Get All Users (Admin only)
    getUsers: builder.query({
      query: () => ({
        url: USERS_URL,
      }),
      providesTags: ['User'],
    }),

    // Get User by ID
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