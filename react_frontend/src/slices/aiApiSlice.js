// src/slices/aiApiSlice.js
import { apiSlice } from './apiSlice';

const AI_URL = '/ai';

export const aiApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Preview a plan — NOTHING hits the DB ────────────────────────
    // body: { workspaceId, prompt }
    // returns: { success, plan: { project, tasks, warnings } }
    planWithAI: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/plan`,
        method: 'POST',
        body: data,
      }),
      // No invalidatesTags — plan creation doesn't change server data.
    }),

    // ─── Commit a plan — creates project + members + tasks ──────────
    // body: { workspaceId, plan }
    // returns: { success, project, taskCount, subtaskCount, memberCount, warnings }
    executeAIPlan: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/execute`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Project', 'Task', 'Workspace'],
    }),
  }),
});

export const {
  usePlanWithAIMutation,
  useExecuteAIPlanMutation,
} = aiApiSlice;