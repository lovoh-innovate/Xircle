// src/slices/workspaceNoteApiSlice.js
import { apiSlice } from './apiSlice';

const WORKSPACE_NOTES_URL = '/workspace-notes';

export const workspaceNoteApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Create a workspace note ────────────────────────────────────────
    createWorkspaceNote: builder.mutation({
      query: (data) => {
        const isFormData = data instanceof FormData;
        return {
          url: `${WORKSPACE_NOTES_URL}`,
          method: 'POST',
          body: data,
          headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
        };
      },
      invalidatesTags: ['WorkspaceNote'],
    }),

    // ─── Get all notes for a workspace ──────────────────────────────────
    getWorkspaceNotes: builder.query({
      query: (workspaceId) => ({
        url: `${WORKSPACE_NOTES_URL}/${workspaceId}`,
      }),
      providesTags: (result, error, workspaceId) =>
        result
          ? [
              ...result.notes.map((note) => ({ type: 'WorkspaceNote', id: note._id })),
              { type: 'WorkspaceNote', id: 'LIST' },
              { type: 'WorkspaceNote', id: workspaceId },
            ]
          : [{ type: 'WorkspaceNote', id: 'LIST' }, { type: 'WorkspaceNote', id: workspaceId }],
    }),

    // ─── Get a single workspace note by ID ─────────────────────────────
    getWorkspaceNote: builder.query({
      query: (noteId) => ({
        url: `${WORKSPACE_NOTES_URL}/note/${noteId}`,
      }),
      providesTags: (result, error, noteId) => [{ type: 'WorkspaceNote', id: noteId }],
    }),

    // ─── Update a workspace note ──────────────────────────────────────
    updateWorkspaceNote: builder.mutation({
      query: ({ noteId, data }) => {
        const isFormData = data instanceof FormData;
        return {
          url: `${WORKSPACE_NOTES_URL}/${noteId}`,
          method: 'PUT',
          body: data,
          headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
        };
      },
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'WorkspaceNote', id: noteId },
        'WorkspaceNote',
      ],
    }),

    // ─── Delete a workspace note ──────────────────────────────────────
    deleteWorkspaceNote: builder.mutation({
      query: (noteId) => ({
        url: `${WORKSPACE_NOTES_URL}/${noteId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, noteId) => [
        { type: 'WorkspaceNote', id: noteId },
        'WorkspaceNote',
      ],
    }),

    // ─── Export workspace note as PDF ──────────────────────────────────
    exportWorkspaceNotePDF: builder.query({
      query: (noteId) => ({
        url: `${WORKSPACE_NOTES_URL}/${noteId}/export-pdf`,
        method: 'GET',
        responseHandler: (response) => response.blob(),
        cache: false,
      }),
    }),

    // ─── Import file to create workspace note ──────────────────────────
    importFileToWorkspaceNote: builder.mutation({
      query: (data) => {
        const formData = new FormData();
        if (data.file) formData.append('file', data.file);
        if (data.title) formData.append('title', data.title);
        if (data.workspaceId) formData.append('workspaceId', data.workspaceId);
        return {
          url: `${WORKSPACE_NOTES_URL}/import`,
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: ['WorkspaceNote'],
    }),
  }),
});

export const {
  useCreateWorkspaceNoteMutation,
  useGetWorkspaceNotesQuery,
  useLazyGetWorkspaceNotesQuery,
  useGetWorkspaceNoteQuery,
  useLazyGetWorkspaceNoteQuery,
  useUpdateWorkspaceNoteMutation,
  useDeleteWorkspaceNoteMutation,
  useExportWorkspaceNotePDFQuery,
  useLazyExportWorkspaceNotePDFQuery,
  useImportFileToWorkspaceNoteMutation,
} = workspaceNoteApiSlice;