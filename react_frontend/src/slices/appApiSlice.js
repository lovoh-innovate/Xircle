// slices/appApiSlice.js
import { apiSlice } from "./apiSlice";

const APP_URL = "/app";
const API_BASE = import.meta.env.VITE_API_URL || "";

// ─── Helper to build download URL ──────────────────────────────────
export const getAppDownloadUrl = (versionId, token) => {
  const url = `${API_BASE}/api${APP_URL}/download/${versionId}`;
  return token ? `${url}?token=${token}` : url;
};

export const appApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Public endpoints ────────────────────────────────────────────────

    checkAppUpdate: builder.query({
      query: ({ platform = "android", currentVersion, token }) => {
        let url = `${APP_URL}/version?platform=${platform}`;
        if (currentVersion) url += `&currentVersion=${currentVersion}`;
        if (token) url += `&token=${token}`;
        return { url, method: "GET" };
      },
      keepUnusedDataFor: 0, // 👈 don't cache this in memory either
      refetchOnMountOrArgChange: true, // 👈 always hit network on mount
    }),

    // GET /api/app/version?platform=android&currentVersion=1.0.0&token=...
    getAppVersion: builder.query({
      query: ({ platform = "android", currentVersion, token }) => ({
        url: `${APP_URL}/version`,
        params: { platform, currentVersion, token },
      }),
      providesTags: ["AppVersion"],
    }),

    // GET /api/app/version/:versionId
    getAppVersionById: builder.query({
      query: (versionId) => `${APP_URL}/version/${versionId}`,
      providesTags: (result, error, id) => [{ type: "AppVersion", id }],
    }),

    // GET /api/app/download/:versionId?token=...
    downloadApp: builder.query({
      query: ({ versionId, token }) => ({
        url: `${APP_URL}/download/${versionId}`,
        params: { token },
        responseHandler: "blob",
      }),
    }),

    // POST /api/app/update-version
    updateUserAppVersion: builder.mutation({
      query: ({ token, version }) => ({
        url: `${APP_URL}/update-version`,
        method: "POST",
        body: { token, version },
      }),
      invalidatesTags: ["AppVersion"],
    }),

    // ─── Admin endpoints ──────────────────────────────────────────────────

    // POST /api/app/admin/upload (multipart/form-data)
    uploadApp: builder.mutation({
      query: (formData) => ({
        url: `${APP_URL}/admin/upload`,
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["AppVersion"],
    }),

    // PUT /api/app/admin/update/:versionId
    updateAppVersion: builder.mutation({
      query: ({ versionId, data }) => ({
        url: `${APP_URL}/admin/update/${versionId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { versionId }) => [
        { type: "AppVersion", id: versionId },
        "AppVersion",
      ],
    }),

    // DELETE /api/app/admin/delete/:versionId
    deleteAppVersion: builder.mutation({
      query: (versionId) => ({
        url: `${APP_URL}/admin/delete/${versionId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, versionId) => [
        { type: "AppVersion", id: versionId },
        "AppVersion",
      ],
    }),

    // GET /api/app/admin/versions?platform=android
    getAppVersions: builder.query({
      query: ({ platform = "android" } = {}) => ({
        url: `${APP_URL}/admin/versions`,
        params: { platform },
      }),
      providesTags: ["AppVersion"],
    }),
  }),
});

export const {
  useCheckAppUpdateQuery,
  useGetAppVersionQuery,
  useGetAppVersionByIdQuery,
  useDownloadAppQuery,
  useUpdateUserAppVersionMutation,
  useUploadAppMutation,
  useUpdateAppVersionMutation,
  useDeleteAppVersionMutation,
  useGetAppVersionsQuery,
} = appApiSlice;

export default appApiSlice;
