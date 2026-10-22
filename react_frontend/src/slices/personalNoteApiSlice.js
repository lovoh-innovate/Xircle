// src/slices/personalNoteApiSlice.js
import { apiSlice } from './apiSlice';

const NOTES_URL = '/personal-notes';

export const personalNoteApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ─── CRUD ───────────────────────────────────────────────────────
    createNote: builder.mutation({
      query: (data) => {
        const isFormData = data instanceof FormData;
        return {
          url: `${NOTES_URL}`,
          method: 'POST',
          body: data,
          headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
        };
      },
      invalidatesTags: ['PersonalNote'],
    }),

    getNotes: builder.query({
      query: (folderId) => ({
        url: `${NOTES_URL}`,
        params: folderId ? { folderId } : undefined,
      }),
      providesTags: ['PersonalNote'],
    }),

    // Accepts ObjectId OR slug — the backend resolves both transparently.
    getNote: builder.query({
      query: (noteId) => ({
        url: `${NOTES_URL}/${noteId}`,
      }),
      providesTags: (result, error, noteId) => [
        { type: 'PersonalNote', id: noteId },
      ],
    }),

    // 🌟 NEW: Fetch collaborators and edit history for a specific note
    getNoteCollaborators: builder.query({
      query: (noteId) => ({
        url: `${NOTES_URL}/${noteId}/collaborators`,
      }),
      providesTags: (result, error, noteId) => [
        { type: 'PersonalNote', id: `collaborators:${noteId}` },
        { type: 'PersonalNote', id: noteId },
      ],
    }),

    // ─── LEGACY: Get public note by share link ──────────────────────
    // Kept for old users who have /share/:link URLs (e.g. PublicNote.jsx).
    getNoteByShareLink: builder.query({
      query: (link) => ({
        url: `${NOTES_URL}/share/${link}`,
      }),
      providesTags: (result, error, link) => [
        { type: 'PersonalNote', id: `share:${link}` },
      ],
    }),

    updateNote: builder.mutation({
      query: ({ noteId, data }) => {
        const isFormData = data instanceof FormData;
        return {
          url: `${NOTES_URL}/${noteId}`,
          method: 'PUT',
          body: data,
          headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
        };
      },
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'PersonalNote', id: noteId },
        // Also invalidate collaborators/history since editing updates history
        { type: 'PersonalNote', id: `collaborators:${noteId}` },
        'PersonalNote',
      ],
    }),

    updateNoteColor: builder.mutation({
      query: ({ noteId, color }) => ({
        url: `${NOTES_URL}/${noteId}/color`,
        method: 'PATCH',
        body: { color },
      }),
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'PersonalNote', id: noteId },
        'PersonalNote',
      ],
    }),

    moveNote: builder.mutation({
      query: ({ noteId, folderId }) => ({
        url: `${NOTES_URL}/${noteId}/move`,
        method: 'PATCH',
        body: { folderId },
      }),
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'PersonalNote', id: noteId },
        'PersonalNote',
        'PersonalNoteFolder',
      ],
    }),

    deleteNote: builder.mutation({
      query: (noteId) => ({
        url: `${NOTES_URL}/${noteId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, noteId) => [
        { type: 'PersonalNote', id: noteId },
        { type: 'PersonalNote', id: 'all-pending-requests' }, // Clear requests on delete
        'PersonalNote',
      ],
    }),

    // Renamed: "togglePublic" is a generic name that can collide with other slices
    toggleNotePublic: builder.mutation({
      query: ({ noteId, isPublic }) => ({
        url: `${NOTES_URL}/${noteId}/public`,
        method: 'PATCH',
        body: { isPublic },
      }),
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'PersonalNote', id: noteId },
        'PersonalNote',
      ],
    }),

    // ─── Folders ────────────────────────────────────────────────────
    createNoteFolder: builder.mutation({
      query: (data) => ({
        url: `${NOTES_URL}/folders`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['PersonalNoteFolder'],
    }),

    getNoteFolders: builder.query({
      query: () => ({
        url: `${NOTES_URL}/folders`,
      }),
      providesTags: ['PersonalNoteFolder'],
    }),

    updateNoteFolder: builder.mutation({
      query: ({ folderId, data }) => ({
        url: `${NOTES_URL}/folders/${folderId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['PersonalNoteFolder', 'PersonalNote'],
    }),

    updateNoteFolderColor: builder.mutation({
      query: ({ folderId, color }) => ({
        url: `${NOTES_URL}/folders/${folderId}/color`,
        method: 'PATCH',
        body: { color },
      }),
      invalidatesTags: ['PersonalNoteFolder', 'PersonalNote'],
    }),

    deleteNoteFolder: builder.mutation({
      query: ({ folderId, moveNotesTo }) => ({
        url: `${NOTES_URL}/folders/${folderId}`,
        method: 'DELETE',
        body: moveNotesTo ? { moveNotesTo } : {},
      }),
      invalidatesTags: ['PersonalNoteFolder', 'PersonalNote'],
    }),

    // ─── Collaborators ──────────────────────────────────────────────
    addNoteCollaborator: builder.mutation({
      query: ({ noteId, data }) => ({
        url: `${NOTES_URL}/${noteId}/collaborators`,
        method: 'POST',
        body: {
          ...data,
          collaboratorEmail: data?.collaboratorIdentifier,
        },
      }),
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'PersonalNote', id: noteId },
        { type: 'PersonalNote', id: `collaborators:${noteId}` },
        'PersonalNote',
      ],
    }),

    removeNoteCollaborator: builder.mutation({
      query: ({ noteId, collaboratorId }) => ({
        url: `${NOTES_URL}/${noteId}/collaborators/${collaboratorId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'PersonalNote', id: noteId },
        { type: 'PersonalNote', id: `collaborators:${noteId}` },
        'PersonalNote',
      ],
    }),

    updateNoteCollaboratorPermission: builder.mutation({
      query: ({ noteId, collaboratorId, permission }) => ({
        url: `${NOTES_URL}/${noteId}/collaborators/${collaboratorId}`,
        method: 'PATCH',
        body: { permission },
      }),
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'PersonalNote', id: noteId },
        { type: 'PersonalNote', id: `collaborators:${noteId}` },
        'PersonalNote',
      ],
    }),

    // ─── Access Requests ────────────────────────────────────────────
    // Any signed-in user who can view a public note can request collaborator access.
    requestNoteAccess: builder.mutation({
      query: ({ noteId, message = '' }) => ({
        url: `${NOTES_URL}/${noteId}/request-access`,
        method: 'POST',
        body: message ? { message } : {},
      }),
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'PersonalNote', id: noteId },
        { type: 'PersonalNote', id: 'all-pending-requests' },
        'PersonalNote',
      ],
    }),

    // 🌟 NEW: Global Dashboard — fetch ALL pending requests across all owned notes
    getAllPendingRequests: builder.query({
      query: () => `${NOTES_URL}/access-requests/all`,
      providesTags: [
        { type: 'PersonalNote', id: 'all-pending-requests' },
        'PersonalNote',
      ],
    }),

    // Owner-only — list of pending access requests on a single note.
    getNoteAccessRequests: builder.query({
      query: (noteId) => ({
        url: `${NOTES_URL}/${noteId}/access-requests`,
      }),
      providesTags: (result, error, noteId) => [
        { type: 'PersonalNote', id: `access-requests:${noteId}` },
      ],
    }),

    // Owner-only — approve or reject a specific request.
    // `action` = 'approve' | 'reject'
    resolveNoteAccessRequest: builder.mutation({
      query: ({ noteId, requestId, action }) => ({
        url: `${NOTES_URL}/${noteId}/access-requests/${requestId}`,
        method: 'PATCH',
        body: { action },
      }),
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'PersonalNote', id: noteId },
        { type: 'PersonalNote', id: `access-requests:${noteId}` },
        { type: 'PersonalNote', id: `collaborators:${noteId}` }, // Approved users become collabs
        { type: 'PersonalNote', id: 'all-pending-requests' },
        'PersonalNote',
      ],
    }),

    // ─── Export / Import ────────────────────────────────────────────
    exportNotePDF: builder.query({
      query: (noteId) => ({
        url: `${NOTES_URL}/${noteId}/export-pdf`,
        method: 'GET',
        responseHandler: (response) => response.blob(),
        cache: 'no-store',
      }),
    }),

    importFileToNote: builder.mutation({
      query: (data) => {
        const formData = new FormData();
        if (data.file) formData.append('file', data.file);
        if (data.title) formData.append('title', data.title);
        if (data.folderId) formData.append('folderId', data.folderId);
        if (data.color) formData.append('color', data.color);
        return {
          url: `${NOTES_URL}/import`,
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: ['PersonalNote'],
    }),

    // ─── AI ─────────────────────────────────────────────────────────
    lookupScripture: builder.mutation({
      query: ({ text, noteId }) => ({
        url: `${NOTES_URL}/ai/scripture`,
        method: 'POST',
        body: { text, noteId },
      }),
    }),

    expandScripture: builder.mutation({
      query: ({ type, parsed, expand }) => ({
        url: `${NOTES_URL}/ai/scripture/expand`,
        method: 'POST',
        body: { type, parsed, expand },
      }),
    }),

    searchHighlight: builder.mutation({
      query: ({ text, context, noteId }) => ({
        url: `${NOTES_URL}/ai/search`,
        method: 'POST',
        body: { text, context, noteId },
      }),
    }),

    proofreadNote: builder.mutation({
      query: ({ noteId, content, title }) => ({
        url: `${NOTES_URL}/ai/proofread`,
        method: 'POST',
        body: { noteId, content, title },
      }),
    }),

    completeNote: builder.mutation({
      query: ({ noteId, content, title, style }) => ({
        url: `${NOTES_URL}/ai/complete`,
        method: 'POST',
        body: { noteId, content, title, style },
      }),
    }),

    rewriteNote: builder.mutation({
      query: ({ noteId, content, title, instructions, style, length }) => ({
        url: `${NOTES_URL}/ai/rewrite`,
        method: 'POST',
        body: { noteId, content, title, instructions, style, length },
      }),
    }),
  }),
});

export const {
  // CRUD
  useCreateNoteMutation,
  useGetNotesQuery,
  useLazyGetNotesQuery,
  useGetNoteQuery,
  useLazyGetNoteQuery,
  useGetNoteCollaboratorsQuery,        // 🌟 NEW
  useLazyGetNoteCollaboratorsQuery,    // 🌟 NEW
  useGetNoteByShareLinkQuery,
  useLazyGetNoteByShareLinkQuery,
  useUpdateNoteMutation,
  useUpdateNoteColorMutation,
  useMoveNoteMutation,
  useDeleteNoteMutation,
  useToggleNotePublicMutation,

  // Folders
  useCreateNoteFolderMutation,
  useGetNoteFoldersQuery,
  useLazyGetNoteFoldersQuery,
  useUpdateNoteFolderMutation,
  useUpdateNoteFolderColorMutation,
  useDeleteNoteFolderMutation,

  // Collaborators
  useAddNoteCollaboratorMutation,
  useRemoveNoteCollaboratorMutation,
  useUpdateNoteCollaboratorPermissionMutation,

  // Access Requests
  useRequestNoteAccessMutation,
  useGetAllPendingRequestsQuery,       // 🌟 NEW
  useLazyGetAllPendingRequestsQuery,   // 🌟 NEW
  useGetNoteAccessRequestsQuery,
  useLazyGetNoteAccessRequestsQuery,
  useResolveNoteAccessRequestMutation,

  // Export / Import
  useExportNotePDFQuery,
  useLazyExportNotePDFQuery,
  useImportFileToNoteMutation,

  // AI
  useLookupScriptureMutation,
  useExpandScriptureMutation,
  useSearchHighlightMutation,
  useProofreadNoteMutation,
  useCompleteNoteMutation,
  useRewriteNoteMutation,
} = personalNoteApiSlice;

// ─── Aliases so existing imports in WriteNote.jsx keep working ─────────
export {
  useAddNoteCollaboratorMutation as useAddCollaboratorMutation,
  useRemoveNoteCollaboratorMutation as useRemoveCollaboratorMutation,
  useUpdateNoteCollaboratorPermissionMutation as useUpdateCollaboratorPermissionMutation,
  useToggleNotePublicMutation as useTogglePublicMutation,
} from './personalNoteApiSlice';