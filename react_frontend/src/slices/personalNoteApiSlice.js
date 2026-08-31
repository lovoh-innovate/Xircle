// src/slices/personalNoteApiSlice.js
import { apiSlice } from './apiSlice';

const NOTES_URL = '/personal-notes';

export const personalNoteApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Create a note ───────────────────────────────────────────────────
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

    // ─── Get all user's notes ──────────────────────────────────────────
    getNotes: builder.query({
      query: () => ({
        url: `${NOTES_URL}`,
      }),
      providesTags: ['PersonalNote'],
    }),

    // ─── Get a single note by ID ──────────────────────────────────────
    getNote: builder.query({
      query: (noteId) => ({
        url: `${NOTES_URL}/${noteId}`,
      }),
      providesTags: (result, error, noteId) => [{ type: 'PersonalNote', id: noteId }],
    }),

    // ─── Update a note ──────────────────────────────────────────────────
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

    // ─── Delete a note ──────────────────────────────────────────────────
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

    // ─── Toggle public status ──────────────────────────────────────────
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

    // ─── Get a public note by share link ──────────────────────────────
    getNoteByShareLink: builder.query({
      query: (link) => ({
        url: `${NOTES_URL}/share/${link}`,
      }),
      providesTags: (result, error, link) => [{ type: 'PersonalNote', id: link }],
    }),

    // ─── Collaborators ──────────────────────────────────────────────────
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

    // ─── Export as PDF ──────────────────────────────────────────────────
    exportNotePDF: builder.query({
      query: (noteId) => ({
        url: `${NOTES_URL}/${noteId}/export-pdf`,
        method: 'GET',
        responseHandler: (response) => response.blob(),
        cache: false,
      }),
    }),

    // ─── Import file to create note ────────────────────────────────────
    importFileToNote: builder.mutation({
      query: (data) => {
        const formData = new FormData();
        if (data.file) formData.append('file', data.file);
        if (data.title) formData.append('title', data.title);
        return {
          url: `${NOTES_URL}/import`,
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: ['PersonalNote'],
    }),
  }),
});

export const {
  useCreateNoteMutation,
  useGetNotesQuery,
  useLazyGetNotesQuery,
  useGetNoteQuery,
  useLazyGetNoteQuery,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
  useTogglePublicMutation,
  useGetNoteByShareLinkQuery,
  useLazyGetNoteByShareLinkQuery,
  useAddCollaboratorMutation,
  useRemoveCollaboratorMutation,
  useUpdateCollaboratorPermissionMutation,
  useExportNotePDFQuery,
  useLazyExportNotePDFQuery,
  useImportFileToNoteMutation,
} = personalNoteApiSlice;