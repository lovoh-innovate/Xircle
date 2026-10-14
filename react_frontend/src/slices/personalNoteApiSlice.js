// src/slices/personalNoteApiSlice.js
import { apiSlice } from './apiSlice';

const NOTES_URL = '/personal-notes';

export const personalNoteApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ═══════════════════════════════════════════════════════════════════
    // CRUD
    // ═══════════════════════════════════════════════════════════════════

    // ─── Create a note ──────────────────────────────────────────────
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

    // ─── Get all user's notes ───────────────────────────────────────
    // Pass an optional folderId:
    //   useGetNotesQuery()                     → all notes
    //   useGetNotesQuery('root')               → unfiled only
    //   useGetNotesQuery('<folderId>')         → notes in that folder
    getNotes: builder.query({
      query: (folderId) => ({
        url: `${NOTES_URL}`,
        params: folderId ? { folderId } : undefined,
      }),
      providesTags: ['PersonalNote'],
    }),

    // ─── Get a single note by ID ────────────────────────────────────
    getNote: builder.query({
      query: (noteId) => ({
        url: `${NOTES_URL}/${noteId}`,
      }),
      providesTags: (result, error, noteId) => [{ type: 'PersonalNote', id: noteId }],
    }),

    // ─── Update a note ──────────────────────────────────────────────
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
        'PersonalNote',
      ],
    }),

    // ─── Change a note's color only ─────────────────────────────────
    // Send { noteId, color } where color is any CSS color string or null
    // (null clears the color). Uses the lightweight dedicated endpoint
    // so it doesn't touch the title/content autosave pipeline.
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

    // ─── Move a note to a folder (or root) ──────────────────────────
    // Send { noteId, folderId } where folderId is a folder _id OR null
    // (null = unfiled / root).
    moveNote: builder.mutation({
      query: ({ noteId, folderId }) => ({
        url: `${NOTES_URL}/${noteId}/move`,
        method: 'PATCH',
        body: { folderId },
      }),
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'PersonalNote', id: noteId },
        'PersonalNote',
        'PersonalNoteFolder', // counts per folder may change
      ],
    }),

    // ─── Delete a note ──────────────────────────────────────────────
    deleteNote: builder.mutation({
      query: (noteId) => ({
        url: `${NOTES_URL}/${noteId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, noteId) => [
        { type: 'PersonalNote', id: noteId },
        'PersonalNote',
      ],
    }),

    // ─── Toggle public status ───────────────────────────────────────
    togglePublic: builder.mutation({
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

    // ─── Get a public note by share link ────────────────────────────
    getNoteByShareLink: builder.query({
      query: (link) => ({
        url: `${NOTES_URL}/share/${link}`,
      }),
      providesTags: (result, error, link) => [{ type: 'PersonalNote', id: link }],
    }),

    // ═══════════════════════════════════════════════════════════════════
    // Folders
    // ═══════════════════════════════════════════════════════════════════

    // ─── Create a folder ────────────────────────────────────────────
    // Send { name, parentId?, color? }
    createNoteFolder: builder.mutation({
      query: (data) => ({
        url: `${NOTES_URL}/folders`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['PersonalNoteFolder'],
    }),

    // ─── Get all folders (flat list; build the tree client-side) ────
    getNoteFolders: builder.query({
      query: () => ({
        url: `${NOTES_URL}/folders`,
      }),
      providesTags: ['PersonalNoteFolder'],
    }),

    // ─── Update a folder ────────────────────────────────────────────
    // Send { folderId, data } where data may contain:
    //   { name?, color?, order?, parentId? }
    //   parentId: null → move to root
    updateNoteFolder: builder.mutation({
      query: ({ folderId, data }) => ({
        url: `${NOTES_URL}/folders/${folderId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['PersonalNoteFolder', 'PersonalNote'],
    }),

    // ─── Change a folder's color only ───────────────────────────────
    // Send { folderId, color } where color is any CSS color string or
    // null (null clears the color).
    updateNoteFolderColor: builder.mutation({
      query: ({ folderId, color }) => ({
        url: `${NOTES_URL}/folders/${folderId}/color`,
        method: 'PATCH',
        body: { color },
      }),
      invalidatesTags: ['PersonalNoteFolder', 'PersonalNote'],
    }),

    // ─── Delete a folder ────────────────────────────────────────────
    // Send { folderId, moveNotesTo? }
    //   moveNotesTo: 'parent' (default) | 'root' | '<folderId>'
    deleteNoteFolder: builder.mutation({
      query: ({ folderId, moveNotesTo }) => ({
        url: `${NOTES_URL}/folders/${folderId}`,
        method: 'DELETE',
        body: moveNotesTo ? { moveNotesTo } : {},
      }),
      invalidatesTags: ['PersonalNoteFolder', 'PersonalNote'],
    }),

    // ═══════════════════════════════════════════════════════════════════
    // Collaborators
    // ═══════════════════════════════════════════════════════════════════

    addCollaborator: builder.mutation({
      query: ({ noteId, data }) => ({
        url: `${NOTES_URL}/${noteId}/collaborators`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'PersonalNote', id: noteId },
        'PersonalNote',
      ],
    }),

    removeCollaborator: builder.mutation({
      query: ({ noteId, collaboratorId }) => ({
        url: `${NOTES_URL}/${noteId}/collaborators/${collaboratorId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'PersonalNote', id: noteId },
        'PersonalNote',
      ],
    }),

    updateCollaboratorPermission: builder.mutation({
      query: ({ noteId, collaboratorId, permission }) => ({
        url: `${NOTES_URL}/${noteId}/collaborators/${collaboratorId}`,
        method: 'PATCH',
        body: { permission },
      }),
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'PersonalNote', id: noteId },
        'PersonalNote',
      ],
    }),

    // ═══════════════════════════════════════════════════════════════════
    // Export / Import
    // ═══════════════════════════════════════════════════════════════════

    exportNotePDF: builder.query({
      query: (noteId) => ({
        url: `${NOTES_URL}/${noteId}/export-pdf`,
        method: 'GET',
        responseHandler: (response) => response.blob(),
        cache: 'no-store',
      }),
    }),

    // Send { file, title?, folderId?, color? }
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

    // ═══════════════════════════════════════════════════════════════════
    // AI  (unchanged — nothing to cache, all mutations)
    // ═══════════════════════════════════════════════════════════════════

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
  useUpdateNoteMutation,
  useUpdateNoteColorMutation,        // 👈 new
  useMoveNoteMutation,
  useDeleteNoteMutation,
  useTogglePublicMutation,
  useGetNoteByShareLinkQuery,
  useLazyGetNoteByShareLinkQuery,

  // Folders
  useCreateNoteFolderMutation,
  useGetNoteFoldersQuery,
  useLazyGetNoteFoldersQuery,
  useUpdateNoteFolderMutation,
  useUpdateNoteFolderColorMutation,  // 👈 new
  useDeleteNoteFolderMutation,

  // Collaborators
  useAddCollaboratorMutation,
  useRemoveCollaboratorMutation,
  useUpdateCollaboratorPermissionMutation,

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