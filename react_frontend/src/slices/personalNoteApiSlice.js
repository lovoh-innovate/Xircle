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
    getNotes: builder.query({
      query: () => ({
        url: `${NOTES_URL}`,
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

    // ═══════════════════════════════════════════════════════════════════
    // AI
    // ═══════════════════════════════════════════════════════════════════
    //
    // All six are mutations: user-triggered actions with payloads, not
    // cache-keyed reads. None of them write to the DB — proofread,
    // complete, and rewrite return SUGGESTED content. The client holds
    // those in local state until the user hits Apply, at which point the
    // normal useUpdateNoteMutation fires and its invalidation refreshes
    // the note.
    //
    // No providesTags / invalidatesTags anywhere below. Nothing to cache.

    // ─── Scripture lookup ───────────────────────────────────────────
    // Highlight → server classifies Bible / Quran / general, and for
    // scripture returns the actual passage text plus the expand buttons.
    // Send { text, noteId? }.
    lookupScripture: builder.mutation({
      query: ({ text, noteId }) => ({
        url: `${NOTES_URL}/ai/scripture`,
        method: 'POST',
        body: { text, noteId },
      }),
    }),

    // ─── Scripture expand ───────────────────────────────────────────
    // "Show more verses" / "Show full chapter" buttons. Stateless —
    // client sends back the parsed reference it received from
    // lookupScripture, along with the expand mode it wants.
    // Send { type: 'bible'|'quran', parsed, expand }.
    expandScripture: builder.mutation({
      query: ({ type, parsed, expand }) => ({
        url: `${NOTES_URL}/ai/scripture/expand`,
        method: 'POST',
        body: { type, parsed, expand },
      }),
    }),

    // ─── Non-scripture search ───────────────────────────────────────
    // Summary + definitions + related topics + ready-made search links.
    // `context` is optional surrounding note text for disambiguation.
    // Send { text, context?, noteId? }.
    searchHighlight: builder.mutation({
      query: ({ text, context, noteId }) => ({
        url: `${NOTES_URL}/ai/search`,
        method: 'POST',
        body: { text, context, noteId },
      }),
    }),

    // ─── Proofread ──────────────────────────────────────────────────
    // Returns SUGGESTED corrected content — does NOT save.
    // Send EITHER { noteId } OR { content, title? }.
    proofreadNote: builder.mutation({
      query: ({ noteId, content, title }) => ({
        url: `${NOTES_URL}/ai/proofread`,
        method: 'POST',
        body: { noteId, content, title },
      }),
    }),

    // ─── Complete / expand ──────────────────────────────────────────
    // Returns SUGGESTED expanded content — does NOT save.
    // style: 'explanatory' | 'concise' | 'devotional' | 'academic' | 'journal'
    // Send { noteId, style? } OR { content, title?, style? }.
    completeNote: builder.mutation({
      query: ({ noteId, content, title, style }) => ({
        url: `${NOTES_URL}/ai/complete`,
        method: 'POST',
        body: { noteId, content, title, style },
      }),
    }),

    // ─── Rewrite ────────────────────────────────────────────────────
    // Full rewrite — restructure, elaborate, reformat, adjust tone/length.
    // Unlike completeNote (which only ADDS), this can retighten, reorder,
    // and reformat the whole note. Returns SUGGESTED content — does NOT save.
    //
    // Send EITHER { noteId } OR { content, title? }
    // Optional:
    //   instructions : free-form string, e.g. "make it more formal"
    //   style        : 'explanatory' | 'formal' | 'casual'
    //                | 'devotional' | 'academic' | 'journal'
    //   length       : 'shorter' | 'same' | 'longer' | 'much_longer'
    //
    // Returns:
    //   { original, rewrittenContent, changed, changeCount,
    //     changes, summary, style, length }
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
  useDeleteNoteMutation,
  useTogglePublicMutation,
  useGetNoteByShareLinkQuery,
  useLazyGetNoteByShareLinkQuery,

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
  useRewriteNoteMutation,                  // 👈 NEW
} = personalNoteApiSlice;