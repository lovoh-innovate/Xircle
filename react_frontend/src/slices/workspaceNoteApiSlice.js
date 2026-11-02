// src/slices/workspaceNoteApiSlice.js
import { apiSlice } from './apiSlice';

const WORKSPACE_NOTES_URL = '/workspace-notes';

// ─── Payload helpers ──────────────────────────────────────────────────
// Normalize whatever the caller passes into a body fetch can send, without
// ever producing the string "null" / "undefined" for a FormData field.
const buildBody = (data) => {
  if (data instanceof FormData) {
    const clean = new FormData();
    for (const [key, value] of data.entries()) {
      // Skip values that were coerced from null/undefined by .append().
      if (value === 'null' || value === 'undefined') continue;
      // Skip empty strings for optional-ish fields so the backend sees "absent".
      // (For title/content this is fine — backend trims and defaults to ''.)
      clean.append(key, value);
    }
    return { body: clean, headers: undefined };
  }

  // Plain object → JSON. Drop `undefined` (JSON would drop it anyway) but KEEP
  // `null` — the backend interprets `folderId: null` / `color: null` correctly.
  const clean = {};
  Object.entries(data || {}).forEach(([k, v]) => {
    if (v !== undefined) clean[k] = v;
  });
  return { body: clean, headers: { 'Content-Type': 'application/json' } };
};

// Extract workspaceId from either a plain object or a FormData.
const workspaceIdOf = (arg) => {
  if (!arg) return null;
  if (arg instanceof FormData) return arg.get('workspaceId') || null;
  return arg.workspaceId || null;
};

export const workspaceNoteApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ═══════════════════════════════════════════════════════════════════
    // CRUD
    // ═══════════════════════════════════════════════════════════════════

    createWorkspaceNote: builder.mutation({
      query: (data) => {
        const { body, headers } = buildBody(data);
        return { url: WORKSPACE_NOTES_URL, method: 'POST', body, headers };
      },
      invalidatesTags: (result, error, arg) => {
        const workspaceId = workspaceIdOf(arg);
        return [
          { type: 'WorkspaceNote', id: 'LIST' },
          ...(workspaceId ? [{ type: 'WorkspaceNote', id: workspaceId }] : []),
          'WorkspaceNote',
          'WorkspaceNoteFolder',
        ];
      },
    }),

    getWorkspaceNotes: builder.query({
      query: (arg) => {
        const workspaceId = typeof arg === 'string' ? arg : arg?.workspaceId;
        const folderId = typeof arg === 'string' ? undefined : arg?.folderId;
        return {
          url: `${WORKSPACE_NOTES_URL}/${workspaceId}`,
          params: folderId ? { folderId } : undefined,
        };
      },
      providesTags: (result, error, arg) => {
        const workspaceId = typeof arg === 'string' ? arg : arg?.workspaceId;
        const base = [
          { type: 'WorkspaceNote', id: 'LIST' },
          { type: 'WorkspaceNote', id: workspaceId },
        ];
        const list = Array.isArray(result?.notes) ? result.notes : [];
        return [
          ...list.map((n) => ({ type: 'WorkspaceNote', id: n._id })),
          ...base,
        ];
      },
    }),

    getWorkspaceNote: builder.query({
      query: (noteId) => ({ url: `${WORKSPACE_NOTES_URL}/note/${noteId}` }),
      providesTags: (result, error, noteId) => [
        { type: 'WorkspaceNote', id: noteId },
      ],
    }),

    getPublicWorkspaceNote: builder.query({
      query: ({ workspaceId, noteId }) => ({
        url: `${WORKSPACE_NOTES_URL}/public/${workspaceId}/${noteId}`,
      }),
      providesTags: (result, error, { noteId }) => [
        { type: 'WorkspaceNote', id: noteId },
        { type: 'WorkspaceNote', id: 'PUBLIC' },
      ],
    }),

    updateWorkspaceNote: builder.mutation({
      query: ({ noteId, data }) => {
        const { body, headers } = buildBody(data);
        return {
          url: `${WORKSPACE_NOTES_URL}/${noteId}`,
          method: 'PUT',
          body,
          headers,
        };
      },
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'WorkspaceNote', id: noteId },
        { type: 'WorkspaceNote', id: 'LIST' },
        { type: 'WorkspaceNote', id: 'PUBLIC' },
        'WorkspaceNote',
        'WorkspaceNoteFolder',
      ],
    }),

    updateWorkspaceNoteColor: builder.mutation({
      query: ({ noteId, color }) => ({
        url: `${WORKSPACE_NOTES_URL}/${noteId}/color`,
        method: 'PATCH',
        body: { color: color ?? null },
        headers: { 'Content-Type': 'application/json' },
      }),
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'WorkspaceNote', id: noteId },
        { type: 'WorkspaceNote', id: 'LIST' },
        'WorkspaceNote',
      ],
    }),

    updateWorkspaceNoteVisibility: builder.mutation({
      query: ({ noteId, visibility }) => ({
        url: `${WORKSPACE_NOTES_URL}/${noteId}/visibility`,
        method: 'PATCH',
        body: { visibility },
        headers: { 'Content-Type': 'application/json' },
      }),
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'WorkspaceNote', id: noteId },
        { type: 'WorkspaceNote', id: 'LIST' },
        { type: 'WorkspaceNote', id: 'PUBLIC' },
        'WorkspaceNote',
      ],
    }),

    moveWorkspaceNote: builder.mutation({
      query: ({ noteId, folderId }) => ({
        url: `${WORKSPACE_NOTES_URL}/${noteId}/move`,
        method: 'PATCH',
        body: { folderId: folderId ?? null },
        headers: { 'Content-Type': 'application/json' },
      }),
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'WorkspaceNote', id: noteId },
        { type: 'WorkspaceNote', id: 'LIST' },
        'WorkspaceNote',
        'WorkspaceNoteFolder',
      ],
    }),

    deleteWorkspaceNote: builder.mutation({
      query: (noteId) => ({
        url: `${WORKSPACE_NOTES_URL}/${noteId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, noteId) => [
        { type: 'WorkspaceNote', id: noteId },
        { type: 'WorkspaceNote', id: 'LIST' },
        { type: 'WorkspaceNote', id: 'PUBLIC' },
        'WorkspaceNote',
        'WorkspaceNoteFolder',
      ],
    }),

    exportWorkspaceNotePDF: builder.query({
      query: (noteId) => ({
        url: `${WORKSPACE_NOTES_URL}/${noteId}/export-pdf`,
        method: 'GET',
        responseHandler: (response) => response.blob(),
        cache: false,
      }),
    }),

    // importFileToWorkspaceNote: explicit file-aware build — this is the one
    // that WOULD corrupt null→"null", so use the helpers above.
    importFileToWorkspaceNote: builder.mutation({
      query: (data) => {
        const formData = new FormData();
        if (data.file) formData.append('file', data.file);
        if (data.workspaceId) formData.append('workspaceId', data.workspaceId);
        if (data.title != null) formData.append('title', data.title);
        // Only append folderId / color / visibility when they are real values —
        // null/undefined mean "use default / leave unchanged" on the backend.
        if (data.folderId) formData.append('folderId', data.folderId);
        if (data.color) formData.append('color', data.color);
        if (data.visibility) formData.append('visibility', data.visibility);
        return { url: `${WORKSPACE_NOTES_URL}/import`, method: 'POST', body: formData };
      },
      invalidatesTags: (result, error, arg) => {
        const workspaceId = workspaceIdOf(arg);
        return [
          { type: 'WorkspaceNote', id: 'LIST' },
          ...(workspaceId ? [{ type: 'WorkspaceNote', id: workspaceId }] : []),
          'WorkspaceNote',
          'WorkspaceNoteFolder',
        ];
      },
    }),

    // ═══════════════════════════════════════════════════════════════════
    // Folders
    // ═══════════════════════════════════════════════════════════════════

    createWorkspaceNoteFolder: builder.mutation({
      query: (data) => ({
        url: `${WORKSPACE_NOTES_URL}/folders`,
        method: 'POST',
        body: data,
        headers: { 'Content-Type': 'application/json' },
      }),
      invalidatesTags: ['WorkspaceNoteFolder'],
    }),

    getWorkspaceNoteFolders: builder.query({
      query: (workspaceId) => ({
        url: `${WORKSPACE_NOTES_URL}/folders/${workspaceId}`,
      }),
      providesTags: (result, error, workspaceId) => {
        const list = Array.isArray(result?.folders) ? result.folders : [];
        return [
          ...list.map((f) => ({ type: 'WorkspaceNoteFolder', id: f._id })),
          { type: 'WorkspaceNoteFolder', id: 'LIST' },
          { type: 'WorkspaceNoteFolder', id: workspaceId },
        ];
      },
    }),

    updateWorkspaceNoteFolder: builder.mutation({
      query: ({ folderId, data }) => ({
        url: `${WORKSPACE_NOTES_URL}/folders/${folderId}`,
        method: 'PUT',
        body: data,
        headers: { 'Content-Type': 'application/json' },
      }),
      invalidatesTags: (result, error, { folderId }) => [
        { type: 'WorkspaceNoteFolder', id: folderId },
        'WorkspaceNoteFolder',
        'WorkspaceNote',
      ],
    }),

    updateWorkspaceNoteFolderColor: builder.mutation({
      query: ({ folderId, color }) => ({
        url: `${WORKSPACE_NOTES_URL}/folders/${folderId}/color`,
        method: 'PATCH',
        body: { color: color ?? null },
        headers: { 'Content-Type': 'application/json' },
      }),
      invalidatesTags: (result, error, { folderId }) => [
        { type: 'WorkspaceNoteFolder', id: folderId },
        'WorkspaceNoteFolder',
        'WorkspaceNote',
      ],
    }),

    deleteWorkspaceNoteFolder: builder.mutation({
      query: ({ folderId, moveNotesTo }) => ({
        url: `${WORKSPACE_NOTES_URL}/folders/${folderId}`,
        method: 'DELETE',
        body: moveNotesTo ? { moveNotesTo } : {},
        headers: { 'Content-Type': 'application/json' },
      }),
      invalidatesTags: (result, error, { folderId }) => [
        { type: 'WorkspaceNoteFolder', id: folderId },
        'WorkspaceNoteFolder',
        'WorkspaceNote',
      ],
    }),
  }),
});

export const {
  useCreateWorkspaceNoteMutation,
  useGetWorkspaceNotesQuery,
  useLazyGetWorkspaceNotesQuery,
  useGetWorkspaceNoteQuery,
  useLazyGetWorkspaceNoteQuery,
  useGetPublicWorkspaceNoteQuery,
  useLazyGetPublicWorkspaceNoteQuery,
  useUpdateWorkspaceNoteMutation,
  useUpdateWorkspaceNoteColorMutation,
  useUpdateWorkspaceNoteVisibilityMutation,
  useMoveWorkspaceNoteMutation,
  useDeleteWorkspaceNoteMutation,
  useExportWorkspaceNotePDFQuery,
  useLazyExportWorkspaceNotePDFQuery,
  useImportFileToWorkspaceNoteMutation,
  useCreateWorkspaceNoteFolderMutation,
  useGetWorkspaceNoteFoldersQuery,
  useLazyGetWorkspaceNoteFoldersQuery,
  useUpdateWorkspaceNoteFolderMutation,
  useUpdateWorkspaceNoteFolderColorMutation,
  useDeleteWorkspaceNoteFolderMutation,
} = workspaceNoteApiSlice;