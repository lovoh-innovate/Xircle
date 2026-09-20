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

    // ─── Review an existing project ─────────────────────────────────
    // body: { projectId, focus? }
    // returns: { success, review: { healthScore, overallAssessment, strengths, issues, recommendations } }
    // Managers only (owner / admin / PM).
    reviewProject: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/review`,
        method: 'POST',
        body: data,
      }),
      // No invalidation — this is analysis, not mutation of data.
    }),

    // ─── Summary snapshot of a project ──────────────────────────────
    // body: { projectId }
    // returns: { success, summary: { headline, summary, currentState, highlights, risks, nextSteps } }
    summarizeProject: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/summarize`,
        method: 'POST',
        body: data,
      }),
    }),

    // ─── Explain a task or the project ──────────────────────────────
    // body: { projectId, taskId?, question?, audience? }
    // returns: { success, explanation: { tlDr, explanation, whyItMatters, whatYouActuallyDo, commonPitfalls } }
    explainContext: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/explain`,
        method: 'POST',
        body: data,
      }),
    }),

    // ─── Structured project documentation (for PDF export) ──────────
    // body: { projectId }
    // returns: { success, doc: { meta, sections } }
    generateProjectDocs: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/document`,
        method: 'POST',
        body: data,
      }),
    }),

    // ─── Ask Xircle — conversational lens over the user's own data ──
    // body: { question: string, history?: [{ role: 'user'|'assistant', content: string }] }
    // returns: {
    //   success,
    //   answer: string,
    //   followUps: string[],
    //   generatedAt,
    //   timezone,
    //   contextCounts: { openPersonalTasks, openProjectTasks, activeProjects, ... }
    // }
    //
    // READ-ONLY. Does not change any server data, so no invalidatesTags.
    // No providesTags either — this is a one-shot query, not cached state.
    askXircle: builder.mutation({
      query: (data) => ({
        url: `${AI_URL}/ask`,
        method: 'POST',
        body: data,
      }),
    }),
  }),
});

export const {
  usePlanWithAIMutation,
  useExecuteAIPlanMutation,
  useReviewProjectMutation,
  useSummarizeProjectMutation,
  useExplainContextMutation,
  useGenerateProjectDocsMutation,
  useAskXircleMutation,                    // 👈 NEW
} = aiApiSlice;