// src/slices/stickerApiSlice.js
import { apiSlice } from './apiSlice';

const STICKER_URL = '/stickers';

export const stickerApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({

    // ─── Create Sticker ────────────────────────────────────────────────
    // POST /stickers (multipart/form-data with field 'stickerFile')
    createSticker: builder.mutation({
      query: (data) => {
        // data should be FormData containing stickerFile, type, duration, tags
        return {
          url: STICKER_URL,
          method: 'POST',
          body: data,
          // let browser set Content-Type for FormData
        };
      },
      invalidatesTags: ['Sticker', 'SavedSticker'],
    }),

    // ─── Send Sticker as a Message ──────────────────────────────────
    // POST /stickers/send
    sendSticker: builder.mutation({
      query: ({ chatId, stickerId, replyToId }) => ({
        url: `${STICKER_URL}/send`,
        method: 'POST',
        body: { chatId, stickerId, replyToId },
      }),
      invalidatesTags: (result, error, { chatId }) => [
        { type: 'Chat', id: chatId },
        'Message',
      ],
    }),

    // ─── Save Sticker to Collection ─────────────────────────────────
    // POST /stickers/:stickerId/save
    saveSticker: builder.mutation({
      query: (stickerId) => ({
        url: `${STICKER_URL}/${stickerId}/save`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, stickerId) => [
        { type: 'Sticker', id: stickerId },
        'SavedSticker',
      ],
    }),

    // ─── Unsave Sticker ─────────────────────────────────────────────
    // POST /stickers/:stickerId/unsave
    unsaveSticker: builder.mutation({
      query: (stickerId) => ({
        url: `${STICKER_URL}/${stickerId}/unsave`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, stickerId) => [
        { type: 'Sticker', id: stickerId },
        'SavedSticker',
      ],
    }),

    // ─── Get Saved Stickers for Current User ──────────────────────
    // GET /stickers/saved
    getSavedStickers: builder.query({
      query: () => ({
        url: `${STICKER_URL}/saved`,
      }),
      providesTags: ['SavedSticker'],
    }),

    // ─── Get All Stickers (with optional tag filter) ──────────────
    // GET /stickers?tag=...&limit=...&page=...
    getStickers: builder.query({
      query: ({ tag, limit = 50, page = 1 } = {}) => ({
        url: STICKER_URL,
        params: { tag, limit, page },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.stickers.map((s) => ({ type: 'Sticker', id: s._id })),
              { type: 'Sticker', id: 'LIST' },
            ]
          : [{ type: 'Sticker', id: 'LIST' }],
    }),

    // ─── Delete Sticker ─────────────────────────────────────────────
    // DELETE /stickers/:stickerId
    deleteSticker: builder.mutation({
      query: (stickerId) => ({
        url: `${STICKER_URL}/${stickerId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, stickerId) => [
        { type: 'Sticker', id: stickerId },
        'Sticker',
        'SavedSticker',
      ],
    }),

  }),
});

export const {
  useCreateStickerMutation,
  useSendStickerMutation,
  useSaveStickerMutation,
  useUnsaveStickerMutation,
  useGetSavedStickersQuery,
  useGetStickersQuery,
  useDeleteStickerMutation,
} = stickerApiSlice;