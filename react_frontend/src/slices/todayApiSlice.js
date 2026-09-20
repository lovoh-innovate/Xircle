// src/slices/todayApiSlice.js
import { apiSlice } from './apiSlice';

const TODAY_URL = '/today';

export const todayApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Today — the front door ─────────────────────────────────────
    // GET /api/today
    //
    // Returns the five sections built from the four contexts:
    //   myWork        → personal tasks overdue + due today
    //   teamWork      → project tasks overdue + due today
    //   awaitingMe    → task confirmations + subtask reviews blocked on me
    //   conversations → unread chats + mentions
    //   teamPulse     → pending join requests + recently created projects
    //
    // Plus: totalAttention (a single badge number) and generatedAt.
    //
    // READ-ONLY. Today is a lens — it never writes.
    // Cache tag is 'Today' so any mutation that changes work
    // (creating a task, sending a message, confirming) can invalidate
    // this one entry and force a fresh read on next visit.
    getToday: builder.query({
      query: () => `${TODAY_URL}`,
      providesTags: ['Today'],
    }),
  }),
});

export const { useGetTodayQuery } = todayApiSlice;