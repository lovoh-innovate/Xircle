// src/slices/workspaceNoteApiSlice.js
import { apiSlice } from './apiSlice';

const WORKSPACE_NOTES_URL = '/workspace-notes';

export const workspaceNoteApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ═══════════════════════════════════════════════════════════════════
    // CRUD
    // ═══════════════════════════════════════════════════════════════════

    // ─── Create a workspace note ────────────────────────────────────────
    // Body may include:
    //   { workspaceId, title?, content?, folderId?, color?, visibility? }
    // visibility: 'workspace' (default) | 'public'
    // Drafts allowed — title / content may be empty.
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
      invalidatesTags: ['WorkspaceNote', 'WorkspaceNoteFolder'],
    }),

    // ─── Get all notes for a workspace (optionally filtered by folder) ─
    // Pass either:
    //   useGetWorkspaceNotesQuery(workspaceId)                 → all notes
    //   useGetWorkspaceNotesQuery({ workspaceId, folderId })   → filtered
    //     folderId: '<id>' → notes in that folder
    //     folderId: 'root' → unfiled only
    // Notes now include author + lastEditedBy (but NOT full history) —
    // fetch the single note to render the timeline.
    getWorkspaceNotes: builder.query({
      query: (arg) => {
        const workspaceId = typeof arg === 'string' ? arg : arg.workspaceId;
        const folderId = typeof arg === 'string' ? undefined : arg.folderId;
        return {
          url: `${WORKSPACE_NOTES_URL}/${workspaceId}`,
          params: folderId ? { folderId } : undefined,
        };
      },
      providesTags: (result, error, arg) => {
        const workspaceId = typeof arg === 'string' ? arg : arg.workspaceId;
        const base = [
          { type: 'WorkspaceNote', id: 'LIST' },
          { type: 'WorkspaceNote', id: workspaceId },
        ];
        return result
          ? [
              ...result.notes.map((note) => ({ type: 'WorkspaceNote', id: note._id })),
              ...base,
            ]
          : base;
      },
    }),

    // ─── Get a single workspace note (members only) ────────────────────
    // Returns: note + populated author + lastEditedBy + history + folder.
    getWorkspaceNote: builder.query({
      query: (noteId) => ({
        url: `${WORKSPACE_NOTES_URL}/note/${noteId}`,
      }),
      providesTags: (result, error, noteId) => [{ type: 'WorkspaceNote', id: noteId }],
    }),

    // ─── Get a PUBLIC workspace note (no auth required) ────────────────
    // Used by the public share page at
    //   /workspace/:workspaceId/notes/:noteId
    // Server returns 404 when the note isn't public (or doesn't exist),
    // so we don't leak the existence of private notes.
    //   useGetPublicWorkspaceNoteQuery({ workspaceId, noteId })
    getPublicWorkspaceNote: builder.query({
      query: ({ workspaceId, noteId }) => ({
        url: `${WORKSPACE_NOTES_URL}/public/${workspaceId}/${noteId}`,
      }),
      providesTags: (result, error, { noteId }) => [
        { type: 'WorkspaceNote', id: noteId },
        { type: 'WorkspaceNote', id: 'PUBLIC' },
      ],
    }),

    // ─── Update a workspace note ──────────────────────────────────────
    // Body may include: { title?, content?, folderId?, color?, visibility? }
    //   folderId absent  → leave folder unchanged
    //   folderId null    → move to root
    //   folderId <id>    → move to that folder
    //   visibility       → 'public' | 'workspace'
    // Any changed field is appended to the note's history timeline.
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
        { type: 'WorkspaceNote', id: 'PUBLIC' },
        'WorkspaceNote',
        'WorkspaceNoteFolder',
      ],
    }),

    // ─── Change a note's color only ────────────────────────────────────
    // Send { noteId, color } where color is any CSS color string or null
    // (null clears the color). Uses the lightweight dedicated endpoint
    // so it doesn't touch the title/content autosave pipeline.
    updateWorkspaceNoteColor: builder.mutation({
      query: ({ noteId, color }) => ({
        url: `${WORKSPACE_NOTES_URL}/${noteId}/color`,
        method: 'PATCH',
        body: { color },
      }),
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'WorkspaceNote', id: noteId },
        'WorkspaceNote',
      ],
    }),

    // ─── Change a note's visibility only ───────────────────────────────
    // Send { noteId, visibility } where visibility is 'public' | 'workspace'.
    // Allowed server-side: note author OR workspace Admin/Owner.
    updateWorkspaceNoteVisibility: builder.mutation({
      query: ({ noteId, visibility }) => ({
        url: `${WORKSPACE_NOTES_URL}/${noteId}/visibility`,
        method: 'PATCH',
        body: { visibility },
      }),
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'WorkspaceNote', id: noteId },
        // If the caller also has a public view open, refresh it.
        { type: 'WorkspaceNote', id: 'PUBLIC' },
        'WorkspaceNote',
      ],
    }),

    // ─── Move a note to a folder (or root) ────────────────────────────
    // Send { noteId, folderId } where folderId is a folder _id OR null.
    moveWorkspaceNote: builder.mutation({
      query: ({ noteId, folderId }) => ({
        url: `${WORKSPACE_NOTES_URL}/${noteId}/move`,
        method: 'PATCH',
        body: { folderId },
      }),
      invalidatesTags: (result, error, { noteId }) => [
        { type: 'WorkspaceNote', id: noteId },
        'WorkspaceNote',
        'WorkspaceNoteFolder',
      ],
    }),

    // ─── Delete a workspace note ──────────────────────────────────────
    // Server enforces: note author OR workspace Admin/Owner.
    deleteWorkspaceNote: builder.mutation({
      query: (noteId) => ({
        url: `${WORKSPACE_NOTES_URL}/${noteId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, noteId) => [
        { type: 'WorkspaceNote', id: noteId },
        { type: 'WorkspaceNote', id: 'PUBLIC' },
        'WorkspaceNote',
        'WorkspaceNoteFolder',
      ],
    }),

    // ─── Export workspace note as PDF ──────────────────────────────────
    // Members only (server-side). Public-note PDF export is not exposed.
    exportWorkspaceNotePDF: builder.query({
      query: (noteId) => ({
        url: `${WORKSPACE_NOTES_URL}/${noteId}/export-pdf`,
        method: 'GET',
        responseHandler: (response) => response.blob(),
        cache: false,
      }),
    }),

    // ─── Import file to create workspace note ──────────────────────────
    // Send { file, title?, workspaceId, folderId?, color?, visibility? }
    importFileToWorkspaceNote: builder.mutation({
      query: (data) => {
        const formData = new FormData();
        if (data.file) formData.append('file', data.file);
        if (data.title) formData.append('title', data.title);
        if (data.workspaceId) formData.append('workspaceId', data.workspaceId);
        if (data.folderId) formData.append('folderId', data.folderId);
        if (data.color) formData.append('color', data.color);
        if (data.visibility) formData.append('visibility', data.visibility);
        return {
          url: `${WORKSPACE_NOTES_URL}/import`,
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: ['WorkspaceNote', 'WorkspaceNoteFolder'],
    }),

    // ═══════════════════════════════════════════════════════════════════
    // Folders
    // ═══════════════════════════════════════════════════════════════════

    // ─── Create a folder ──────────────────────────────────────────────
    // Send { workspaceId, name, parentId?, color? }
    createWorkspaceNoteFolder: builder.mutation({
      query: (data) => ({
        url: `${WORKSPACE_NOTES_URL}/folders`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['WorkspaceNoteFolder'],
    }),

    // ─── List folders for a workspace (flat list; build tree on client) ─
    getWorkspaceNoteFolders: builder.query({
      query: (workspaceId) => ({
        url: `${WORKSPACE_NOTES_URL}/folders/${workspaceId}`,
      }),
      providesTags: (result, error, workspaceId) =>
        result
          ? [
              ...result.folders.map((f) => ({ type: 'WorkspaceNoteFolder', id: f._id })),
              { type: 'WorkspaceNoteFolder', id: 'LIST' },
              { type: 'WorkspaceNoteFolder', id: workspaceId },
            ]
          : [
              { type: 'WorkspaceNoteFolder', id: 'LIST' },
              { type: 'WorkspaceNoteFolder', id: workspaceId },
            ],
    }),

    // ─── Update a folder (rename / recolor / reorder / re-parent) ────
    // Send { folderId, data } where data may include:
    //   { name?, color?, order?, parentId? }
    //   parentId: null → move to root
    updateWorkspaceNoteFolder: builder.mutation({
      query: ({ folderId, data }) => ({
        url: `${WORKSPACE_NOTES_URL}/folders/${folderId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { folderId }) => [
        { type: 'WorkspaceNoteFolder', id: folderId },
        'WorkspaceNoteFolder',
        'WorkspaceNote',
      ],
    }),

    // ─── Change a folder's color only ─────────────────────────────────
    // Send { folderId, color } where color is any CSS color string or
    // null (null clears the color).
    updateWorkspaceNoteFolderColor: builder.mutation({
      query: ({ folderId, color }) => ({
        url: `${WORKSPACE_NOTES_URL}/folders/${folderId}/color`,
        method: 'PATCH',
        body: { color },
      }),
      invalidatesTags: (result, error, { folderId }) => [
        { type: 'WorkspaceNoteFolder', id: folderId },
        'WorkspaceNoteFolder',
        'WorkspaceNote',
      ],
    }),

    // ─── Delete a folder ──────────────────────────────────────────────
    // Send { folderId, moveNotesTo? }
    //   moveNotesTo: 'parent' (default) | 'root' | '<folderId>'
    deleteWorkspaceNoteFolder: builder.mutation({
      query: ({ folderId, moveNotesTo }) => ({
        url: `${WORKSPACE_NOTES_URL}/folders/${folderId}`,
        method: 'DELETE',
        body: moveNotesTo ? { moveNotesTo } : {},
      }),
      invalidatesTags: (result, error, { folderId }) => [
        { type: 'WorkspaceNoteFolder', id: folderId },
        'WorkspaceNoteFolder',
        'WorkspaceNote', // notes got re-homed — refresh visible lists
      ],
    }),
  }),
});

export const {
  // CRUD
  useCreateWorkspaceNoteMutation,
  useGetWorkspaceNotesQuery,
  useLazyGetWorkspaceNotesQuery,
  useGetWorkspaceNoteQuery,
  useLazyGetWorkspaceNoteQuery,
  useGetPublicWorkspaceNoteQuery,          // 👈 new — public share page
  useLazyGetPublicWorkspaceNoteQuery,      // 👈 new
  useUpdateWorkspaceNoteMutation,
  useUpdateWorkspaceNoteColorMutation,
  useUpdateWorkspaceNoteVisibilityMutation, // 👈 new
  useMoveWorkspaceNoteMutation,
  useDeleteWorkspaceNoteMutation,
  useExportWorkspaceNotePDFQuery,
  useLazyExportWorkspaceNotePDFQuery,
  useImportFileToWorkspaceNoteMutation,

  // Folders
  useCreateWorkspaceNoteFolderMutation,
  useGetWorkspaceNoteFoldersQuery,
  useLazyGetWorkspaceNoteFoldersQuery,
  useUpdateWorkspaceNoteFolderMutation,
  useUpdateWorkspaceNoteFolderColorMutation,
  useDeleteWorkspaceNoteFolderMutation,
} = workspaceNoteApiSlice;